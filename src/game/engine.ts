/** Fullscreen ink FPS: combat, pickups, escort, and a driveable extraction route. */
import * as THREE from "three";
import { BIKE, CHECKPOINTS, HOSTAGE, INTERACT_RANGE_BIKE, INTERACT_RANGE_HOSTAGE, PLAYER_SPAWN, PLAYER_SPAWN_YAW, PURSUIT, ROAD_POINTS, SPAWN_PROTECTION_SECONDS, TEAM_RESPAWN_SECONDS, TUNING, getBlockerAabbs, getShotBlockers, getSolidAabbs, isSafeZone } from "./mapData";
import { ARENA_PICKUPS, getArenaBlockers, getArenaShotBlockers, getArenaSolids } from "./arena";
import { buildArenaWorld } from "./arenaWorld";
import { enemyBulletHitsPlayer } from "./ai";
import { DIFFICULTIES, SLOT_ORDER, WEAPONS, weaponMoveMultiplier } from "./armament";
import { buildWorld, type World } from "./world";
import { Player, settings as playerSettings } from "./player";
import { ImpactMarks, Tracers, Weapon, applySpread } from "./weapons";
import { Pickups, type Pickup } from "./pickups";
import { BikeController } from "./vehicle";
import { Pursuit, makeRoadPath, type RoadPath } from "./pursuit";
import { PursuitViews } from "./pursuitView";
import { DeathMarks } from "./deathMarks";
import { Particles } from "./particles";
import { Barrels, type Barrel } from "./barrels";
import { EnemyManager } from "./enemies";
import { spawnFor, TEAM_META } from "./teams";
import { RemotePlayers } from "./remote";
import { Net } from "./net";
import { makeBikeCockpit, makeHostage } from "./actors";
import { disposeObject } from "./ink";
import { sfx } from "./audio";
import { hudStore, type LeaderboardEntry } from "./store";
import {
  ACHIEVEMENTS, CONTRACTS, XP, gradeFor, levelForXp, loadAchievements, loadBests,
  loadPersistedSettings, loadTotalXp, newContracts, saveAchievements, saveBests,
  savePersistedSettings, saveTotalXp, streakText, type Bests, type ContractState,
} from "./progression";
import { aabbOverlap, actorBox, angleDelta, clamp, damp, hasLineOfSight, moveAndCollide, raycastBoxes } from "./collision";
import { getRankForXp } from "./ranks";
import { loadInventory, saveInventory } from "./skins";
import type { MatchPayload, PlayerSnapshot } from "./protocol";
import type { AABB, DifficultyId, GameMode, Loadout, TeamId, TeamOrSpectator, Vec3, WeaponKind } from "./types";

export type EngineOptions = { canvas: HTMLCanvasElement; playerName: string; socketUrl: string; mode?: GameMode; loadout?: Loadout; difficulty?: DifficultyId };
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

