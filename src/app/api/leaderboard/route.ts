import { db } from "@/db";
import { missionRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_NAME = 14;

function sanitiseName(value: unknown): string {
  if (typeof value !== "string") return "OPERATIVE";
  const cleaned = value.replace(/[^\w \-]/g, "").trim().slice(0, MAX_NAME);
  return cleaned.length > 0 ? cleaned.toUpperCase() : "OPERATIVE";
}

function sanitiseInt(value: unknown, max: number): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function sanitiseDifficulty(value: unknown): string {
  return value === "recruit" || value === "veteran" ? String(value) : "regular";
}

/** Top exfils ranked by score. */
export async function GET() {
  if (!db) {
    return Response.json({ runs: [] }, { status: 200 });
  }
  try {
    const runs = await db
      .select({
        id: missionRuns.id,
        playerName: missionRuns.playerName,
        result: missionRuns.result,
        kills: missionRuns.kills,
        timeMs: missionRuns.timeMs,
        accuracy: missionRuns.accuracy,
        score: missionRuns.score,
        difficulty: missionRuns.difficulty,
      })
      .from(missionRuns)
      .where(eq(missionRuns.result, "accomplished"))
      .orderBy(desc(missionRuns.score), missionRuns.timeMs)
      .limit(20);

    return Response.json({ runs });
  } catch (error) {
    console.error("leaderboard read failed", error);
    return Response.json({ runs: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  if (!db) {
    return Response.json({ ok: true, id: null, saved: false });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const row = {
    playerName: sanitiseName(body.playerName),
    result: body.result === "killed" ? "killed" : "accomplished",
    kills: sanitiseInt(body.kills, 999),
    timeMs: sanitiseInt(body.timeMs, 1000 * 60 * 60),
    accuracy: sanitiseInt(body.accuracy, 100),
    score: sanitiseInt(body.score, 999999),
    difficulty: sanitiseDifficulty(body.difficulty),
  };

  try {
    const inserted = await db.insert(missionRuns).values(row).returning({ id: missionRuns.id });
    return Response.json({ ok: true, id: inserted[0]?.id ?? null });
  } catch (error) {
    console.error("leaderboard write failed", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
