/**
 * Meta progression: XP, levels, kill streaks, contracts, achievements and
 * persisted bests. Pure logic + localStorage, no Three.js, fully testable.
 */

export const XP = {
  kill: 100,
  headshotBonus: 50,
  rider: 150,
  aceBonus: 100,
  rescue: 300,
  checkpoint: 75,
  mission: 500,
  pickup: 25,
  contract: 250,
} as const;

/** XP required to go from `level` to `level + 1` (level starts at 1). */
export function xpForLevel(level: number): number {
  return Math.floor(600 * Math.pow(Math.max(1, level), 1.5));
}

export function levelForXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  for (;;) {
    const need = xpForLevel(level);
    if (remaining < need) return { level, into: remaining, need };
    remaining -= need;
    level += 1;
  }
}

export function streakText(count: number): string | null {
  if (count === 2) return "DOUBLE KILL";
  if (count === 3) return "TRIPLE KILL";
  if (count >= 4) return `RAMPAGE ×${count}`;
  return null;
}

export type ContractDef = { id: string; title: string; desc: string; target: number; reward: number };
export const CONTRACTS: ContractDef[] = [
  { id: "headhunter", title: "Headhunter", desc: "3 headshot kills", target: 3, reward: 250 },
  { id: "roadwarrior", title: "Road Warrior", desc: "Down 3 pursuit riders", target: 3, reward: 300 },
  { id: "ghost", title: "Ghost", desc: "Rescue the hostage without firing", target: 1, reward: 350 },
];

export type ContractState = Record<string, { progress: number; done: boolean }>;
export function newContracts(): ContractState {
  const out: ContractState = {};
  for (const c of CONTRACTS) out[c.id] = { progress: 0, done: false };
  return out;
}

export type AchievementDef = { id: string; title: string; desc: string };
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "firstBlood", title: "First Blood", desc: "Get your first kill" },
  { id: "sharpshooter", title: "Sharpshooter", desc: "3 headshots in one run" },
  { id: "aceSlayer", title: "Ace Slayer", desc: "Down an ace rider" },
  { id: "untouchable", title: "Untouchable", desc: "Extract without taking damage" },
  { id: "speedrunner", title: "Speedrunner", desc: "Extract in under 6 minutes" },
  { id: "fullArsenal", title: "Full Arsenal", desc: "Hold 4 weapons at once" },
];

export type Bests = {
  bestTimeMs: number;
  bestKills: number;
  bestScore: number;
  runs: number;
  totalKills: number;
};

const K = {
  xp: "papertrail.xp.v1",
  bests: "papertrail.bests.v1",
  achievements: "papertrail.achievements.v1",
  loadout: "papertrail.loadout.v1",
  settings: "papertrail.settings.v1",
};

function read<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — game still runs */
  }
}

export function loadTotalXp(): number {
  try {
    if (typeof window === "undefined") return 0;
    return Math.max(0, Number(window.localStorage.getItem(K.xp) ?? 0) || 0);
  } catch {
    return 0;
  }
}

export function saveTotalXp(total: number): void {
  write(K.xp, Math.max(0, Math.floor(total)));
}

export const DEFAULT_BESTS: Bests = { bestTimeMs: 0, bestKills: 0, bestScore: 0, runs: 0, totalKills: 0 };
export function loadBests(): Bests {
  return read<Bests>(K.bests, DEFAULT_BESTS);
}
export function saveBests(bests: Bests): void {
  write(K.bests, bests);
}

export function loadAchievements(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(K.achievements);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveAchievements(ids: string[]): void {
  write(K.achievements, ids);
}

export type PersistedLoadout = { primary: string; secondary?: string; perk: string; difficulty: string; callsign: string };
export function loadPersistedLoadout(): PersistedLoadout {
  return read<PersistedLoadout>(K.loadout, { primary: "rifle", secondary: "pistol", perk: "scout", difficulty: "regular", callsign: "" });
}
export function savePersistedLoadout(value: PersistedLoadout): void {
  write(K.loadout, value);
}

export type PersistedSettings = { sensitivity: number; volume: number; muted: boolean; invertY: boolean; quality: "high" | "low" };
export const DEFAULT_SETTINGS: PersistedSettings = { sensitivity: 0.002, volume: 70, muted: false, invertY: false, quality: "high" };
export function loadPersistedSettings(): PersistedSettings {
  const s = read<PersistedSettings>(K.settings, DEFAULT_SETTINGS);
  return {
    sensitivity: Math.min(0.006, Math.max(0.0005, Number(s.sensitivity) || 0.002)),
    volume: Math.min(100, Math.max(0, Number(s.volume) || 0)),
    muted: s.muted === true,
    invertY: s.invertY === true,
    quality: s.quality === "low" ? "low" : "high",
  };
}
export function savePersistedSettings(value: PersistedSettings): void {
  write(K.settings, value);
}

export function gradeFor(score: number): "S" | "A" | "B" | "C" {
  if (score >= 2600) return "S";
  if (score >= 1900) return "A";
  if (score >= 1200) return "B";
  return "C";
}
