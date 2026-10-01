/** Two truly separate Socket.io modes: cooperative Rescue and 5v5 Ironworks. */
import { createServer, type Server as HttpServer } from "node:http";
import { Server as IoServer } from "socket.io";
import { PLAYER_SPAWN, TEAM_CAPACITY, TEAM_RESPAWN_SECONDS, WORLD, getShotBlockers, isSafeZone } from "@/game/mapData";
import { ARENA, getArenaBlockers, getArenaSolids } from "@/game/arena";
import { WEAPONS } from "@/game/armament";
import { spawnFor, chooseTeam, freshScore, winningTeam, type TeamScore } from "@/game/teams";
import { actorBox, hasLineOfSight, moveAndCollide, rayAabb, raycastBoxes } from "@/game/collision";
import { serverDb } from "@/db/storage";
import {
  ROOM_RESCUE, ROOM_DEATHMATCH,
  type ClientToServerEvents, type MatchPayload, type PlayerSnapshot, type ServerToClientEvents,
} from "@/game/protocol";
import type { GameMode, TeamId, TeamOrSpectator, Vec3, WeaponKind } from "@/game/types";

type ServerPlayer = PlayerSnapshot & {
  lastShot: number; shotOrigin: Vec3; shotDir: Vec3; hitUsed: boolean; graceUntil: number;
  isBot?: boolean;
  targetWaypoint?: Vec3;
  nextShot?: number;
  strafeDir?: number;
  crouching?: boolean;
};

