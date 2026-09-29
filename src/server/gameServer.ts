/** Two truly separate Socket.io modes: cooperative Rescue and 5v5 Ironworks. */
import { createServer, type Server as HttpServer } from "node:http";
import { Server as IoServer } from "socket.io";
import { PLAYER_SPAWN, TEAM_CAPACITY, TEAM_RESPAWN_SECONDS, WORLD, getShotBlockers, isSafeZone } from "@/game/mapData";
import { ARENA, getArenaBlockers } from "@/game/arena";
import { WEAPONS } from "@/game/armament";
import { spawnFor, chooseTeam, freshScore, winningTeam, type TeamScore } from "@/game/teams";
import { actorBox, rayAabb, raycastBoxes } from "@/game/collision";
import {
  ROOM_RESCUE, ROOM_DEATHMATCH,
  type ClientToServerEvents, type MatchPayload, type PlayerSnapshot, type ServerToClientEvents,
} from "@/game/protocol";
import type { GameMode, TeamId, TeamOrSpectator, Vec3 } from "@/game/types";

type ServerPlayer = PlayerSnapshot & {
  lastShot: number; shotOrigin: Vec3; shotDir: Vec3; hitUsed: boolean; graceUntil: number;
};
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
  };
  const resetRound = () => {
    score = { ...freshScore(), round: score.round + 1 };
    for (const p of inMode("deathmatch")) {
      p.kills = 0; p.deaths = 0;
      respawn(p);
    }
    broadcastMatch();
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
    if (mode === "deathmatch") broadcastMatch();

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
      const hit = rayAabb(p.shotOrigin, p.shotDir, actorBox(target.pos, [.5, 0, .5], 1.85), 220);
      if (!hit || raycastBoxes(p.shotOrigin, p.shotDir, getArenaBlockers(), Math.max(0, hit.t - .1))) return;
      p.hitUsed = true;
      const weapon = WEAPONS[p.weapon ?? "rifle"];
      // The client raycasts each pellet but sends one server-confirmed target.
      // A close shotgun cluster therefore deals five-pellet damage, while every
      // other weapon uses its exact listed damage.
      const damage = weapon.damage * (weapon.pellets > 1 ? 5 : 1);
      target.hp = Math.max(0, target.hp - damage);
      io.to(ROOM_DEATHMATCH).emit("playerHurt", { id: target.id, hp: target.hp, byId: p.id, damage });
      if (target.hp !== 0) return;
      target.alive = false;
      target.deaths += 1;
      p.kills += 1;
      const winnerTeam = p.team as TeamId;
      score[winnerTeam] += 1;
      const winner = winningTeam(score);
      if (winner) score.ended = true;
      io.to(ROOM_DEATHMATCH).emit("playerDied", {
        victimId: target.id, killerId: p.id, killerName: p.name, victimName: target.name, team: target.team, score: { ...score },
      });
      broadcastMatch();
      if (winner) {
        io.to(ROOM_DEATHMATCH).emit("roundEnded", { winner, score: { ...score } });
        later(resetRound, 4500);
      } else later(() => respawn(target), TEAM_RESPAWN_SECONDS * 1000);
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
      if (mode === "deathmatch") broadcastMatch();
    });
  });

  const timer = setInterval(() => {
    if (inMode("rescue").length) io.to(ROOM_RESCUE).emit("snapshot", { players: inMode("rescue").map(snapshot), tick: Date.now(), match: match("rescue") });
    if (inMode("deathmatch").length) io.to(ROOM_DEATHMATCH).emit("snapshot", { players: inMode("deathmatch").map(snapshot), tick: Date.now(), match: match("deathmatch") });
  }, 50);
  if (!isServer) {
    http.listen(port);
  }
  return { http, io, port, close: () => { clearInterval(timer); for (const id of timers) clearTimeout(id); io.close(); if (!isServer) http.close(); } };
}
