import { serverDb } from "@/db/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const isPg = serverDb.isPostgres();
  return Response.json({
    ok: true,
    database: isPg ? "postgresql" : "file_persistent",
    persistentStorage: true,
  });
}
