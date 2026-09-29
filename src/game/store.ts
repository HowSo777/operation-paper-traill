import type { Bests } from "./progression";
import type { MatchPayload, PlayerSnapshot } from "./protocol";
import type { DifficultyId, GameMode, Loadout, TeamOrSpectator, Vec3, WeaponKind } from "./types";

export type KillFeedEntry = { id: number; text: string; kind: "enemy" | "player" | "info" };
export type MissionState = "briefing" | "find_hostage" | "exfil" | "ride" | "complete" | "dead";
export type GameStatus = "menu" | "playing" | "paused" | "complete" | "dead";
export type RunResult = {
  playerName: string; result: string; kills: number; timeMs: number; accuracy: number;
  score: number; xpGained: number; headshots: number; contractsDone: number;
  difficulty: DifficultyId; grade: string;
};
export type LeaderboardEntry = RunResult & { id: number };
export type ContractHud = { id: string; title: string; desc: string; progress: number; target: number; done: boolean };
export type MinimapState = {
  mode: GameMode; team: TeamOrSpectator;
  player: Vec3; yaw: number; hostage: Vec3; bike: Vec3; rescued: boolean;
  enemies: { x: number; z: number; sniper: boolean }[];
  riders: { x: number; z: number; ace: boolean }[];
  friendlies: { x: number; z: number }[];
  checkIndex: number;
};
export type HudSettings = { sensitivity: number; volume: number; muted: boolean; invertY: boolean; quality: "high" | "low" };
export type HudState = {
  mode: GameMode;
  status: GameStatus; mission: MissionState; health: number; ammo: number; reserve: number;
  reloading: boolean; reloadProgress: number; weaponName: string; weaponKind: WeaponKind; magazineSize: number;
  inventory: WeaponKind[]; objective: string; objectiveDistance: number; objectiveBearing: number;
  prompt: string | null; hitMarker: number; killFeed: KillFeedEntry[]; missionTimeMs: number;
  kills: number; shots: number; hits: number; playersOnline: number; connected: boolean; playerName: string;
  message: string | null; messageAt: number; damageFlash: number; damageBearing: number; sniperAim: number | null;
  lastRun: RunResult | null; leaderboard: LeaderboardEntry[]; fps: number; pointerLocked: boolean;
  crosshair: number; hostageSecured: boolean; safeZone: boolean; spawnProtection: number;
  riding: boolean; speed: number; checkpoint: number; totalCheckpoints: number; aiming: boolean; pursuers: number;
  score: number; level: number; xpProgress: number;
  streak: { text: string; at: number } | null;
  banner: { title: string; sub: string; id: number } | null;
  contracts: ContractHud[];
  achievement: { title: string; desc: string; id: number } | null;
  minimap: MinimapState | null;
  loadout: Loadout; difficulty: DifficultyId; settings: HudSettings; bests: Bests;
  team: TeamOrSpectator; match: MatchPayload; respawnSeconds: number; roster: PlayerSnapshot[];
  scoreboardOpen: boolean;
};
const initial: HudState = {
  mode: "rescue",
  status: "menu", mission: "briefing", health: 100, ammo: 30, reserve: 120, reloading: false, reloadProgress: 0,
  weaponName: "AK-47", weaponKind: "rifle", magazineSize: 30, inventory: ["rifle"], objective: "Rescue the hostage",
  objectiveDistance: 93, objectiveBearing: 0, prompt: null, hitMarker: 0, killFeed: [], missionTimeMs: 0,
  kills: 0, shots: 0, hits: 0, playersOnline: 1, connected: false, playerName: "OPERATIVE", message: null, messageAt: 0,
  damageFlash: 0, damageBearing: 0, sniperAim: null, lastRun: null, leaderboard: [], fps: 0, pointerLocked: false,
  crosshair: 0, hostageSecured: false, safeZone: true, spawnProtection: 8, riding: false, speed: 0,
  checkpoint: 0, totalCheckpoints: 8, aiming: false, pursuers: 0,
  score: 0, level: 1, xpProgress: 0, streak: null, banner: null, contracts: [],
  achievement: null, minimap: null,
  loadout: { primary: "rifle", perk: "scout" }, difficulty: "regular",
  settings: { sensitivity: 0.002, volume: 70, muted: false, invertY: false, quality: "high" },
  bests: { bestTimeMs: 0, bestKills: 0, bestScore: 0, runs: 0, totalKills: 0 },
  team: "blue", match: { mode: "rescue", blue: 0, red: 0, limit: 30, round: 1, ended: false, bluePlayers: 0, redPlayers: 0, capacity: 0 }, respawnSeconds: 0, roster: [],
  scoreboardOpen: false,
};
class HudStore {
  private state: HudState = initial;
  private listeners = new Set<() => void>();
  private feedId = 1;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.state;
  set(patch: Partial<HudState>): void { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  reset(): void {
    const keep = { loadout: this.state.loadout, difficulty: this.state.difficulty, settings: this.state.settings, bests: this.state.bests, leaderboard: this.state.leaderboard, playerName: this.state.playerName };
    this.state = { ...initial, ...keep };
    this.listeners.forEach(fn => fn());
  }
  pushFeed(text: string, kind: KillFeedEntry["kind"]): void {
    const entry = { id: this.feedId++, text, kind };
    this.set({ killFeed: [entry, ...this.state.killFeed].slice(0, 4) });
  }
  banner(title: string, sub = ""): void {
    this.set({ banner: { title, sub, id: this.feedId++ } });
  }
  streak(text: string): void {
    this.set({ streak: { text, at: performance.now() } });
  }
  achievement(title: string, desc: string): void {
    this.set({ achievement: { title, desc, id: this.feedId++ } });
  }
  message(text: string): void { this.set({ message: text, messageAt: performance.now() }); }
}
// React requires a referentially stable SSR snapshot.
export const getServerHudSnapshot = (): HudState => initial;
export const hudStore = new HudStore();
