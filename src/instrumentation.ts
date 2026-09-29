/**
 * Boots the Socket.io game server once, when the Next.js Node server starts.
 * (Runs for both `next dev` and `next start` — skipped during `next build`.)
 */

const globalForGameServer = globalThis as typeof globalThis & {
  __paperTrailGameServer?: boolean;
};

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.UNIFIED_SERVER === "true") return;
  if (globalForGameServer.__paperTrailGameServer) return;
  globalForGameServer.__paperTrailGameServer = true;

  try {
    const { startGameServer } = await import("@/server/gameServer");
    const port = Number(process.env.GAME_SERVER_PORT || 4000);
    const server = startGameServer(port);
    server.http.on("listening", () => {
      console.log(`[paper-trail] netcode server listening on :${port}`);
    });
    server.http.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`[paper-trail] port ${port} already in use, skipping netcode server`);
        return;
      }
      console.error("[paper-trail] netcode server error", error);
    });
  } catch (error) {
    console.error("[paper-trail] failed to start netcode server", error);
  }
}
