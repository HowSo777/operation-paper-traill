import { createServer } from "node:http";
import next from "next";
import { startGameServer } from "./src/server/gameServer";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Set UNIFIED_SERVER so Next.js instrumentation and routes know Socket.io is on the same port
process.env.UNIFIED_SERVER = "true";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Attach Socket.io game server to the same HTTP server
  startGameServer(server);

  server.listen(port, hostname, () => {
    console.log(`> [Multiplayer Wireframe FPS] Unified Server running on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error("Failed to start unified server", err);
  process.exit(1);
});
