import { serverDb } from "@/db/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign");

  if (!callsign) {
    return Response.json({ error: "Missing callsign" }, { status: 400 });
  }

  const profile = serverDb.getProfile(callsign);
  return Response.json({ profile });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body.callsign !== "string") {
      return Response.json({ error: "Invalid profile data" }, { status: 400 });
    }

    const saved = serverDb.saveProfile(body);
    return Response.json({ ok: true, profile: saved });
  } catch (err) {
    console.error("Failed to save profile:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
