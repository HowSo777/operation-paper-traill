import { io } from "socket.io-client";
import assert from "node:assert/strict";
const url = process.env.TEST_SOCKET_URL || "http://127.0.0.1:4000";
const opts = mode => ({ auth: { mode }, transports: ["websocket"], reconnection: false, timeout: 6000, autoConnect: false });
function once(socket, name, predicate = () => true, ms = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`timeout ${name}`)); }, ms);
    function handler(value) { if (!predicate(value)) return; clearTimeout(timer); socket.off(name, handler); resolve(value); }
    socket.on(name, handler);
  });
}
const rescue = io(url, opts("rescue"));
const deathmatch = io(url, opts("deathmatch"));
try {
  const rInit = once(rescue, "init");
  const dInit = once(deathmatch, "init");
  rescue.connect(); deathmatch.connect();
  const [r, d] = await Promise.all([rInit, dInit]);
  assert.equal(r.match.mode, "rescue");
  assert.equal(d.match.mode, "deathmatch");
  assert.ok(r.players.every(p => p.mode === "rescue"));
  assert.ok(d.players.every(p => p.mode === "deathmatch"));

  let leakedToDeathmatch = false;
  deathmatch.on("playerShot", () => { leakedToDeathmatch = true; });
  rescue.emit("shot", { origin: [0, 1.7, 59], dir: [0, 0, -1] });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(leakedToDeathmatch, false);

  let leakedToRescue = false;
  rescue.on("playerShot", () => { leakedToRescue = true; });
  deathmatch.emit("shot", { origin: [-38, 1.7, 24], dir: [1, 0, 0] });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(leakedToRescue, false);
  console.log("PASS: Rescue and Deathmatch rooms are isolated");
} finally {
  rescue.disconnect(); deathmatch.disconnect();
}