const BOT_NAMES = ["BOT Viper", "BOT Ghost", "BOT Razor", "BOT Apex", "BOT Titan", "BOT Shadow", "BOT Cobra", "BOT Phantom"];
const BOT_WEAPONS: WeaponKind[] = ["rifle", "p90", "smg", "rifle", "awp", "deagle"];
const BOT_WAYPOINTS: Vec3[] = [
  [-30, 0, 20], [-18, 0, 24], [0, 0, 22], [18, 0, 20], [30, 0, 18],
  [-30, 0, -18], [-18, 0, -20], [0, 0, -22], [18, 0, -24], [30, 0, -20],
  [-15, 0, 0], [0, 0, 8], [0, 0, -8], [15, 0, 0],
  [-22, 0, 10], [22, 0, -10], [-8, 0, -14], [8, 0, 14],
];
const TARGET_PLAYERS_PER_TEAM = 2;
const number = (value: unknown, min: number, max: number, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const position = (value: unknown, old: Vec3, mode: GameMode): Vec3 => {
  if (!Array.isArray(value)) return [...old];
  if (mode === "deathmatch") {
    return [
      number(value[0], -ARENA.width / 2 + 1.2, ARENA.width / 2 - 1.2, old[0]),
      number(value[1], 0, 12, old[1]),
      number(value[2], -ARENA.depth / 2 + 1.2, ARENA.depth / 2 - 1.2, old[2]),
    ];
  }
  return [
    number(value[0], -WORLD.outer, WORLD.outer, old[0]),
    number(value[1], 0, 30, old[1]),
    number(value[2], WORLD.north, WORLD.south, old[2]),
  ];
};
const snapshot = (p: ServerPlayer): PlayerSnapshot => ({
  id: p.id, name: p.name, pos: [...p.pos], yaw: p.yaw, pitch: p.pitch, hp: p.hp, alive: p.alive,
  moving: p.moving, kills: p.kills, deaths: p.deaths, team: p.team, mode: p.mode,
  riding: p.riding, weapon: p.weapon, protected: p.protected,
  crouching: p.crouching,
});

export type GameServerHandle = { http: HttpServer; io: IoServer<ClientToServerEvents, ServerToClientEvents>; port: number; close: () => void };

export function startGameServer(portOrServer: number | HttpServer = Number(process.env.GAME_SERVER_PORT || 4000)): GameServerHandle {
  const players = new Map<string, ServerPlayer>();
  let score: TeamScore = freshScore();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, delay: number) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, delay);
    timers.add(id);
  };

  const inMode = (mode: GameMode): ServerPlayer[] => [...players.values()].filter(p => p.mode === mode);
  const teamCounts = () => ({
    blue: inMode("deathmatch").filter(p => p.team === "blue").length,
    red: inMode("deathmatch").filter(p => p.team === "red").length,
  });
  const match = (mode: GameMode, selfTeam?: TeamOrSpectator): MatchPayload => {
    if (mode === "rescue") return {
      mode, ...freshScore(), bluePlayers: inMode("rescue").length, redPlayers: 0,
      capacity: 0, selfTeam,
    };
    const count = teamCounts();
    return { mode, ...score, bluePlayers: count.blue, redPlayers: count.red, capacity: TEAM_CAPACITY, selfTeam };
  };
  const broadcastMatch = () => io.to(ROOM_DEATHMATCH).emit("matchUpdate", match("deathmatch"));

  const respawn = (p: ServerPlayer) => {
    if (!players.has(p.id) || p.mode !== "deathmatch" || p.team === "spectator") return;
    const team = p.team as TeamId;
    p.pos = spawnFor(team, (p.deaths + p.kills) % TEAM_CAPACITY);
    p.yaw = team === "blue" ? -Math.PI / 4 : Math.PI * 3 / 4;
    p.pitch = 0;
    p.hp = 100;
    p.alive = true;
    p.moving = false;
    p.riding = false;
    p.graceUntil = Date.now() + 2800;
    p.protected = true;
    if (p.isBot) {
      p.targetWaypoint = BOT_WAYPOINTS[Math.floor(Math.random() * BOT_WAYPOINTS.length)];
      p.nextShot = Date.now() + 1500;
    }
  };
  const resetRound = () => {
    score = { ...freshScore(), round: score.round + 1 };
    for (const p of inMode("deathmatch")) {
      p.kills = 0; p.deaths = 0;
      respawn(p);
    }
    balanceBots();
    broadcastMatch();
  };

  let roundResetTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleReset = () => {
    if (roundResetTimer) {
      clearTimeout(roundResetTimer);
      timers.delete(roundResetTimer);
    }
    roundResetTimer = setTimeout(() => {
      roundResetTimer = null;
      resetRound();
    }, 15000);
    timers.add(roundResetTimer);
  };

  let botSeq = 0;
  const spawnBot = (team: TeamId): ServerPlayer => {
    botSeq++;
    const botId = `bot_${team}_${botSeq}`;
    const name = BOT_NAMES[(botSeq) % BOT_NAMES.length];
    const spawnIndex = (team === "blue" ? teamCounts().blue : teamCounts().red) % TEAM_CAPACITY;
    const pos = spawnFor(team, spawnIndex);
    const weapon = BOT_WEAPONS[botSeq % BOT_WEAPONS.length];
    const bot: ServerPlayer = {
      id: botId,
      name,
      pos: [...pos],
      yaw: team === "blue" ? -Math.PI / 4 : Math.PI * 3 / 4,
      pitch: 0,
      hp: 100,
      alive: true,
      moving: false,
      kills: 0,
      deaths: 0,
      team,
      mode: "deathmatch",
      riding: false,
      weapon,
      protected: true,
      lastShot: 0,
      shotOrigin: [0, 0, 0],
      shotDir: [0, 0, -1],
      hitUsed: false,
      graceUntil: Date.now() + 2500,
      isBot: true,
      targetWaypoint: BOT_WAYPOINTS[Math.floor(Math.random() * BOT_WAYPOINTS.length)],
      nextShot: Date.now() + 1200 + Math.random() * 800,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
    };
    players.set(bot.id, bot);
    io.to(ROOM_DEATHMATCH).emit("playerJoined", snapshot(bot));
    return bot;
  };

  const balanceBots = () => {
    const dmPlayers = inMode("deathmatch");
    const humanPlayers = dmPlayers.filter(p => !p.isBot && p.team !== "spectator");
    if (humanPlayers.length === 0) {
      // Empty lobby: clear all bots to avoid CPU usage
      for (const p of dmPlayers.filter(p => p.isBot)) {
        players.delete(p.id);
        io.to(ROOM_DEATHMATCH).emit("playerLeft", { id: p.id });
      }
      return;
    }

    // Real players are present: ensure TARGET_PLAYERS_PER_TEAM on both Blue & Red
    for (const team of ["blue", "red"] as TeamId[]) {
      const teamHumans = dmPlayers.filter(p => !p.isBot && p.team === team);
      const teamBots = dmPlayers.filter(p => p.isBot && p.team === team);
      const neededBots = Math.max(0, TARGET_PLAYERS_PER_TEAM - teamHumans.length);

      if (teamBots.length > neededBots) {
        // Human joined: remove excess bot to make room
        const toKick = teamBots.slice(0, teamBots.length - neededBots);
        for (const bot of toKick) {
          players.delete(bot.id);
          io.to(ROOM_DEATHMATCH).emit("playerLeft", { id: bot.id });
        }
      } else if (teamBots.length < neededBots) {
        // Backfill with bots so teams are always balanced
        const toAdd = neededBots - teamBots.length;
        for (let i = 0; i < toAdd; i++) {
          spawnBot(team);
        }
      }
    }
  };

  const updateBots = (dt = 0.05) => {
    const bots = inMode("deathmatch").filter(p => p.isBot && p.alive);
    if (bots.length === 0) return;
    const now = Date.now();
    const blockers = getArenaBlockers();
    const solids = getArenaSolids();

    for (const bot of bots) {
      if (bot.protected && now > bot.graceUntil) {
        bot.protected = false;
      }

      // 1. Search for closest enemy with direct line-of-sight
      const enemies = inMode("deathmatch").filter(p => p.team !== bot.team && p.team !== "spectator" && p.alive && !p.protected);
      let targetEnemy: ServerPlayer | null = null;
      let targetDist = Infinity;
      let targetAimPoint: Vec3 | null = null;
      let botEye: Vec3 = [bot.pos[0], bot.pos[1] + 1.5, bot.pos[2]];

      for (const enemy of enemies) {
        const d = Math.hypot(enemy.pos[0] - bot.pos[0], enemy.pos[2] - bot.pos[2]);
        if (d < 45) {
          const eyeY = enemy.crouching ? 1.05 : 1.45;
          const chestY = enemy.crouching ? 0.75 : 1.15;
          const enemyEye: Vec3 = [enemy.pos[0], enemy.pos[1] + eyeY, enemy.pos[2]];
          const enemyChest: Vec3 = [enemy.pos[0], enemy.pos[1] + chestY, enemy.pos[2]];

          // Test line-of-sight to chest first (center of mass), fallback to head peeking
          const canSeeChest = hasLineOfSight(botEye, enemyChest, blockers);
          const canSeeEye = canSeeChest || hasLineOfSight(botEye, enemyEye, blockers);

          if (canSeeEye && d < targetDist) {
            targetDist = d;
            targetEnemy = enemy;
            targetAimPoint = canSeeChest ? enemyChest : enemyEye;
          }
        }
      }

      if (targetEnemy && targetAimPoint) {
        const dx = targetEnemy.pos[0] - bot.pos[0];
        const dz = targetEnemy.pos[2] - bot.pos[2];
        const targetYaw = Math.atan2(-dx, -dz);
        bot.yaw = targetYaw;
        const dy = targetAimPoint[1] - (bot.pos[1] + 1.5);
        bot.pitch = Math.atan2(dy, targetDist);

        // Combat strafing with physical collision against solids
        bot.moving = true;
        const strafeSpeed = 2.4;
        const vel: Vec3 = [
          Math.cos(targetYaw) * strafeSpeed * (bot.strafeDir ?? 1),
          -0.5,
          Math.sin(targetYaw) * strafeSpeed * (bot.strafeDir ?? 1),
        ];
        const col = moveAndCollide(bot.pos, [0.42, 0, 0.42], 1.85, vel, dt, solids);
        if (col.hitWall || Math.random() < 0.04) {
          bot.strafeDir = (bot.strafeDir ?? 1) * -1;
        }

        bot.pos[0] = Math.max(-48, Math.min(48, bot.pos[0]));
        bot.pos[2] = Math.max(-40, Math.min(40, bot.pos[2]));
        botEye = [bot.pos[0], bot.pos[1] + 1.5, bot.pos[2]];

        if (now >= (bot.nextShot ?? 0) && !score.ended) {
          const spec = WEAPONS[bot.weapon ?? "rifle"];
          bot.nextShot = now + Math.max(300, spec.interval * 1000 * (1.1 + Math.random() * 0.6));
          const spread = 0.038;
          const aimDx = targetAimPoint[0] - botEye[0];
          const aimDy = targetAimPoint[1] - botEye[1];
          const aimDz = targetAimPoint[2] - botEye[2];
          const aimDist = Math.hypot(aimDx, aimDy, aimDz) || 1;
          const shotDir: Vec3 = [
            (aimDx / aimDist) + (Math.random() - 0.5) * spread,
            (aimDy / aimDist) + (Math.random() - 0.5) * spread,
            (aimDz / aimDist) + (Math.random() - 0.5) * spread,
          ];
          const dirLen = Math.hypot(...shotDir) || 1;
          const normDir: Vec3 = [shotDir[0] / dirLen, shotDir[1] / dirLen, shotDir[2] / dirLen];

          io.to(ROOM_DEATHMATCH).emit("playerShot", { id: bot.id, origin: botEye, dir: normDir });

          const enemyHeight = targetEnemy.crouching ? 1.25 : 1.85;
          const hit = rayAabb(botEye, normDir, actorBox(targetEnemy.pos, [.5, 0, .5], enemyHeight), 180);
          const wallHit = raycastBoxes(botEye, normDir, blockers, 180);

          // Strictly reject hits through walls!
          if (hit && (!wallHit || hit.t < wallHit.t - 0.05)) {
            const relY = hit.point[1] - targetEnemy.pos[1];
            let damage = spec.damage * (spec.pellets > 1 ? 5 : 1);
            if (bot.weapon === "awp") {
              if (relY < (targetEnemy.crouching ? 0.45 : 0.72)) damage = 85;
              else if (relY >= (targetEnemy.crouching ? 0.95 : 1.45)) damage = 220;
              else damage = 115;
            } else {
              if (relY >= (targetEnemy.crouching ? 0.95 : 1.45)) damage = Math.round(damage * 2.2);
              else if (relY < (targetEnemy.crouching ? 0.45 : 0.72)) damage = Math.round(damage * 0.75);
            }

            targetEnemy.hp = Math.max(0, targetEnemy.hp - damage);
            io.to(ROOM_DEATHMATCH).emit("playerHurt", { id: targetEnemy.id, hp: targetEnemy.hp, byId: bot.id, damage });

            if (targetEnemy.hp === 0) {
              targetEnemy.alive = false;
              targetEnemy.deaths += 1;
              bot.kills += 1;
              const winnerTeam = bot.team as TeamId;
              score[winnerTeam] += 1;
              const winner = winningTeam(score);
              if (winner) score.ended = true;
              io.to(ROOM_DEATHMATCH).emit("playerDied", {
                victimId: targetEnemy.id, killerId: bot.id, killerName: bot.name, victimName: targetEnemy.name, team: targetEnemy.team, score: { ...score },
              });
              broadcastMatch();
              if (winner) {
                io.to(ROOM_DEATHMATCH).emit("roundEnded", { winner, score: { ...score } });
                scheduleReset();
              } else {
                later(() => respawn(targetEnemy!), TEAM_RESPAWN_SECONDS * 1000);
              }
            }
          }
        }
      } else {
        // Waypoint patrol with physical collision against arena solids
        if (!bot.targetWaypoint) {
          bot.targetWaypoint = BOT_WAYPOINTS[Math.floor(Math.random() * BOT_WAYPOINTS.length)];
        }
        const toX = bot.targetWaypoint[0] - bot.pos[0];
        const toZ = bot.targetWaypoint[2] - bot.pos[2];
        const wpDist = Math.hypot(toX, toZ);
        if (wpDist < 2.0) {
          bot.targetWaypoint = BOT_WAYPOINTS[Math.floor(Math.random() * BOT_WAYPOINTS.length)];
        } else {
          bot.yaw = Math.atan2(-toX, -toZ);
          bot.pitch = 0;
          bot.moving = true;
          const speed = 3.2;
          const vel: Vec3 = [
            (-Math.sin(bot.yaw)) * speed,
            -0.5,
            (-Math.cos(bot.yaw)) * speed,
          ];
          const col = moveAndCollide(bot.pos, [0.42, 0, 0.42], 1.85, vel, dt, solids);
          if (col.hitWall) {
            bot.targetWaypoint = BOT_WAYPOINTS[Math.floor(Math.random() * BOT_WAYPOINTS.length)];
          }
          bot.pos[0] = Math.max(-48, Math.min(48, bot.pos[0]));
          bot.pos[2] = Math.max(-40, Math.min(40, bot.pos[2]));
        }
      }
    }
  };

  const isServer = typeof portOrServer === "object" && portOrServer !== null;
  const http: HttpServer = isServer ? portOrServer : createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true, players: players.size,
      modes: { rescue: inMode("rescue").length, deathmatch: inMode("deathmatch").length },
      match: match("deathmatch"),
    }));
  });
  const port = isServer ? 0 : (typeof portOrServer === "number" ? portOrServer : 4000);
  const io = new IoServer<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: { origin: true, credentials: true }, serveClient: false, maxHttpBufferSize: 16384,
  });

  io.on("connection", socket => {
    // Socket.io handshake auth is sent at connection time. A mode cannot be
    // changed in the middle of a match; returning to the start menu reconnects.
    const mode: GameMode = socket.handshake.auth?.mode === "deathmatch" ? "deathmatch" : "rescue";
    const room = mode === "deathmatch" ? ROOM_DEATHMATCH : ROOM_RESCUE;
    socket.join(room);
    const count = teamCounts();
    const team: TeamOrSpectator = mode === "rescue" ? "blue" : chooseTeam(count.blue, count.red);
    const now = Date.now();
    const rescueIndex = inMode("rescue").length % 5;
    const rescueOffsets: Vec3[] = [[0, 0, 0], [-1.2, 0, 1], [1.2, 0, 1], [-2.2, 0, 2], [2.2, 0, 2]];
    const teamSpawn: Vec3 = mode === "rescue"
      ? [PLAYER_SPAWN[0] + rescueOffsets[rescueIndex][0], PLAYER_SPAWN[1], PLAYER_SPAWN[2] + rescueOffsets[rescueIndex][2]]
      : spawnFor(team === "spectator" ? "blue" : team, team === "blue" ? count.blue : count.red);
    const p: ServerPlayer = {
      id: socket.id, name: "OPERATIVE", pos: teamSpawn,
      yaw: mode === "deathmatch" && team === "red" ? Math.PI * 3 / 4 : mode === "deathmatch" ? -Math.PI / 4 : 0,
      pitch: 0, hp: 100, alive: team !== "spectator", moving: false, kills: 0, deaths: 0, team, mode,
      riding: false, weapon: "rifle", protected: true,
      lastShot: 0, shotOrigin: [0, 0, 0], shotDir: [0, 0, -1], hitUsed: true, graceUntil: now + (mode === "deathmatch" ? 2800 : 8000),
    };
    players.set(p.id, p);
    socket.emit("init", { id: p.id, players: inMode(mode).map(snapshot), tick: now, match: match(mode, team) });
    socket.to(room).emit("playerJoined", snapshot(p));
    if (mode === "deathmatch") {
      balanceBots();
      broadcastMatch();
    }

    socket.on("hello", payload => {
      p.name = (typeof payload?.name === "string" ? payload.name : "OPERATIVE").replace(/[^\w -]/g, "").slice(0, 14) || "OPERATIVE";
    });
    socket.on("move", payload => {
      if (!payload || p.team === "spectator") return;
      p.pos = position(payload.pos, p.pos, mode);
      p.yaw = number(payload.yaw, -100000, 100000, p.yaw) % (Math.PI * 2);
      p.pitch = number(payload.pitch, -1.55, 1.55, p.pitch);
      if (mode === "rescue") {
        // Rescue AI is local; the client reports its own health and death.
        p.hp = number(payload.hp, 0, 100, p.hp);
        p.alive = payload.alive === true;
      }
      // In deathmatch only the server deals damage and schedules respawns.
      p.moving = payload.moving === true;
      p.crouching = payload.crouching === true;
      p.riding = mode === "rescue" && payload.riding === true;
      if (typeof payload.weapon === "string" && payload.weapon in WEAPONS) p.weapon = payload.weapon;
      p.protected = (mode === "rescue" && isSafeZone(p.pos)) || Date.now() < p.graceUntil || !p.alive;
    });
    socket.on("shot", payload => {
      if (!p.alive || p.team === "spectator" || (mode === "deathmatch" && score.ended) || !Array.isArray(payload?.dir) || Date.now() - p.lastShot < WEAPONS[p.weapon ?? "rifle"].interval * 850) return;
      const origin = position(payload.origin, p.pos, mode);
      if (Math.hypot(origin[0] - p.pos[0], origin[1] - p.pos[1], origin[2] - p.pos[2]) > 3) return;
      const d: Vec3 = [number(payload.dir[0], -1, 1), number(payload.dir[1], -1, 1), number(payload.dir[2], -1, 1)];
      const length = Math.hypot(...d); if (length < .5) return;
      p.shotOrigin = origin; p.shotDir = d.map(v => v / length) as Vec3; p.lastShot = Date.now(); p.hitUsed = false;
      socket.to(room).emit("playerShot", { id: p.id, origin, dir: p.shotDir });
    });
    socket.on("hit", payload => {
      if (mode !== "deathmatch") return; // Rescue is cooperative, not PvP.
      const target = players.get(payload?.targetId);
      if (!target || target.mode !== "deathmatch" || target.id === p.id || !target.alive || !p.alive || p.team === "spectator" || target.team === "spectator" || target.team === p.team || score.ended || p.hitUsed || Date.now() - p.lastShot > 500 || target.protected || p.protected) return;
      const targetHeight = target.crouching ? 1.25 : 1.85;
      const hit = rayAabb(p.shotOrigin, p.shotDir, actorBox(target.pos, [.5, 0, .5], targetHeight), 220);
      const wallHit = raycastBoxes(p.shotOrigin, p.shotDir, getArenaBlockers(), 220);
      if (!hit || (wallHit && wallHit.t < hit.t - 0.05)) return;
      p.hitUsed = true;
      const weapon = WEAPONS[p.weapon ?? "rifle"];
      const relY = hit.point[1] - target.pos[1];
      let damage = weapon.damage * (weapon.pellets > 1 ? 5 : 1);
      if (p.weapon === "awp") {
        if (relY < (target.crouching ? 0.45 : 0.72)) damage = 85; // Leg shot: 85 dmg (target survives 100 HP)
        else if (relY >= (target.crouching ? 0.95 : 1.45)) damage = 220; // Headshot
        else damage = 115; // Torso 1-shot kill
      } else {
        if (relY >= (target.crouching ? 0.95 : 1.45)) damage = Math.round(damage * 2.2); // Headshot multiplier
        else if (relY < (target.crouching ? 0.45 : 0.72)) damage = Math.round(damage * 0.75); // Leg shot penalty
      }
      target.hp = Math.max(0, target.hp - damage);
      io.to(ROOM_DEATHMATCH).emit("playerHurt", { id: target.id, hp: target.hp, byId: p.id, damage });
      if (target.hp !== 0) return;
      target.alive = false;
      target.deaths += 1;
      p.kills += 1;
      if (!p.isBot) {
        const prof = serverDb.getProfile(p.name);
        serverDb.saveProfile({
          callsign: p.name,
          kills: (prof?.kills ?? 0) + 1,
          totalXp: (prof?.totalXp ?? 0) + 100,
        });
      }
      const winnerTeam = p.team as TeamId;
      score[winnerTeam] += 1;
      const winner = winningTeam(score);
      if (winner) score.ended = true;
      io.to(ROOM_DEATHMATCH).emit("playerDied", {
        victimId: target.id, killerId: p.id, killerName: p.name, victimName: target.name, team: target.team, score: { ...score },
      });
      broadcastMatch();
      if (winner) {
        serverDb.recordMatch({
          id: `match_${Date.now()}`,
          mode: "deathmatch",
          blueScore: score.blue,
          redScore: score.red,
          winningTeam: winner,
          durationSeconds: 180,
          timestamp: new Date().toISOString(),
        });
        io.to(ROOM_DEATHMATCH).emit("roundEnded", { winner, score: { ...score } });
        scheduleReset();
      } else later(() => respawn(target), TEAM_RESPAWN_SECONDS * 1000);
    });
    socket.on("rematch", () => {
      if (mode === "deathmatch" && score.ended) {
        if (roundResetTimer) {
          clearTimeout(roundResetTimer);
          timers.delete(roundResetTimer);
          roundResetTimer = null;
        }
        resetRound();
      }
    });
    socket.on("missionComplete", payload => {
      if (mode !== "rescue") return; // Deathmatch has no hostage/extraction.
      socket.to(ROOM_RESCUE).emit("missionRecorded", {
        name: p.name, timeMs: Math.round(number(payload?.timeMs, 0, 3600000)),
        kills: Math.round(number(payload?.kills, 0, 999)), score: Math.round(number(payload?.score, 0, 999999)),
      });
    });
    socket.on("disconnect", () => {
      players.delete(p.id);
      socket.to(room).emit("playerLeft", { id: p.id });
      if (mode === "deathmatch") {
        balanceBots();
        broadcastMatch();
      }
    });
  });

  const timer = setInterval(() => {
    updateBots(0.05);
    if (inMode("rescue").length) io.to(ROOM_RESCUE).emit("snapshot", { players: inMode("rescue").map(snapshot), tick: Date.now(), match: match("rescue") });
    if (inMode("deathmatch").length) io.to(ROOM_DEATHMATCH).emit("snapshot", { players: inMode("deathmatch").map(snapshot), tick: Date.now(), match: match("deathmatch") });
  }, 50);
  if (!isServer) {
    http.listen(port);
  }
  return { http, io, port, close: () => { clearInterval(timer); for (const id of timers) clearTimeout(id); io.close(); if (!isServer) http.close(); } };
}
