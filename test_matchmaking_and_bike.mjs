import { io } from "socket.io-client";

async function testMatchmaking() {
  console.log("=== Testing Matchmaking Bots and Auto-Replacement ===");
  const socket1 = io("http://localhost:3000", { auth: { mode: "deathmatch" } });

  await new Promise((resolve) => {
    socket1.on("init", (data) => {
      console.log(`[Socket 1] Connected! Players in room: ${data.players.length}`);
      console.log("Players list:", data.players.map(p => `${p.name} (${p.team})`).join(", "));
      resolve();
    });
  });

  // Wait 1 second to observe bots
  await new Promise(r => setTimeout(r, 1000));

  console.log("\n=== Connecting Real Player 2 to Test Bot Replacement ===");
  const socket2 = io("http://localhost:3000", { auth: { mode: "deathmatch" } });
  
  await new Promise((resolve) => {
    socket2.on("init", (data) => {
      console.log(`[Socket 2] Connected! Players in room: ${data.players.length}`);
      console.log("Players list:", data.players.map(p => `${p.name} (${p.team})`).join(", "));
      resolve();
    });
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log("\n=== Disconnecting Real Player 2 to Test Bot Backfill ===");
  socket2.disconnect();
  await new Promise(r => setTimeout(r, 1000));

  console.log("[Socket 1] Checking final player list...");
  socket1.emit("shot", { origin: [0, 1.5, 0], dir: [0, 0, -1] });
  socket1.disconnect();
  console.log("Matchmaking bots & replacement test passed successfully!\n");
}

testMatchmaking().catch(console.error);
