import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_PORT = 4000;

/**
 * Tells the browser where the Socket.io game server lives. The server is
 * started by `src/instrumentation.ts` inside the Node process, on its own port.
 *
 * Two deployment shapes are supported:
 *   - plain local/dev:            http://localhost:4000
 *   - port-per-subdomain proxies: https://4000-<sandbox>.host
 */
export async function GET(request: NextRequest) {
  const explicit = process.env.GAME_SERVER_URL;
  if (explicit) {
    return Response.json({ socketUrl: explicit, room: "compound" });
  }

  if (process.env.UNIFIED_SERVER === "true") {
    return Response.json({ socketUrl: "", room: "compound" });
  }

  const host = request.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0] || "localhost";
  const port = process.env.GAME_SERVER_PORT?.trim() || String(DEFAULT_PORT);
  const portPrefixed = /^(\d+)-(.+)$/.exec(hostname);
  // The preview proxy forwards HTTP to Next internally, while the browser
  // visits an HTTPS hostname. Always use HTTPS on those public subdomains.
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = portPrefixed || forwardedProtocol === "https" || request.nextUrl.protocol === "https:"
    ? "https"
    : "http";
  const socketUrl = portPrefixed
    ? `${protocol}://${port}-${portPrefixed[2]}`
    : `${protocol}://${hostname}:${port}`;

  return Response.json({ socketUrl, room: "compound" });
}
