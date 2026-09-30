import { serverDb } from "@/db/storage";

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
  try {
    const runs = await serverDb.getLeaderboard(20);
    return Response.json({ runs });
  } catch (error) {
    console.error("leaderboard read failed", error);
    return Response.json({ runs: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const playerName = sanitiseName(p.playerName);
  const result = p.result === "failed" ? "failed" : "accomplished";
  const kills = sanitiseInt(p.kills, 500);
  const timeMs = sanitiseInt(p.timeMs, 3_600_000);
  const accuracy = sanitiseInt(p.accuracy, 100);
  const score = sanitiseInt(p.score, 100_000);
  const difficulty = sanitiseDifficulty(p.difficulty);

  try {
    const saved = await serverDb.insertMissionRun({
      playerName,
      result,
      kills,
      timeMs,
      accuracy,
      score,
      difficulty,
    });

    return Response.json({ ok: true, id: saved.id, saved: true });
  } catch (error) {
    console.error("leaderboard write failed", error);
    return Response.json({ error: "Could not save run" }, { status: 500 });
  }
}
