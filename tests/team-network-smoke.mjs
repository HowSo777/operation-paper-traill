import { io } from "socket.io-client";
import assert from "node:assert/strict";

const url = process.env.TEST_SOCKET_URL || "http://127.0.0.1:4000";
const options = { auth: { mode: "deathmatch" }, transports: ["websocket"], reconnection: false, timeout: 6000, autoConnect: false };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function once(socket, name, predicate = () => true, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timed out waiting for ${name}`)); }, timeoutMs);
    function handler(value) { if (!predicate(value)) return; clearTimeout(timeout); socket.off(name, handler); resolve(value); }
    socket.on(name, handler);
  });
}

const clients = Array.from({ length: 11 }, () => io(url, options));
try {
  const inits = clients.map(client => once(client, "init"));
  clients.forEach(client => client.connect());
  const payloads = await Promise.all(inits);
  const roster = payloads.map((payload, i) => ({ client: clients[i], id: payload.id, self: payload.players.find(player => player.id === payload.id), match: payload.match }));
  roster.forEach(({ client }, i) => client.emit("hello", { name: `TEAM-${i}` }));
  await sleep(250);

  const blue = roster.filter(r => r.self.team === "blue");
  const red = roster.filter(r => r.self.team === "red");
  const spectator = roster.filter(r => r.self.team === "spectator");
  assert.equal(blue.length, 5);
  assert.equal(red.length, 5);
  assert.equal(spectator.length, 1);
  console.log("BALANCE: 5 BLUE · 5 RED · 1 SPECTATOR");

  // Let the server's initial spawn grace expire then position a blue, a blue
  // teammate and a red opponent on three clean, non-safe map lanes.
  await sleep(8300);
  const shooter = blue[0];
  const friendly = blue[1];
  const enemy = red[0];
  shooter.client.emit("move", { pos: [45, .02, -10], yaw: Math.PI, pitch: 0, hp: 100, alive: true, moving: false, riding: false, weapon: "rifle", protected: false });
  friendly.client.emit("move", { pos: [42, .02, 10], yaw: 0, pitch: 0, hp: 100, alive: true, moving: false, riding: false, weapon: "rifle", protected: false });
  enemy.client.emit("move", { pos: [45, .02, 10], yaw: 0, pitch: 0, hp: 100, alive: true, moving: false, riding: false, weapon: "rifle", protected: false });
  await sleep(180);

  // Friendly-fire attempt: no hurt event for the blue teammate.
  let friendlyHurt = false;
  friendly.client.once("playerHurt", () => { friendlyHurt = true; });
  shooter.client.emit("shot", { origin: [45, 1.7, -10], dir: [-.15, 0, .99] });
  await sleep(40);
  shooter.client.emit("hit", { targetId: friendly.id, damage: 34 });
  await sleep(250);
  assert.equal(friendlyHurt, false);
  console.log("FRIENDLY FIRE: rejected by server");

  // Enemy kill: four validated AK hits, blue score increments and red dies.
  const death = once(shooter.client, "playerDied", event => event.victimId === enemy.id, 8000);
  for (let hit = 0; hit < 4; hit++) {
    shooter.client.emit("shot", { origin: [45, 1.7, -10], dir: [0, 0, 1] });
    await sleep(125);
    shooter.client.emit("hit", { targetId: enemy.id, damage: 34 });
    await sleep(125);
  }
  const event = await death;
  assert.equal(event.killerId, shooter.id);
  assert.equal(event.team, "red");
  assert.equal(event.score.blue, 1);
  console.log("KILL CONFIRMED: BLUE +1, RED operative queued for respawn");

  const respawned = once(shooter.client, "snapshot", packet => {
    const p = packet.players.find(player => player.id === enemy.id);
    return p?.alive === true && p.hp === 100 && p.team === "red";
  }, 7000);
  await respawned;
  console.log("RESPAWN: RED operative returned on faction pad");
  console.log("PASS: authoritative 5v5 team room");
} finally {
  clients.forEach(client => client.disconnect());
}