type RunState = {
  score: number; headshots: number; damageTaken: number; ridersDown: number;
  contracts: ContractState; streakCount: number; streakTimer: number;
};

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private viewScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private viewCamera: THREE.PerspectiveCamera;
  private world: World;
  private player: Player;
  private weapon: Weapon;
  private pickups: Pickups;
  private bike: BikeController;
  private roadPath: RoadPath = makeRoadPath(ROAD_POINTS);
  private pursuit = new Pursuit(this.roadPath);
  private pursuitViews = new PursuitViews(this.scene);
  private deathMarks = new DeathMarks(this.scene);
  private particles = new Particles(this.scene);
  private barrels: Barrels;
  private mode: GameMode;
  private matchConnected = false;
  private finishing = false;
  private finishTimer = 0;
  private cockpit = makeBikeCockpit();
  private scratchMuzzle = new THREE.Vector3();
  private tracers: Tracers;
  private enemyTracers: Tracers;
  private impacts: ImpactMarks;
  private enemies: EnemyManager;
  private remotes = new RemotePlayers(this.scene);
  private net = new Net();
  private solids: AABB[];
  private blockers: AABB[];
  private shotBlockers: AABB[];
  private hostage = makeHostage();
  private hostagePos: Vec3 = [...HOSTAGE.pos];
  private escortTrail: Vec3[] = [];
  private rescued = false;
  private protection = SPAWN_PROTECTION_SECONDS;
  private loadout: Loadout;
  private difficultyId: DifficultyId;
  private run: RunState = { score: 0, headshots: 0, damageTaken: 0, ridersDown: 0, contracts: newContracts(), streakCount: 0, streakTimer: 0 };
  private totalXp = 0;
  private unlocked = new Set<string>();
  private trauma = 0;
  private stepAcc = 0;
  private dustTimer = 0;
  private raf = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;
  private stats = { kills: 0, shots: 0, hits: 0 };
  private mouseDown = false;
  private mousePressed = false;
  private rightDown = false;
  private hudTimer = 0;
  private netTimer = 0;
  private damageFlash = 0;
  private damageBearing = 0;
  private fps = 60;
  private rosterKey = "";
  private quality: "high" | "low" = "high";
  private pixelRatio = 1;
  private adaptiveTimer = 0;
  private smoothFrameTime = 1 / 60;
  private remoteList: PlayerSnapshot[] = [];
  private team: TeamOrSpectator = "blue";
  private match: MatchPayload = { mode: "rescue", blue: 0, red: 0, limit: 30, round: 1, ended: false, bluePlayers: 0, redPlayers: 0, capacity: 0 };
  private respawnAt = 0;
  private observer: ResizeObserver | null = null;
  private disposed = false;
  private contextLost = false;
  private lockPending = false;
  private fallbackLook = false;

  constructor(private options: EngineOptions) {
    hudStore.reset();
    this.mode = options.mode ?? "rescue";
    this.match = { ...this.match, mode: this.mode, capacity: this.mode === "deathmatch" ? 5 : 0 };
    this.solids = this.mode === "deathmatch" ? getArenaSolids() : getSolidAabbs();
    this.blockers = this.mode === "deathmatch" ? getArenaBlockers() : getBlockerAabbs();
    this.shotBlockers = this.mode === "deathmatch" ? getArenaShotBlockers() : getShotBlockers();
    this.barrels = new Barrels(this.scene, this.mode === "deathmatch" ? [] : undefined);
    this.loadout = options.loadout ?? { primary: "rifle", perk: "scout" };
    this.difficultyId = options.difficulty ?? "regular";
    const canvas = options.canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    // Supersampling at 2× DPR quadruples pixels; cap at 1.35 and adapt down
    // under load instead of sacrificing playability to a sharp idle menu.
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0xf6f3ec); this.renderer.autoClear = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(68, aspect, .07, 900); this.camera.rotation.order = "YXZ";
    // A separate near-field pass prevents the gun from clipping into walls.
    this.viewCamera = new THREE.PerspectiveCamera(55, aspect, .012, 15);
    this.viewScene.add(this.viewCamera);
    // The technical-drawing look uses contact ink, not a full shadow-map pass.
    // Keeping dynamic shadow maps off saves a second scene render on integrated GPUs.
    this.renderer.shadowMap.enabled = false;
    this.world = this.mode === "deathmatch" ? buildArenaWorld(this.scene) : buildWorld(this.scene);
    this.player = new Player(this.solids, this.world.ladders);
    this.player.respawn(this.mode === "deathmatch" ? spawnFor("blue", 0) : PLAYER_SPAWN, this.mode === "deathmatch" ? TEAM_META.blue.yaw : PLAYER_SPAWN_YAW);
    this.player.attach();
    this.applyPerkMods();
    this.weapon = new Weapon(this.viewCamera, (pitch, yaw) => {
      this.player.pitch = clamp(this.player.pitch + pitch, -1.5, 1.5); this.player.yaw += yaw;
    });
    this.weapon.setLoadout(this.loadout.primary, this.loadout.secondary ?? "pistol");
    this.viewCamera.add(this.cockpit); this.cockpit.visible = false;
    this.pickups = new Pickups(this.scene, this.mode === "deathmatch" ? ARENA_PICKUPS : undefined);
    this.bike = new BikeController(this.solids);
    this.tracers = new Tracers(this.scene); this.enemyTracers = new Tracers(this.scene, 0xb32222); this.impacts = new ImpactMarks(this.scene);
    this.enemies = new EnemyManager(this.scene, {
      onEnemyShot: (enemy, origin, dir, damage) => this.enemyShot(enemy.pos, origin, dir, damage),
      onEnemyKilled: () => { },
    }, this.mode === "deathmatch" ? [] : undefined);
    this.enemies.update(0, this.player.pos, false, () => { });
    this.hostage.group.position.set(...HOSTAGE.pos);
    if (this.mode === "rescue") this.scene.add(this.hostage.group);
    // Meta state from previous sessions.
    this.totalXp = loadTotalXp();
    this.unlocked = new Set(loadAchievements());
    const bests = loadBests();
    const persisted = loadPersistedSettings();
    playerSettings.sensitivity = persisted.sensitivity;
    playerSettings.invertY = persisted.invertY;
    sfx.setVolume(persisted.volume / 100, persisted.muted);
    this.applyQuality(persisted.quality);
    // Match connection starts only when the player deploys.
    window.addEventListener("resize", this.resize); window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
    window.addEventListener("blur", this.pauseOnBlur); document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp); document.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas); this.resize();
    const { level, into, need } = levelForXp(this.totalXp);
    hudStore.set({
      playerName: options.playerName, mode: this.mode,
      mission: this.mode === "rescue" ? "find_hostage" : "briefing", loadout: this.loadout,
      difficulty: this.difficultyId, bests, level, xpProgress: into / need,
      settings: { ...persisted }, contracts: this.contractHud(),
    });
    this.updateCamera(0); this.updateHud();
  }

  private connectMatch(): void {
    if (this.matchConnected) return;
    this.matchConnected = true;
    this.net.connect(this.options.socketUrl, this.options.playerName, {
      onInit: (id, players, match) => {
        const self = players.find(player => player.id === id);
        this.applyMatch(match, self?.team);
        if (self && self.team !== "spectator") {
          this.player.respawn(self.pos, self.yaw);
          this.protection = this.mode === "rescue" ? SPAWN_PROTECTION_SECONDS : 2.8;
        }
        if (self?.team === "spectator" && this.mode === "deathmatch") {
          this.player.setEnabled(false);
          hudStore.set({ status: "menu" });
          if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
        }
        hudStore.set({ connected: true }); this.applyRemotes(players);
      },
      onSnapshot: (players, match) => {
        this.applyMatch(match);
        this.applyRemotes(players);
        if (this.mode === "deathmatch") {
          const self = players.find(p => p.id === this.net.selfId);
          if (self?.alive && !this.player.alive && this.respawnAt) {
            this.player.respawn(self.pos, self.yaw);
            this.weapon.refillOwned();
            this.respawnAt = 0;
            this.protection = 2.8;
            this.player.setEnabled(document.pointerLockElement === this.options.canvas || this.fallbackLook);
            hudStore.banner("REDEPLOYED", `${TEAM_META[self.team as TeamId].name} SQUAD`);
            hudStore.set({ respawnSeconds: 0 });
          }
        }
      },
      onPlayerJoined: p => this.applyRemotes([...this.remoteList.filter(other => other.id !== p.id), p]),
      onPlayerLeft: ({ id }) => this.applyRemotes(this.remoteList.filter(p => p.id !== id)),
      onPlayerShot: (_id, origin, dir) => {
        const hit = raycastBoxes(origin, dir, this.blockers, 180);
        this.tracers.spawn(origin, hit ? hit.point : [origin[0] + dir[0] * 100, origin[1] + dir[1] * 100, origin[2] + dir[2] * 100]);
      },
      onPlayerHurt: (id, hp, byId, damage) => {
        if (id !== this.net.selfId || this.mode !== "deathmatch") return;
        // PvP health belongs to the server. Local perks/AI cannot overwrite it.
        this.player.health = Math.max(0, hp);
        this.damageFlash = Math.min(.7, this.damageFlash + damage / 90);
        const shooter = this.remoteList.find(p => p.id === byId);
        if (shooter) this.damageBearing = angleDelta(this.player.yaw, Math.atan2(-(shooter.pos[0] - this.player.pos[0]), -(shooter.pos[2] - this.player.pos[2])));
        sfx.hurt();
      },
      onPlayerDied: (payload) => {
        if (this.mode !== "deathmatch") return;
        const remote = this.remoteList.find(player => player.id === payload.victimId);
        if (remote) this.deathMarks.spawn(payload.victimId, remote.pos);
        if (payload.killerId === this.net.selfId && payload.victimId !== this.net.selfId) {
          this.stats.kills++;
          this.addScore(payload.headshot ? (XP.kill + XP.headshotBonus) : XP.kill, payload.headshot ? "HEADSHOT" : "OPERATIVE DOWN");
          this.registerKillStreak();
          if (payload.headshot) sfx.headshot(); else sfx.kill();
          hudStore.pushFeed(`You eliminated ${payload.victimName}`, "player");
          hudStore.triggerKillEmblem({
            victim: payload.victimName,
            headshot: !!payload.headshot,
            streak: this.run.streakCount,
            xp: payload.headshot ? 150 : 100,
          });
        }
        this.applyMatch({ mode: "deathmatch", ...payload.score, bluePlayers: this.match.bluePlayers, redPlayers: this.match.redPlayers, capacity: this.match.capacity });
        if (payload.victimId === this.net.selfId) this.queueTeamRespawn();
      },
      onMatchUpdate: match => { if (this.mode === "deathmatch") this.applyMatch(match); },
      onRoundEnded: payload => {
        if (this.mode !== "deathmatch") return;
        this.applyMatch({ mode: "deathmatch", ...payload.score, bluePlayers: this.match.bluePlayers, redPlayers: this.match.redPlayers, capacity: this.match.capacity });

        // 1. Release pointer lock & stop inputs
        if (document.pointerLockElement === this.options.canvas) {
          document.exitPointerLock();
        }
        this.player.setEnabled(false);
        this.mouseDown = false;
        this.mousePressed = false;
        this.rightDown = false;
        this.respawnAt = 0;

        // 2. Compute victory / defeat & performance stats
        const won = this.team === payload.winner;
        const myKills = this.stats.kills;
        const roster = hudStore.getSnapshot().roster;
        const myDeaths = Math.max(0, roster.find(p => p.id === this.net.selfId)?.deaths ?? 0);
        const kd = (myKills / Math.max(1, myDeaths)).toFixed(2);

        // 3. Award XP & check rank progression
        const baseMatchXp = won ? 500 : 250;
        const killXp = myKills * 50;
        const matchXpGained = baseMatchXp + killXp;

        const beforeRank = getRankForXp(this.totalXp).rank;
        this.totalXp += matchXpGained;
        saveTotalXp(this.totalXp);
        const afterRank = getRankForXp(this.totalXp).rank;
        if (afterRank.tier > beforeRank.tier) {
          const inv = loadInventory();
          inv.crates += 1;
          inv.keys += 1;
          saveInventory(inv);
          sfx.achievement();
          hudStore.achievement(`PROMOTED: ${afterRank.name}`, "+1 Weapon Case & +1 Key unlocked!");
          hudStore.banner(`RANK UP: ${afterRank.name}`, "+1 CASE & +1 KEY!");
        }

        // 4. Find MVP across both squads
        const allRoster = [...roster];
        if (!allRoster.some(p => p.id === this.net.selfId)) {
          allRoster.push({
            id: this.net.selfId ?? "player",
            name: this.options.playerName,
            kills: myKills,
            deaths: myDeaths,
            team: this.team,
            mode: "deathmatch",
            hp: this.player.health,
            alive: this.player.alive,
            moving: false,
            pos: this.player.pos,
            yaw: this.player.yaw,
            pitch: this.player.pitch,
          });
        }
        let mvpName = this.options.playerName;
        let mvpKills = myKills;
        for (const p of allRoster) {
          if (p.kills > mvpKills) {
            mvpName = p.name;
            mvpKills = p.kills;
          }
        }

        if (won) sfx.mission();
        else sfx.death();

        hudStore.set({
          status: "complete",
          mission: "complete",
          pointerLocked: false,
          respawnSeconds: 0,
          matchResult: {
            won,
            winner: payload.winner,
            playerTeam: this.team,
            blueScore: payload.score.blue,
            redScore: payload.score.red,
            kills: myKills,
            deaths: myDeaths,
            kd,
            xpGained: matchXpGained,
            totalXp: this.totalXp,
            rankName: afterRank.name,
            mvpName,
            mvpKills,
          },
        });
      },
      onConnect: () => hudStore.set({ connected: true }), onDisconnect: () => { hudStore.set({ connected: false }); this.applyRemotes([]); },
    }, this.mode);
  }

  get protected(): boolean {
    return (this.mode === "rescue" && isSafeZone(this.player.pos)) || this.protection > 0 || this.respawnAt > 0;
  }
  private difficulty() { return DIFFICULTIES.find(d => d.id === this.difficultyId) ?? DIFFICULTIES[1]; }

  private applyMatch(match: MatchPayload, team?: TeamOrSpectator): void {
    if (match.mode !== this.mode) return;
    const wasSpectator = this.team === "spectator";
    const changed = match.blue !== this.match.blue || match.red !== this.match.red ||
      match.round !== this.match.round || match.ended !== this.match.ended ||
      match.bluePlayers !== this.match.bluePlayers || match.redPlayers !== this.match.redPlayers ||
      (team !== undefined && team !== this.team);
    this.match = match;
    if (team) this.team = team;
    this.remotes.setLocalTeam(this.team);
    if (changed) hudStore.set({ team: this.team, match: this.match, mode: this.mode });
    if (this.mode === "deathmatch" && this.team === "spectator" && !wasSpectator) {
      hudStore.banner("MATCH FULL", "5 blue · 5 red · return when a slot opens");
    }
  }

  private queueTeamRespawn(delay = TEAM_RESPAWN_SECONDS): void {
    if (this.team === "spectator") { this.die(); return; }
    this.player.alive = false;
    this.player.setEnabled(false);
    this.mouseDown = false;
    this.rightDown = false;
    this.bike.speed = 0;
    this.respawnAt = performance.now() + delay * 1000;
    hudStore.banner("ELIMINATED", `redeploying in ${Math.ceil(delay)}s`);
    hudStore.set({ respawnSeconds: Math.ceil(delay) });
  }

  private processTeamRespawn(): boolean {
    if (!this.respawnAt) return false;
    const remaining = this.respawnAt - performance.now();
    if (remaining > 0) {
      hudStore.set({ respawnSeconds: Math.max(1, Math.ceil(remaining / 1000)) });
      this.updateCamera(0.016);
      return true;
    }
    const team = this.team as TeamId;
    const slot = (this.stats.kills + Math.floor(this.elapsed)) % 5;
    this.player.respawn(spawnFor(team, slot), TEAM_META[team].yaw);
    this.weapon.refillOwned();
    this.protection = 3;
    this.respawnAt = 0;
    this.player.setEnabled(document.pointerLockElement === this.options.canvas || this.fallbackLook);
    hudStore.banner("REDEPLOYED", `${TEAM_META[team].name} SQUAD`);
    hudStore.set({ respawnSeconds: 0 });
    sfx.interact();
    return false;
  }

  setPlayerName(name: string): void {
    this.options.playerName = name;
    this.net.updateName(name);
    hudStore.set({ playerName: name });
  }

  applyLoadout(loadout: Loadout, difficulty: DifficultyId): void {
    this.loadout = loadout;
    this.difficultyId = difficulty;
    this.weapon.setLoadout(loadout.primary, loadout.secondary ?? "pistol");
    this.applyPerkMods();
    hudStore.set({ loadout, difficulty, weaponKind: this.weapon.kind, weaponName: this.weapon.displayName, magazineSize: this.weapon.spec.magSize, inventory: [...this.weapon.inventory.keys()], ammo: this.weapon.ammo, reserve: this.weapon.reserve });
    this.updateHud();
  }

  private applyPerkMods(): void {
    if (this.mode === "deathmatch") {
      // Every 5v5 operative fights with the same movement and server health.
      this.player.mods = { speed: 1, regen: 0, armor: 0 };
      return;
    }
    const perk = this.loadout.perk;
    this.player.mods = {
      speed: perk === "scout" ? 1.1 : 1,
      regen: perk === "medic" ? 2 : 1,
      armor: perk === "armor" ? 0.3 : 0,
    };
  }

  applySettings(patch: Partial<{ sensitivity: number; volume: number; muted: boolean; invertY: boolean; quality: "high" | "low" }>): void {
    const current = hudStore.getSnapshot().settings;
    const next = { ...current, ...patch };
    playerSettings.sensitivity = next.sensitivity;
    playerSettings.invertY = next.invertY;
    sfx.setVolume(next.volume / 100, next.muted);
    this.applyQuality(next.quality);
    hudStore.set({ settings: next });
    savePersistedSettings(next);
  }

  private applyQuality(quality: "high" | "low"): void {
    this.quality = quality;
    this.pixelRatio = quality === "high" ? Math.min(window.devicePixelRatio || 1, 1.35) : Math.min(window.devicePixelRatio || 1, .9);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  /** Resolution scaling is almost invisible, but quickly frees GPU time. */
  private adaptResolution(rawFrameTime: number): void {
    this.smoothFrameTime = damp(this.smoothFrameTime, rawFrameTime, 1.8, rawFrameTime);
    this.fps = damp(this.fps, 1 / Math.max(.001, this.smoothFrameTime), 2.5, rawFrameTime);
    this.adaptiveTimer += rawFrameTime;
    if (this.adaptiveTimer < 1.25) return;
    this.adaptiveTimer = 0;
    const ceiling = Math.min(window.devicePixelRatio || 1, this.quality === "high" ? 1.35 : .9);
    let next = this.pixelRatio;
    if (this.smoothFrameTime > 1 / 46) next = Math.max(.68, this.pixelRatio - .12);
    else if (this.smoothFrameTime < 1 / 57) next = Math.min(ceiling, this.pixelRatio + .06);
    if (Math.abs(next - this.pixelRatio) > .01) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  start(): void {
    if (this.running) return; this.running = true; this.lastTime = performance.now(); this.raf = requestAnimationFrame(this.tick);
  }
  isTouchDevice(): boolean {
    return typeof window !== "undefined" && (("ontouchstart" in window) || navigator.maxTouchPoints > 0);
  }

  lock(): void {
    if (this.lockPending || this.disposed) return;
    if (this.matchConnected && this.team === "spectator") {
      hudStore.banner("MATCH FULL", "5 blue · 5 red · wait for a slot");
      hudStore.message("This 5v5 room is full. A spectator feed is reserved for you.");
      return;
    }
    this.connectMatch();
    this.player.setEnabled(true);
    hudStore.set({ status: "playing" });
    sfx.startAmbient();

    if (this.isTouchDevice()) {
      this.fallbackLook = true;
      this.lockPending = false;
      hudStore.set({ pointerLocked: false });
      return;
    }

    this.lockPending = true;
    try {
      const result = this.options.canvas.requestPointerLock?.();
      if (result) void result.catch(this.onPointerLockError);
      if (!this.options.canvas.requestPointerLock) this.onPointerLockError();
    } catch { this.onPointerLockError(); }
  }
  resume(): void { if (hudStore.getSnapshot().status === "paused") this.lock(); }
  pause(): void {
    if (hudStore.getSnapshot().status !== "playing") return;
    this.mouseDown = false; this.rightDown = false; this.player.setEnabled(false); hudStore.set({ status: "paused", pointerLocked: false, scoreboardOpen: false });
    sfx.motor(0, false);
    if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
  }
  toMenu(): void {
    this.net.dispose(); this.matchConnected = false; this.applyRemotes([]);
    this.team = "blue";
    this.match = { mode: this.mode, blue: 0, red: 0, limit: 30, round: 1, ended: false, bluePlayers: 0, redPlayers: 0, capacity: this.mode === "deathmatch" ? 5 : 0 };
    this.fullReset();
    hudStore.set({ status: "menu", mission: "briefing", prompt: null, connected: false, team: "blue", match: this.match, scoreboardOpen: false, matchResult: null, lastRun: null });
    if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
    this.updateHud();
    this.updateCamera(0);
  }
  private pauseOnBlur = () => { if (!this.isTouchDevice()) this.pause(); };
  private onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.disposed) return;
    this.contextLost = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.player.setEnabled(false);
    hudStore.set({ status: "paused", pointerLocked: false });
    hudStore.message("Graphics paused · restoring renderer…");
  };
  private onContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    this.renderer.resetState();
    this.resize();
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    hudStore.message("Graphics restored");
  };
  private onPointerLockError = () => {
    this.lockPending = false; this.fallbackLook = true; this.player.setEnabled(true);
    hudStore.set({ status: "playing", pointerLocked: false });
    if (!this.isTouchDevice()) hudStore.message("Hold the mouse to look around");
  };
  private onPointerLockChange = () => {
    if (this.isTouchDevice()) return;
    this.lockPending = false;
    const locked = document.pointerLockElement === this.options.canvas;
    hudStore.set({ pointerLocked: locked });
    if (locked) { this.fallbackLook = false; this.player.setEnabled(true); hudStore.set({ status: "playing" }); }
    else this.pause();
  };

  // Mobile / Touch controls
  setMobileFire(firing: boolean): void {
    if (firing) {
      this.mouseDown = true;
      this.mousePressed = true;
    } else {
      this.mouseDown = false;
    }
  }

  setMobileAim(aiming: boolean): void {
    this.rightDown = aiming;
  }

  mobileJump(): void {
    this.player.jump();
  }

  mobileReload(): void {
    if (this.bike.riding) { this.resetRide(); return; }
    if (this.weapon.reload()) sfx.reload();
  }

  mobileInteract(): void {
    this.interact();
  }

  mobileMove(forward: number, strafe: number): void {
    this.player.setMoveAxes(forward, strafe);
  }

  mobileLook(dx: number, dy: number): void {
    this.player.addLookDelta(dx, dy);
  }

  cycleWeapon(): void {
    const owned = SLOT_ORDER.filter(k => this.weapon.inventory.has(k));
    if (owned.length <= 1) return;
    const currentIdx = owned.indexOf(this.weapon.kind);
    const nextIdx = (currentIdx + 1) % owned.length;
    this.weapon.switch(owned[nextIdx]);
  }
  refreshWeaponSkin(): void {
    this.weapon.refreshSkinModel();
  }
  private onContextMenu = (event: Event) => { if (event.target === this.options.canvas || document.pointerLockElement === this.options.canvas) event.preventDefault(); };
  private onMouseDown = (event: MouseEvent) => {
    if (hudStore.getSnapshot().status !== "playing" || (!document.pointerLockElement && !this.fallbackLook)) return;
    if (event.button === 0) { this.mouseDown = true; this.mousePressed = true; }
    if (event.button === 2) this.rightDown = true;
  };
  private onMouseUp = (event: MouseEvent) => { if (event.button === 0) this.mouseDown = false; if (event.button === 2) this.rightDown = false; };
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Tab") {
      event.preventDefault();
      if (hudStore.getSnapshot().status === "playing" && !event.repeat) {
        hudStore.set({ scoreboardOpen: true });
      }
      return;
    }
    if (hudStore.getSnapshot().status !== "playing") return;
    if (event.code === "Escape") { this.pause(); return; }
    if (event.repeat) return;
    if (event.code === "KeyE") this.interact();
    if (event.code === "KeyM") {
      const s = hudStore.getSnapshot().settings;
      this.applySettings({ muted: !s.muted });
      hudStore.message(s.muted ? "Sound on" : "Sound off");
      return;
    }
    if (event.code === "KeyR") {
      if (this.bike.riding) { this.resetRide(); return; }
      if (this.weapon.reload()) sfx.reload();
    }
    const slot = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8"].indexOf(event.code);
    if (slot !== -1 && slot < SLOT_ORDER.length) {
      const kind: WeaponKind = SLOT_ORDER[slot];
      if (this.weapon.switch(kind)) { hudStore.message(`${WEAPONS[kind].name} equipped`); sfx.uiClick(); }
      else if (!this.weapon.inventory.has(kind)) hudStore.message("Weapon not in inventory");
    }
    this.updateHud();
  };
  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Tab") {
      event.preventDefault();
      if (hudStore.getSnapshot().scoreboardOpen) hudStore.set({ scoreboardOpen: false });
    }
  };
  private resize = () => {
    const width = Math.max(1, this.options.canvas.clientWidth), height = Math.max(1, this.options.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    for (const camera of [this.camera, this.viewCamera]) { camera.aspect = width / height; camera.updateProjectionMatrix(); }
  };

  private nearbyPickup(): Pickup | null {
    return this.bike.riding ? null : this.pickups.nearest(this.player.pos, this.player.lookDirection());
  }
  private hostageInRange(): boolean {
    return !this.rescued && Math.abs(this.player.pos[1] - this.hostagePos[1]) < 1.9 && distance(this.player.pos, this.hostagePos) < INTERACT_RANGE_HOSTAGE && hasLineOfSight(this.player.eyePosition(), [this.hostagePos[0], this.hostagePos[1] + 1.3, this.hostagePos[2]], this.blockers);
  }
  private bikeInRange(): boolean { return Math.abs(this.player.pos[1] - this.bike.pos[1]) < 1.8 && distance(this.player.pos, this.bike.pos) < INTERACT_RANGE_BIKE; }
  private interact(): void {
    if (!this.player.alive) return;
    if (this.mode === "deathmatch") {
      const supply = this.nearbyPickup();
      if (supply) {
        this.pickups.take(supply);
        hudStore.message(this.weapon.pickup(supply.kind));
        sfx.pickup();
      }
      return;
    }
    if (this.bike.riding) { this.dismount(); return; }
    if (this.hostageInRange()) {
      this.rescued = true; this.escortTrail = [[...this.player.pos]]; this.bike.checkpoint = 0;
      this.hostage.shoulderL.rotation.x = -.2; this.hostage.shoulderR.rotation.x = -.2;
      this.addScore(XP.rescue, "HOSTAGE SECURED");
      if (this.stats.shots === 0) this.completeContract("ghost");
      hudStore.set({ mission: "exfil" }); hudStore.message("Hostage secured. Return to the motorcycle."); sfx.interact(); return;
    }
    const pickup = this.nearbyPickup();
    if (pickup) {
      this.pickups.take(pickup);
      hudStore.message(this.weapon.pickup(pickup.kind));
      this.addScore(XP.pickup);
      sfx.pickup();
      if (this.weapon.inventory.size >= 4) this.unlock("fullArsenal");
      return;
    }
    if (this.bikeInRange()) {
      if (this.rescued && distance(this.player.pos, this.hostagePos) > 8) { hudStore.message("Wait for the hostage to catch up"); return; }
      this.bike.mount(); this.player.clearInput(); this.player.pos = [...this.bike.pos]; this.player.vel = [0, 0, 0];
      this.player.yaw = this.bike.yaw; this.player.pitch = -.06; this.weapon.aiming = false; this.rightDown = false; this.mouseDown = false;
      if (this.rescued) { this.bike.checkpoint = 0; hudStore.set({ mission: "ride" }); }
      hudStore.message(this.rescued ? "Ride through the checkpoints to extract" : "Practice ride · W accelerate · A/D steer · Space brake · LMB fire"); sfx.interact();
    }
  }
  private dismount(): void {
    if (Math.abs(this.bike.speed) > 2) { hudStore.message("Brake before getting off the motorcycle"); return; }
    let position: Vec3 | null = null;
    for (const side of [1, -1]) {
      const candidate: Vec3 = [this.bike.pos[0] + Math.cos(this.bike.yaw) * 1.8 * side, this.bike.pos[1] + .02, this.bike.pos[2] - Math.sin(this.bike.yaw) * 1.8 * side];
      if (!this.solids.some(b => aabbOverlap(actorBox(candidate, [.35, 0, .35], 1.8), b))) { position = candidate; break; }
    }
    if (!position) { hudStore.message("Move to an open space to dismount"); return; }
    this.bike.dismount(); this.player.pos = position; this.player.vel = [0, 0, 0]; this.player.pitch = 0;
    this.player.clearInput(); this.hostage.group.visible = true; sfx.motor(0, false);
    if (this.rescued) { this.hostagePos = [position[0] - .7, .02, position[2] + .6]; this.escortTrail = []; }
    hudStore.set({ mission: this.rescued ? "exfil" : "find_hostage" }); hudStore.message("On foot");
  }
  private resetRide(): void {
    this.bike.reset(); this.bike.mount(); this.player.pos = [...this.bike.pos]; this.player.yaw = this.bike.yaw; this.player.pitch = -.06;
    this.player.clearInput(); hudStore.message("Motorcycle returned to staging");
  }

  private addScore(points: number, banner?: string): void {
    this.run.score += points;
    if (this.mode === "deathmatch") {
      const beforeRank = getRankForXp(this.totalXp).rank;
      this.totalXp += points;
      saveTotalXp(this.totalXp);
      const afterRank = getRankForXp(this.totalXp).rank;
      if (afterRank.tier > beforeRank.tier) {
        const inv = loadInventory();
        inv.crates += 1;
        inv.keys += 1;
        saveInventory(inv);
        sfx.achievement();
        hudStore.achievement(`PROMOTED: ${afterRank.name}`, "+1 Weapon Case & +1 Key earned!");
        hudStore.banner(`RANK UP: ${afterRank.name}`, "+1 CASE & +1 KEY!");
      }
    }
    if (banner) hudStore.banner(banner, `+${points}`);
  }

  private registerKillStreak(): void {
    this.run.streakCount += 1;
    this.run.streakTimer = 4;
    const text = streakText(this.run.streakCount);
    if (text) {
      hudStore.streak(text);
      sfx.streak(this.run.streakCount);
      if (this.run.streakCount >= 3) hudStore.banner(text, "Keep it rolling");
    }
  }

  private progressContract(id: string, amount = 1): void {
    const state = this.run.contracts[id];
    if (!state || state.done) return;
    state.progress = Math.min(CONTRACTS.find(c => c.id === id)!.target, state.progress + amount);
    if (state.progress >= CONTRACTS.find(c => c.id === id)!.target) this.completeContract(id);
  }

  private completeContract(id: string): void {
    const state = this.run.contracts[id];
    const def = CONTRACTS.find(c => c.id === id);
    if (!state || !def || state.done) return;
    state.done = true;
    state.progress = def.target;
    this.run.score += def.reward;
    hudStore.banner(`CONTRACT · ${def.title}`, `+${def.reward}`);
    hudStore.pushFeed(`Contract complete: ${def.title}`, "info");
    sfx.achievement();
  }

  private unlock(id: string): void {
    if (this.unlocked.has(id)) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    this.unlocked.add(id);
    saveAchievements([...this.unlocked]);
    hudStore.achievement(def.title, def.desc);
    sfx.achievement();
  }

  private contractHud() {
    return CONTRACTS.map(def => ({
      id: def.id, title: def.title, desc: def.desc,
      progress: this.run.contracts[def.id]?.progress ?? 0, target: def.target,
      done: this.run.contracts[def.id]?.done ?? false,
    }));
  }

  private commitXp(multiplier: number): { gained: number; newLevel: number; leveled: boolean } {
    const gained = Math.round(this.run.score * this.difficulty().xpMul * multiplier);
    const beforeRank = getRankForXp(this.totalXp).rank;
    const before = levelForXp(this.totalXp).level;
    this.totalXp += gained;
    saveTotalXp(this.totalXp);
    const after = levelForXp(this.totalXp);
    const afterRank = getRankForXp(this.totalXp).rank;
    if (afterRank.tier > beforeRank.tier) {
      const inv = loadInventory();
      inv.crates += 1;
      inv.keys += 1;
      saveInventory(inv);
      sfx.achievement();
      hudStore.achievement(`PROMOTED: ${afterRank.name}`, "Rank Reward: +1 Weapon Case & +1 Key unlocked!");
      hudStore.banner(`RANK UP: ${afterRank.name}`, "+1 CASE & +1 KEY UNLOCKED!");
    } else if (after.level > before) {
      sfx.levelup();
      hudStore.achievement(`LEVEL ${after.level}`, "Operative rank increased");
    }
    hudStore.set({ level: after.level, xpProgress: after.into / after.need });
    return { gained, newLevel: after.level, leveled: after.level > before };
  }

  private completeMission(): void {
    if (hudStore.getSnapshot().status === "complete") return;
    const accuracy = this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0;
    const timeBonus = Math.max(0, Math.round((600 - this.elapsed) * 2));
    this.run.score += XP.mission + accuracy * 5 + timeBonus;
    const { gained } = this.commitXp(1);
    const contractsDone = CONTRACTS.filter(c => this.run.contracts[c.id]?.done).length;
    const run = {
      playerName: this.options.playerName, result: "accomplished", kills: this.stats.kills,
      timeMs: Math.round(this.elapsed * 1000), accuracy, score: this.run.score, xpGained: gained,
      headshots: this.run.headshots, contractsDone, difficulty: this.difficultyId, grade: gradeFor(this.run.score),
    };
    const bests: Bests = hudStore.getSnapshot().bests;
    const next: Bests = {
      bestTimeMs: bests.bestTimeMs === 0 ? run.timeMs : Math.min(bests.bestTimeMs, run.timeMs),
      bestKills: Math.max(bests.bestKills, run.kills),
      bestScore: Math.max(bests.bestScore, run.score),
      runs: bests.runs + 1,
      totalKills: bests.totalKills + run.kills,
    };
    saveBests(next);
    if (this.run.damageTaken <= 0) this.unlock("untouchable");
    if (run.timeMs < 360000) this.unlock("speedrunner");
    this.bike.speed = 0; this.player.setEnabled(false); this.mouseDown = false; sfx.motor(0, false);
    hudStore.set({ status: "complete", mission: "complete", lastRun: run, bests: next }); sfx.mission();
    this.net.sendMissionComplete({ name: run.playerName, timeMs: run.timeMs, kills: run.kills, accuracy: run.accuracy, score: run.score });
    void fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...run, difficulty: run.difficulty }) }).catch(() => { });
    void this.refreshLeaderboard();
    if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
  }

  async refreshLeaderboard(): Promise<void> {
    try {
      const response = await fetch("/api/leaderboard");
      if (response.ok) {
        const result = await response.json() as { runs?: LeaderboardEntry[] };
        if (Array.isArray(result.runs)) hudStore.set({ leaderboard: result.runs });
      }
    } catch { }
  }

  die(): void {
    if (!this.player.alive) return;
    // In 5v5, die and redeploy. Rescue retains its mission-failed debrief.
    if (this.mode === "deathmatch" && this.team !== "spectator") {
      this.deathMarks.spawn("player", this.player.pos);
      this.trauma = Math.min(1, this.trauma + 0.6);
      sfx.death();
      this.queueTeamRespawn();
      return;
    }
    this.player.alive = false; this.player.setEnabled(false); this.mouseDown = false; this.rightDown = false;
    this.bike.speed = 0; sfx.motor(0, false); this.deathMarks.spawn("player", this.player.pos);
    this.trauma = Math.min(1, this.trauma + 0.6);
    const accuracy = this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0;
    const { gained } = this.commitXp(0.5);
    const contractsDone = CONTRACTS.filter(c => this.run.contracts[c.id]?.done).length;
    const bests = hudStore.getSnapshot().bests;
    const next: Bests = { ...bests, totalKills: bests.totalKills + this.stats.kills };
    saveBests(next);
    hudStore.set({
      status: "dead", mission: "dead", health: 0, bests: next,
      lastRun: {
        playerName: this.options.playerName, result: "killed", kills: this.stats.kills,
        timeMs: Math.round(this.elapsed * 1000), accuracy, score: this.run.score, xpGained: gained,
        headshots: this.run.headshots, contractsDone, difficulty: this.difficultyId, grade: gradeFor(this.run.score),
      },
    });
    sfx.death();
    if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
  }

  private fullReset(): void {
    const team = this.team === "spectator" ? "blue" : this.team;
    this.player.respawn(this.mode === "deathmatch" ? spawnFor(team, 0) : PLAYER_SPAWN, this.mode === "deathmatch" ? TEAM_META[team].yaw : PLAYER_SPAWN_YAW);
    this.player.weaponSpeed = 1;
    this.protection = this.mode === "rescue" ? SPAWN_PROTECTION_SECONDS : 2.8;
    this.respawnAt = 0;
    this.bike.reset(); this.weapon.reset(); this.pickups.reset(); this.enemies.reset();
    this.pursuit.reset(); this.pursuitViews.sync(this.pursuit); this.deathMarks.reset(); this.particles.clear(); this.barrels.reset();
    this.finishing = false; this.finishTimer = 0;
    this.rescued = false; this.hostagePos = [...HOSTAGE.pos]; this.hostage.group.visible = true; this.escortTrail = [];
    this.stats = { kills: 0, shots: 0, hits: 0 }; this.elapsed = 0; this.damageFlash = 0; this.mouseDown = false; this.rightDown = false;
    this.trauma = 0; this.stepAcc = 0;
    this.run = { score: 0, headshots: 0, damageTaken: 0, ridersDown: 0, contracts: newContracts(), streakCount: 0, streakTimer: 0 };
  }

  respawn(): void {
    if (this.mode === "deathmatch") {
      this.net.sendRematch();
    }
    this.fullReset();
    hudStore.set({ status: "paused", mission: this.mode === "rescue" ? "find_hostage" : "briefing", lastRun: null, matchResult: null, hostageSecured: false, hitMarker: 0, streak: null, banner: null, killFeed: [], contracts: this.mode === "rescue" ? this.contractHud() : [], scoreboardOpen: false });
    this.updateHud(); this.updateCamera(0); this.lock();
  }
  restart(): void { this.respawn(); }

  private tick = (now: number) => {
    if (!this.running || this.disposed || this.contextLost) return;
    try {
      const rawFrameTime = Math.max(.001, (now - this.lastTime) / 1000);
      const dt = clamp(rawFrameTime, 0, .05);
      this.lastTime = now;
      this.adaptResolution(rawFrameTime);
      if (hudStore.getSnapshot().status === "playing") this.update(dt);
      this.remotes.update(dt, this.player.pos); this.tracers.update(dt); this.enemyTracers.update(dt); this.impacts.update(dt);
      this.particles.update(dt);
      this.world.update(dt, this.elapsed, this.bike.riding ? this.bike.checkpoint : -1);
      this.netTimer += dt;
      if (this.netTimer > .05) {
        this.netTimer = 0; this.net.sendMove({
          pos: this.player.pos, yaw: this.bike.riding ? this.bike.yaw : this.player.yaw, pitch: this.player.pitch, hp: Math.round(this.player.health),
          alive: this.player.alive, moving: this.bike.riding ? Math.abs(this.bike.speed) > .5 : Math.hypot(this.player.vel[0], this.player.vel[2]) > .4,
          riding: this.bike.riding, weapon: this.weapon.kind, protected: this.protected,
          crouching: this.player.crouching,
        });
      }
      this.renderer.clear(); this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth(); this.renderer.render(this.viewScene, this.viewCamera);
      this.raf = requestAnimationFrame(this.tick);
    } catch (error) {
      console.error("Game frame recovered from an error", error);
      this.running = false;
      this.player.setEnabled(false);
      hudStore.set({ status: "paused", pointerLocked: false });
      hudStore.message("Game paused after a graphics error · reload if it continues");
      if (document.pointerLockElement === this.options.canvas) document.exitPointerLock();
    }
  };

  private update(dt: number): void {
    this.elapsed += dt;
    if (this.processTeamRespawn()) {
      this.hudTimer += dt; if (this.hudTimer > .1) { this.hudTimer = 0; this.updateHud(); }
      return;
    }
    this.run.streakTimer = Math.max(0, this.run.streakTimer - dt);
    if (this.run.streakTimer === 0) this.run.streakCount = 0;
    if (!isSafeZone(this.player.pos)) this.protection = Math.max(0, this.protection - dt);
    if (this.bike.riding) {
      const oldYaw = this.bike.yaw;
      const result = this.bike.update(dt, this.finishing
        ? { throttle: false, brake: true, left: false, right: false, handbrake: true }
        : {
          throttle: this.player.isDown("KeyW") || this.player.isDown("ArrowUp"), brake: this.player.isDown("KeyS") || this.player.isDown("ArrowDown"),
          left: this.player.isDown("KeyA") || this.player.isDown("ArrowLeft"), right: this.player.isDown("KeyD") || this.player.isDown("ArrowRight"), handbrake: this.player.isDown("Space"),
        });
      this.player.yaw += this.bike.yaw - oldYaw;
      this.player.yaw = this.bike.yaw + clamp(angleDelta(this.bike.yaw, this.player.yaw), -1.2, 1.2);
      this.player.pitch = clamp(this.player.pitch, -.5, .4); this.player.pos = [...this.bike.pos];
      if (result.collision) { hudStore.message("Watch the road"); sfx.hurt(); this.trauma = Math.min(1, this.trauma + 0.35); }
      // Road dust while moving fast.
      this.dustTimer -= dt;
      if (Math.abs(this.bike.speed) > 9 && this.dustTimer <= 0) {
        this.dustTimer = 0.05;
        this.particles.burst([this.bike.pos[0], 0.25, this.bike.pos[2]], { count: 2, color: 0xb9b2a2, color2: 0xe5e0d2, speed: 1.5, up: 1.2, life: 0.7, gravity: 2 });
      }
      if (this.finishing) {
        this.finishTimer += dt;
        if (this.finishTimer > 1.2) this.completeMission();
      } else if (result.checkpointPassed) {
        sfx.checkpoint();
        this.addScore(XP.checkpoint);
        const gate = CHECKPOINTS[Math.min(this.bike.checkpoint - 1, CHECKPOINTS.length - 1)];
        this.particles.burst([gate[0], 2, gate[2]], { count: 22, color: 0x2a9d48, color2: 0xbfe6c8, speed: 5, up: 4, life: 0.9, gravity: 6 });
        if (this.bike.checkpoint >= CHECKPOINTS.length) {
          if (this.rescued) {
            this.finishing = true; this.finishTimer = 0;
            hudStore.message("EXTRACTION · HOLD ON");
          } else hudStore.message("Practice complete · R returns to staging");
        } else hudStore.message(`Checkpoint ${this.bike.checkpoint} / ${CHECKPOINTS.length}`);
      }
      sfx.motor(Math.abs(this.bike.speed) / 24, hudStore.getSnapshot().status === "playing");
    } else {
      // The SVD is long and front-heavy. Carrying it slows movement, and
      // looking through the optic slows further so precision has a real cost.
      this.player.weaponSpeed = weaponMoveMultiplier(this.weapon.kind, this.rightDown);
      this.player.update(dt);
    }
    // Motorised pursuit: riders close in from behind and trade fire on the road.
    if (this.bike.riding) {
      this.pursuit.update(dt, this.player.pos, this.player.alive, this.roadPath, {
        onShot: (rider, origin, dir) => {
          this.enemyShot(rider.pos, origin, dir, rider.damage);
          const { hit } = enemyBulletHitsPlayer(origin, dir, [this.player.pos[0], this.player.pos[1] + .35, this.player.pos[2]], this.blockers, .5, 1.4);
          if (hit) this.onPlayerHit(rider.damage, rider.pos);
        },
        onKilled: () => { },
      });
      this.pursuitViews.sync(this.pursuit);
    }
    this.pursuitViews.update();
    const moving = Math.hypot(this.player.vel[0], this.player.vel[2]) > .4;
    this.weapon.aiming = this.rightDown && !this.player.sprinting && !this.bike.riding;
    this.weapon.update(dt, { moving: !this.bike.riding && moving, sprinting: this.player.sprinting, grounded: this.player.grounded, riding: this.bike.riding });
    this.updateCamera(dt);
    const wantFire = this.mouseDown && this.player.alive && (this.weapon.spec.auto || this.mousePressed);
    if (wantFire) {
      const fired = this.shoot();
      if (!fired && this.weapon.ammo === 0 && !this.weapon.reloading) {
        if (this.mousePressed) sfx.empty();
        if (this.weapon.reload()) sfx.reload();
      } else if (this.weapon.ammo === 0 && !this.weapon.reloading && this.weapon.reload()) sfx.reload();
    }
    this.mousePressed = false;
    // Footsteps.
    if (!this.bike.riding && moving && this.player.grounded && this.player.alive) {
      this.stepAcc += Math.hypot(this.player.vel[0], this.player.vel[2]) * dt;
      if (this.stepAcc > (this.player.sprinting ? 2.8 : 2.2)) {
        this.stepAcc = 0;
        sfx.step(this.player.sprinting);
      }
    } else this.stepAcc = 0;
    if (this.mode === "rescue") {
      this.enemies.update(dt, this.player.pos, this.player.alive && !this.protected, (damage, from) => this.onPlayerHit(damage, from));
      this.updateHostage(dt);
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    // HUD, score and canvas minimap need 10Hz, not 22 React/canvas rebuilds a second.
    this.hudTimer += dt; if (this.hudTimer > .1) { this.hudTimer = 0; this.updateHud(); }
  }

  private updateCamera(dt: number): void {
    const player = this.player;
    const eye = player.eyePosition();
    const moving = player.grounded && Math.hypot(player.vel[0], player.vel[2]) > .5;
    const shake = this.trauma * this.trauma;
    const shX = (Math.random() - .5) * shake * 0.12;
    const shY = (Math.random() - .5) * shake * 0.12;
    this.camera.position.set(eye[0] + shX, eye[1] + (this.bike.riding ? .12 : 0) + (moving && !this.bike.riding ? Math.sin(player.bobPhase) * .017 : 0) - player.landDip + shY, eye[2]);
    this.camera.rotation.set(player.pitch + (Math.random() - .5) * shake * 0.02, player.yaw, this.bike.riding ? this.bike.lean * .38 : 0);
    const fov = this.bike.riding ? 68 + Math.abs(this.bike.speed) * .15 : this.weapon.aiming ? this.weapon.spec.zoom : 68;
    this.camera.fov = dt ? damp(this.camera.fov, fov, 11, dt) : fov; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    // A clean optic view must not render the first-person gun over the scope or when riding the motorcycle.
    this.weapon.group.visible = !this.weapon.scoped && !this.bike.riding;
    // Decoupled motorcycle cockpit: handlebars stay anchored to bike chassis and heading,
    // allowing the rider to look freely around in 3D without handlebars turning with the head.
    if (this.bike.riding) {
      const relYaw = angleDelta(player.yaw, this.bike.yaw);
      const inFront = Math.cos(relYaw) > -0.2;
      this.cockpit.visible = inFront;
      if (inFront) {
        const dist = 0.95;
        this.cockpit.position.set(
          -Math.sin(relYaw) * dist,
          -0.28 + player.pitch * 0.45,
          -Math.cos(relYaw) * dist
        );
        this.cockpit.rotation.order = "YXZ";
        this.cockpit.rotation.set(
          -player.pitch,
          relYaw - this.bike.steering * 0.15,
          this.bike.lean * 0.25
        );
      }
    } else {
      this.cockpit.visible = false;
    }
    this.viewCamera.updateMatrixWorld(true);
    this.world.bike.visible = !this.bike.riding;
    this.world.bike.position.set(...this.bike.pos); this.world.bike.rotation.set(0, this.bike.yaw, this.bike.lean);
    this.world.bikePosition = [...this.bike.pos];
    const wheels = this.world.bike.userData.wheels as THREE.Group[]; wheels.forEach(w => w.rotation.x = this.bike.wheelAngle);
  }

  private updateHud(): void {
    const state = hudStore.getSnapshot();
    let target: Vec3 = this.hostagePos;
    let objective = "Rescue the hostage";
    let prompt: string | null = null;
    const rivals = this.mode === "deathmatch"
      ? this.remoteList.filter(p => p.alive && p.team !== this.team && p.team !== "spectator")
      : [];
    if (this.mode === "deathmatch") {
      const closest = rivals.reduce<PlayerSnapshot | null>((best, p) => !best || distance(this.player.pos, p.pos) < distance(this.player.pos, best.pos) ? p : best, null);
      target = closest?.pos ?? [0, 0, 0];
      objective = this.match.ended ? "Round complete" : closest ? "Eliminate the opposing squad" : "Waiting for opposing players";
      const pickup = this.nearbyPickup();
      if (pickup) prompt = `E · ${pickup.kind === "ammo" ? "Collect ammunition" : `Pick up ${WEAPONS[pickup.kind].name}`}`;
      else if (this.player.onLadder) prompt = "Look up / down to climb · Space to jump off";
    } else {
      if (this.bike.riding) {
        const end = this.bike.checkpoint >= CHECKPOINTS.length;
        target = CHECKPOINTS[Math.min(this.bike.checkpoint, CHECKPOINTS.length - 1)];
        objective = end ? "Practice complete" : this.rescued ? "Ride to extraction" : "Practice ride";
        prompt = Math.abs(this.bike.speed) < 2 ? "E · Dismount" : null;
      } else if (this.rescued) { target = this.bike.pos; objective = "Return to the motorcycle"; }
      if (!this.bike.riding) {
        const pickup = this.nearbyPickup();
        if (this.hostageInRange()) prompt = "E · Rescue hostage";
        else if (pickup) prompt = `E · ${pickup.kind === "ammo" ? "Collect ammunition" : `Pick up ${WEAPONS[pickup.kind].name}`}`;
        else if (this.bikeInRange()) prompt = `E · ${this.rescued ? "Ride with hostage" : "Ride motorcycle"}`;
        else if (this.player.onLadder) prompt = "Look up / down to climb · Space to jump off";
      }
    }
    const yaw = Math.atan2(-(target[0] - this.player.pos[0]), -(target[2] - this.player.pos[2]));
    hudStore.set({
      mode: this.mode,
      health: Math.round(this.player.health), ammo: this.weapon.ammo, reserve: this.weapon.reserve, reloading: this.weapon.reloading, reloadProgress: this.weapon.reloadProgress,
      weaponKind: this.weapon.kind, weaponName: this.weapon.displayName, magazineSize: this.weapon.spec.magSize, inventory: [...this.weapon.inventory.keys()],
      objective, objectiveDistance: Math.round(distance(this.player.pos, target)), objectiveBearing: angleDelta(this.player.yaw, yaw), prompt,
      missionTimeMs: Math.round(this.elapsed * 1000), kills: this.stats.kills, shots: this.stats.shots, hits: this.stats.hits,
      playersOnline: this.remotes.count + 1, connected: this.net.connected,
      sniperAim: this.mode === "rescue" && !this.protected ? this.enemies.sniperAim() : null,
      damageFlash: this.damageFlash, damageBearing: this.damageBearing, fps: Math.round(this.fps), crosshair: this.weapon.aiming ? 0 : .25,
      hostageSecured: this.mode === "rescue" && this.rescued,
      safeZone: this.mode === "rescue" && isSafeZone(this.player.pos), spawnProtection: Math.ceil(this.protection),
      riding: this.bike.riding, speed: Math.round(Math.abs(this.bike.speed) * 3.6), checkpoint: this.bike.checkpoint,
      totalCheckpoints: CHECKPOINTS.length, aiming: this.weapon.aiming, pursuers: this.mode === "rescue" ? this.pursuit.alive : 0,
      score: this.run.score, contracts: this.mode === "rescue" ? this.contractHud() : [], team: this.team, match: this.match,
      respawnSeconds: this.respawnAt ? Math.max(1, Math.ceil((this.respawnAt - performance.now()) / 1000)) : 0,
      minimap: {
        mode: this.mode, team: this.team,
        player: [...this.player.pos], yaw: this.player.yaw, hostage: [...this.hostagePos], bike: [...this.bike.pos], rescued: this.rescued,
        enemies: this.mode === "rescue"
          ? this.enemies.snapshot().filter(e => e.alive).map(e => ({ x: e.x, z: e.z, sniper: e.sniper }))
          : rivals.map(p => ({ x: p.pos[0], z: p.pos[2], sniper: false })),
        riders: this.mode === "rescue" ? this.pursuit.entries.filter(e => e.alive).map(e => ({ x: e.pos[0], z: e.pos[2], ace: e.ace })) : [],
        friendlies: this.remoteList.filter(p => p.alive && (this.mode === "rescue" || p.team === this.team)).map(p => ({ x: p.pos[0], z: p.pos[2] })),
        checkIndex: this.bike.checkpoint,
      },
      ...(state.status === "complete" ? { prompt: null } : {}),
    });
  }

  private shoot(): boolean {
    // Sample the sight line before Weapon.fire() applies visual recoil. This
    // keeps a scoped shot exactly on the reticle; recoil affects the next view,
    // never the current bullet.
    const origin = this.player.eyePosition();
    const look = this.player.lookDirection();
    if (!this.weapon.fire()) return false;
    if (!isSafeZone(this.player.pos)) this.protection = 0;
    const spec = this.weapon.spec;
    const moving = Math.hypot(this.player.vel[0], this.player.vel[2]) > .5;
    const ridePenalty = this.bike.riding ? 2.4 : 1;
    const spread = this.weapon.spread(moving, this.player.sprinting || this.bike.riding) * ridePenalty;
    this.weapon.muzzle.getWorldPosition(this.scratchMuzzle);
    this.scratchMuzzle.applyQuaternion(this.camera.quaternion).add(this.camera.position);
    const muzzlePos: Vec3 = [this.scratchMuzzle.x, this.scratchMuzzle.y, this.scratchMuzzle.z];
    this.particles.burst(muzzlePos, { count: spec.pellets > 1 ? 10 : 5, color: 0xe8a020, color2: 0x555555, speed: 3, up: 1, life: 0.25, gravity: 4 });
    this.trauma = Math.min(1, this.trauma + (this.weapon.kind === "sniper" ? 0.16 : this.weapon.kind === "shotgun" ? 0.2 : 0.05));
    let anyHit = false;
    const pellets = spec.pellets;
    for (let i = 0; i < pellets; i++) {
      const dir = applySpread(look, spread);
      if (i === 0) this.net.sendShot(origin, dir);
      const wall = raycastBoxes(origin, dir, this.shotBlockers, TUNING.rifle.range);
      const enemy = this.enemies.raycast(origin, dir, wall?.t ?? TUNING.rifle.range);
      const rider = this.pursuit.raycast(origin, dir, enemy?.distance ?? wall?.t ?? TUNING.rifle.range);
      const other = this.remotes.raycast(origin, dir, Math.min(enemy?.distance ?? Infinity, rider?.distance ?? Infinity, wall?.t ?? TUNING.rifle.range));
      let end: Vec3 = wall?.point ?? [origin[0] + dir[0] * 200, origin[1] + dir[1] * 200, origin[2] + dir[2] * 200];
      // Nearest actor wins; the wall only absorbs the bullet when nothing stands before it.
      const targets = ([
        rider ? { kind: "rider" as const, distance: rider.distance, point: rider.point, id: rider.id } : null,
        other ? { kind: "player" as const, distance: other.distance, point: other.point, id: other.id } : null,
        enemy ? { kind: "ai" as const, distance: enemy.distance, point: enemy.point, id: enemy.id } : null,
      ].filter(Boolean) as { kind: "rider" | "player" | "ai"; distance: number; point: Vec3; id: string }[]).sort((a, b) => a.distance - b.distance);
      const target = targets[0];
      if (target) {
        end = target.point; anyHit = true;
        if (target.kind === "rider") {
          const result = this.pursuit.damage(target.id, spec.damage * (this.weapon.kind === "sniper" ? 2 : 1));
          if (result) this.pursuitEvents(result);
          this.particles.burst(end, { count: 4, color: 0xc1121f, color2: 0x333333, speed: 3, life: 0.4 });
        } else if (target.kind === "player") this.net.sendHit(target.id, spec.damage);
        else {
          const headshot = enemy?.headshot ?? false;
          const isLeg = enemy ? (target.point[1] - enemy.pos[1] < 0.72) : false;
          let mult = headshot ? (this.weapon.kind === "shotgun" ? 1.5 : 3) : 1;
          if (this.weapon.kind === "awp" && isLeg) mult = 85 / spec.damage; // AWP leg shot deals 85 dmg (target survives at 100 HP)
          const result = this.enemies.damage(target.id, spec.damage * mult);
          if (headshot) sfx.headshot(); else sfx.hit();
          this.particles.burst(end, { count: 5, color: 0xc1121f, color2: 0x555555, speed: 3.5, life: 0.45 });
          if (result?.killed) {
            this.stats.kills++;
            this.pickups.drop(result.enemy.kind === "sniper" ? "sniper" : "smg", result.enemy.pos);
            this.deathMarks.spawn(result.enemy.id, result.enemy.pos);
            this.particles.burst([result.enemy.pos[0], 1, result.enemy.pos[2]], { count: 14, color: 0xc1121f, color2: 0x7a0d14, speed: 4, life: 0.7 });
            sfx.kill();
            if (headshot) {
              this.run.headshots++;
              this.addScore(XP.kill + XP.headshotBonus, "HEADSHOT");
              this.progressContract("headhunter");
              if (this.run.headshots >= 3) this.unlock("sharpshooter");
            } else this.addScore(XP.kill, result.enemy.kind === "sniper" ? "SNIPER DOWN" : undefined);
            this.registerKillStreak();
            this.unlock("firstBlood");
            hudStore.pushFeed(`${headshot ? "Headshot" : "Eliminated"} · ${result.enemy.kind === "sniper" ? "sniper" : "guard"}`, "enemy");
            hudStore.triggerKillEmblem({
              victim: result.enemy.kind === "sniper" ? "TOWER SNIPER" : "SECTOR GUARD",
              headshot,
              streak: this.run.streakCount,
              xp: headshot ? (XP.kill + XP.headshotBonus) : XP.kill,
            });
          }
        }
      } else if (wall) {
        const barrel = this.barrels.hitByBox(wall.box);
        if (barrel) this.explodeBarrel(barrel);
        else {
          this.impacts.spawn(wall.point, wall.normal);
          this.particles.burst(wall.point, { count: 4, color: 0x777777, color2: 0xbbbbbb, speed: 3, life: 0.3 });
        }
      }
      this.tracers.spawn(muzzlePos, end);
    }
    this.stats.shots++; if (anyHit) { this.stats.hits++; hudStore.set({ hitMarker: performance.now() }); }
    this.enemies.alertNear(origin, 20);
    if (this.weapon.kind === "shotgun") sfx.shotShotgun();
    else if (this.weapon.kind === "pistol") sfx.shotPistol();
    else if (this.weapon.kind === "deagle") sfx.shotDeagle();
    else if (this.weapon.kind === "awp") sfx.shotAwp();
    else if (this.weapon.kind === "p90") sfx.shotP90();
    else if (this.weapon.kind === "sniper") sfx.sniperShot(0);
    else sfx.shot();
    return true;
  }

  /** Detonate a drum: blast everything nearby and chain to close drums. */
  private explodeBarrel(barrel: Barrel, depth = 0): void {
    if (!barrel.alive) return;
    this.barrels.destroy(barrel);
    const centre: Vec3 = [barrel.pos[0], barrel.pos[1] + 0.5, barrel.pos[2]];
    // Sight checks start above the drum: the drum itself is solid geometry.
    const losOrigin: Vec3 = [barrel.pos[0], barrel.pos[1] + 1.35, barrel.pos[2]];
    const R = 6.5;
    // The drum has just been destroyed, so exclude only its own old AABB from
    // blast LOS; every other opaque wall/vehicle still shields the target.
    const blastBlockers = this.blockers.filter(box => {
      const bx = (box.min[0] + box.max[0]) / 2;
      const bz = (box.min[2] + box.max[2]) / 2;
      return Math.abs(bx - barrel.pos[0]) > 0.02 || Math.abs(bz - barrel.pos[2]) > 0.02;
    });
    this.particles.burst(centre, { count: 46, color: 0xe84c1a, color2: 0x333333, speed: 9, up: 5, life: 0.8, gravity: 7 });
    this.particles.burst(centre, { count: 22, color: 0x555555, color2: 0xbbbbbb, speed: 5, up: 6, life: 1.4, gravity: 2 });
    this.trauma = Math.min(1, this.trauma + 0.55);
    sfx.sniperShot(0);
    hudStore.banner("BOOM", "explosive barrel");
    for (const enemy of this.enemies.enemies) {
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.pos[0] - centre[0], enemy.pos[1] - centre[1], enemy.pos[2] - centre[2]);
      if (d > R || !hasLineOfSight(losOrigin, [enemy.pos[0], enemy.pos[1] + 1.1, enemy.pos[2]], blastBlockers)) continue;
      const result = this.enemies.damage(enemy.id, Math.round(160 * (1 - d / R)) + 20);
      if (result?.killed) {
        this.stats.kills++;
        this.pickups.drop(Math.random() > 0.5 ? "smg" : "ammo", enemy.pos);
        this.deathMarks.spawn(enemy.id, enemy.pos);
        this.particles.burst([enemy.pos[0], 1, enemy.pos[2]], { count: 14, color: 0xc1121f, color2: 0x7a0d14, speed: 4, life: 0.7 });
        this.addScore(XP.kill, "BLOWN AWAY");
        this.registerKillStreak();
        this.unlock("firstBlood");
        sfx.kill();
        hudStore.pushFeed("Barrel blast · guard down", "enemy");
        hudStore.triggerKillEmblem({
          victim: enemy.kind === "sniper" ? "TOWER SNIPER" : "SECTOR GUARD",
          headshot: false,
          streak: this.run.streakCount,
          xp: XP.kill,
          title: "BLOWN AWAY",
        });
      } else sfx.hit();
    }
    const playerDistance = Math.hypot(this.player.pos[0] - centre[0], this.player.pos[1] - centre[1], this.player.pos[2] - centre[2]);
    if (playerDistance < R && hasLineOfSight(losOrigin, this.player.eyePosition(), blastBlockers)) {
      this.onPlayerHit(Math.round(140 * (1 - playerDistance / R)) + 10, centre);
    }
    if (depth < 3) {
      for (const other of this.barrels.items) {
        if (!other.alive) continue;
        if (Math.hypot(other.pos[0] - centre[0], other.pos[2] - centre[2]) < R) {
          this.explodeBarrel(other, depth + 1);
          break;
        }
      }
    }
  }

  private pursuitEvents(result: { killed: boolean; pursuer: import("./pursuit").PursuerState }): void {
    if (result.killed) {
      this.stats.kills++; this.run.ridersDown++;
      const bonus = result.pursuer.ace ? XP.rider + XP.aceBonus : XP.rider;
      this.addScore(bonus, result.pursuer.ace ? "ACE DOWN" : "RIDER DOWN");
      this.registerKillStreak();
      hudStore.pushFeed(result.pursuer.ace ? "Ace rider down" : "Rider down", "enemy");
      sfx.kill();
      this.particles.burst([result.pursuer.pos[0], 1, result.pursuer.pos[2]], { count: 16, color: 0xc1121f, color2: 0x333333, speed: 5, life: 0.7 });
      this.pickups.drop(Math.random() > .5 ? "smg" : "ammo", result.pursuer.pos);
      this.deathMarks.spawn(result.pursuer.id, result.pursuer.pos);
      this.progressContract("roadwarrior");
      this.unlock("firstBlood");
      if (result.pursuer.ace) this.unlock("aceSlayer");
      hudStore.triggerKillEmblem({
        victim: result.pursuer.ace ? "ACE HOSTILE RIDER" : "HOSTILE RIDER",
        headshot: false,
        streak: this.run.streakCount,
        xp: bonus,
        title: result.pursuer.ace ? "ACE DOWN" : "NEUTRALIZED",
      });
    }
    else sfx.hit();
  }

  private enemyShot(from: Vec3, origin: Vec3, dir: Vec3, damage: number): void {
    const hit = raycastBoxes(origin, dir, this.shotBlockers, 180), range = hit?.t ?? 100;
    this.enemyTracers.spawn(origin, hit?.point ?? [origin[0] + dir[0] * range, origin[1] + dir[1] * range, origin[2] + dir[2] * range]);
    if (damage > 30) sfx.sniperShot(distance(from, this.player.pos)); else sfx.enemyShot(distance(from, this.player.pos));
  }

  private onPlayerHit(damage: number, from: Vec3): void {
    if (this.mode !== "rescue") return;
    if (!this.player.alive || this.protected || hudStore.getSnapshot().status !== "playing") return;
    const scaled = damage * this.difficulty().damageMul;
    this.player.applyDamage(scaled, from);
    this.run.damageTaken += scaled;
    this.damageFlash = Math.min(.7, this.damageFlash + scaled / 90);
    this.trauma = Math.min(1, this.trauma + scaled / 140);
    this.damageBearing = angleDelta(this.player.yaw, this.player.lastDamageBearing); sfx.hurt();
    if (this.player.health <= 0) this.die();
  }

  private updateHostage(dt: number): void {
    if (!this.rescued) {
      this.hostagePos = [...HOSTAGE.pos]; this.hostage.shoulderL.rotation.x = -2.65; this.hostage.shoulderR.rotation.x = -2.65;
    } else if (this.bike.riding) {
      this.hostagePos = [...this.bike.pos]; this.hostage.group.visible = false; return;
    } else {
      this.hostage.group.visible = true;
      const last = this.escortTrail[this.escortTrail.length - 1] ?? this.hostagePos;
      if (distance(last, this.player.pos) > .6) this.escortTrail.push([...this.player.pos]);
      if (this.escortTrail.length > 700) this.escortTrail.shift();
      if (distance(this.hostagePos, this.player.pos) > 2.1 && this.escortTrail.length) {
        const target = this.escortTrail[0], dx = target[0] - this.hostagePos[0], dz = target[2] - this.hostagePos[2], d = Math.hypot(dx, dz);
        if (d < .3) this.escortTrail.shift();
        else {
          const speed = Math.min(8.7, d / Math.max(dt, .001));
          const velocity: Vec3 = [dx / d * speed, -.6, dz / d * speed];
          moveAndCollide(this.hostagePos, [.25, 0, .25], 1.65, velocity, dt, this.solids);
          this.hostage.group.rotation.y = Math.atan2(-dx, -dz);
          this.hostage.hipL.rotation.x = Math.sin(this.elapsed * 11) * .45; this.hostage.hipR.rotation.x = -this.hostage.hipL.rotation.x;
        }
      } else { this.hostage.hipL.rotation.x = 0; this.hostage.hipR.rotation.x = 0; }
    }
    this.hostage.group.position.set(...this.hostagePos);
  }

  private applyRemotes(players: PlayerSnapshot[]): void {
    const inRoom = players.filter(p => p.mode === this.mode);
    this.remoteList = inRoom.filter(p => p.id !== this.net.selfId);
    this.remotes.sync(this.remoteList);
    const rosterKey = inRoom.map(p => `${p.id}:${p.name}:${p.team}:${p.alive}:${p.hp}:${p.kills}:${p.deaths}`).sort().join("|");
    if (rosterKey !== this.rosterKey) {
      this.rosterKey = rosterKey;
      hudStore.set({ roster: inRoom });
    }
    for (const player of this.remoteList) if (!player.alive) this.deathMarks.spawn(player.id, player.pos);
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.running = false; cancelAnimationFrame(this.raf); this.observer?.disconnect();
    this.options.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.options.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    window.removeEventListener("resize", this.resize); window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp); window.removeEventListener("blur", this.pauseOnBlur);
    document.removeEventListener("mousedown", this.onMouseDown); document.removeEventListener("mouseup", this.onMouseUp); document.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange); document.removeEventListener("pointerlockerror", this.onPointerLockError);
    this.player.detach(); this.net.dispose(); this.remotes.dispose(); this.enemies.dispose(); this.pickups.dispose(); this.tracers.dispose(); this.enemyTracers.dispose(); this.impacts.dispose();
    this.weapon.dispose(); this.pursuitViews.dispose(); this.deathMarks.dispose(); this.particles.dispose(); this.barrels.dispose(); disposeObject(this.cockpit); disposeObject(this.hostage.group); this.world.dispose();
    this.renderer.setAnimationLoop(null);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.scene.clear(); this.viewScene.clear();
    sfx.motor(0, false);
  }
}
