/**
 * Unified Server-Side Database Manager.
 * Supports persistent file-backed JSON database out of the box,
 * and seamlessly bridges to PostgreSQL via Drizzle when DATABASE_URL is provided.
 */
import fs from "node:fs";
import path from "node:path";
import { pool, db } from "./index";
import { missionRuns } from "./schema";
import { desc } from "drizzle-orm";

export interface DbMissionRun {
  id: number;
  playerName: string;
  result: string;
  kills: number;
  timeMs: number;
  accuracy: number;
  score: number;
  difficulty: string;
  createdAt: string;
}

export interface DbPlayerProfile {
  callsign: string;
  totalXp: number;
  rankTier: number;
  rankName: string;
  kills: number;
  deaths: number;
  matchesWon: number;
  crates: number;
  keys: number;
  unlockedSkins: string[];
  equippedSkins: Record<string, string>;
  lastClaimedRankTier: number;
  updatedAt: string;
}

export interface DbMatchRecord {
  id: string;
  mode: string;
  blueScore: number;
  redScore: number;
  winningTeam: string;
  durationSeconds: number;
  timestamp: string;
}

interface DatabaseFileSchema {
  runs: DbMissionRun[];
  profiles: Record<string, DbPlayerProfile>;
  matches: DbMatchRecord[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "game_database.json");

function ensureDbFile(): DatabaseFileSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: DatabaseFileSchema = { runs: [], profiles: {}, matches: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw) as DatabaseFileSchema;
  } catch (err) {
    console.error("Failed to read database file, initializing empty:", err);
    return { runs: [], profiles: {}, matches: [] };
  }
}

function writeDbFile(data: DatabaseFileSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to database file:", err);
  }
}

export const serverDb = {
  isPostgres(): boolean {
    return Boolean(pool && db);
  },

  async insertMissionRun(run: Omit<DbMissionRun, "id" | "createdAt">): Promise<DbMissionRun> {
    if (this.isPostgres()) {
      try {
        const [saved] = await db.insert(missionRuns).values({
          playerName: run.playerName,
          result: run.result,
          kills: run.kills,
          timeMs: run.timeMs,
          accuracy: run.accuracy,
          score: run.score,
          difficulty: run.difficulty,
        }).returning();

        return {
          id: saved.id,
          playerName: saved.playerName,
          result: saved.result,
          kills: saved.kills,
          timeMs: saved.timeMs,
          accuracy: saved.accuracy,
          score: saved.score,
          difficulty: saved.difficulty,
          createdAt: saved.createdAt.toISOString(),
        };
      } catch (err) {
        console.error("Postgres insert error, falling back to file DB:", err);
      }
    }

    const state = ensureDbFile();
    const newId = state.runs.length > 0 ? Math.max(...state.runs.map(r => r.id)) + 1 : 1;
    const record: DbMissionRun = {
      ...run,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    state.runs.unshift(record);
    if (state.runs.length > 200) state.runs = state.runs.slice(0, 200);
    writeDbFile(state);
    return record;
  },

  async getLeaderboard(limit = 10): Promise<DbMissionRun[]> {
    if (this.isPostgres()) {
      try {
        const rows = await db
          .select()
          .from(missionRuns)
          .orderBy(desc(missionRuns.score))
          .limit(limit);

        return (rows as any[]).map((r: any) => ({
          id: r.id,
          playerName: r.playerName,
          result: r.result,
          kills: r.kills,
          timeMs: r.timeMs,
          accuracy: r.accuracy,
          score: r.score,
          difficulty: r.difficulty,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.error("Postgres leaderboard query error, falling back to file DB:", err);
      }
    }

    const state = ensureDbFile();
    return [...state.runs]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  getProfile(callsign: string): DbPlayerProfile | null {
    const state = ensureDbFile();
    return state.profiles[callsign.toUpperCase()] ?? null;
  },

  saveProfile(profile: Partial<DbPlayerProfile> & { callsign: string }): DbPlayerProfile {
    const state = ensureDbFile();
    const key = profile.callsign.toUpperCase();
    const existing = state.profiles[key] ?? {
      callsign: key,
      totalXp: 0,
      rankTier: 1,
      rankName: "Silver I",
      kills: 0,
      deaths: 0,
      matchesWon: 0,
      crates: 1,
      keys: 1,
      unlockedSkins: ["rifle_default", "awp_default", "deagle_default", "smg_default", "p90_default", "shotgun_default", "sniper_default", "pistol_default"],
      equippedSkins: {
        rifle: "rifle_default",
        awp: "awp_default",
        deagle: "deagle_default",
        smg: "smg_default",
        p90: "p90_default",
        shotgun: "shotgun_default",
        sniper: "sniper_default",
        pistol: "pistol_default",
      },
      lastClaimedRankTier: 1,
      updatedAt: new Date().toISOString(),
    };

    const updated: DbPlayerProfile = {
      ...existing,
      ...profile,
      callsign: key,
      updatedAt: new Date().toISOString(),
    };

    state.profiles[key] = updated;
    writeDbFile(state);
    return updated;
  },

  recordMatch(match: DbMatchRecord): void {
    const state = ensureDbFile();
    state.matches.unshift(match);
    if (state.matches.length > 100) state.matches = state.matches.slice(0, 100);
    writeDbFile(state);
  },
};
