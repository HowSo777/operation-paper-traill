import { chromium } from "playwright";
import { io } from "socket.io-client";
import assert from "node:assert/strict";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const socketUrl = process.env.TEST_SOCKET_URL || "http://127.0.0.1:4000";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text()); });
let opponent;
try {
  await page.goto(`${base}?mode=deathmatch`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector(".mode-tabs", { timeout: 20000 });
  // Repeated mode changes used to leak WebGL resources and intermittently
  // crash. Exercise teardown/rebuild before joining either room.
  for (let i = 0; i < 6; i++) {
    await page.locator(i % 2 === 0 ? ".mode-tab.rescue" : ".mode-tab.deathmatch").click();
    await page.waitForTimeout(120);
  }
  if ((await page.locator(".mode-tab.deathmatch").getAttribute("aria-selected")) !== "true") {
    await page.locator(".mode-tab.deathmatch").click();
    await page.waitForTimeout(200);
  }
  assert.equal(await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    return gl?.isContextLost() ?? true;
  }), false);
  const tabs = await page.locator(".mode-tabs .mode-tab").count();
  assert.equal(tabs, 2);
  assert.equal(await page.locator(".mode-tab.deathmatch").getAttribute("aria-selected"), "true");
  const tabLayout = await page.locator(".mode-tabs").evaluate(el => getComputedStyle(el).gridTemplateColumns);
  assert.ok(tabLayout.split(" ").length >= 2, "mode selector is a compact two-tab row");

  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    let fiber = canvas[Object.keys(canvas).find(key => key.startsWith("__reactFiber"))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const value = hook.memoizedState?.current;
        if (value && typeof value.start === "function" && value.player) { window.__e = value; return; }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
  });
  await page.getByRole("button", { name: /enter 5v5 arena/i }).click();
  await page.waitForFunction(() => document.pointerLockElement !== null, { timeout: 10000 });
  await page.waitForSelector(".match-chip", { timeout: 10000 });
  assert.equal(await page.locator(".team-scoreboard").count(), 0, "scoreboard hidden until Tab is held");
  await page.keyboard.down("Tab");
  await page.waitForSelector(".team-scoreboard", { timeout: 10000 });
  await page.waitForSelector(".scoreboard-overlay .roster-blue", { timeout: 5000 });
  await page.waitForSelector(".scoreboard-overlay .roster-red", { timeout: 5000 });
  await page.keyboard.up("Tab");
  await page.waitForFunction(() => window.__e.net.selfId !== null && window.__e.matchConnected, { timeout: 10000 });
  const local = await page.evaluate(() => ({
    mode: window.__e.mode,
    team: window.__e.team,
    ai: window.__e.enemies.aliveCount(),
    hostageInScene: window.__e.hostage.group.parent !== null,
    bikeChildren: window.__e.world.bike.children.length,
    mapWidth: window.__e.solids.length,
  }));
  assert.equal(local.mode, "deathmatch");
  assert.equal(local.team, "blue");
  assert.equal(local.ai, 0);
  assert.equal(local.hostageInScene, false);
  assert.equal(local.bikeChildren, 0);
  // Death/redeploy refills every owned weapon — primary, sidearm and pickups.
  const refilled = await page.evaluate(() => {
    const e = window.__e;
    e.weapon.inventory.set("sniper", { ammo: 0, reserve: 1 });
    e.weapon.inventory.get(e.weapon.loadoutPrimary).ammo = 1;
    e.weapon.inventory.get("pistol").ammo = 0;
    e.queueTeamRespawn(0);
    e.respawnAt = performance.now() - 1;
    e.processTeamRespawn();
    return [...e.weapon.inventory.entries()].map(([kind, ammo]) => ({ kind, ...ammo, mag: e.weapon.inventory.get(kind).ammo }));
  });
  for (const state of refilled) assert.ok(state.ammo > 0 && state.reserve > 0, `${state.kind} refilled`);

  opponent = io(socketUrl, { auth: { mode: "deathmatch" }, transports: ["websocket"], reconnection: false });
  const init = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("opponent init timeout")), 7000);
    opponent.on("init", value => { clearTimeout(timer); resolve(value); });
  });
  const self = init.players.find(p => p.id === init.id);
  assert.notEqual(self.team, local.team, "second operative joins the opposite faction");
  opponent.emit("hello", { name: "RED-OPP" });
  opponent.emit("move", { pos: [8, .02, 0], yaw: -Math.PI / 2, pitch: 0, hp: 100, alive: true, moving: false, weapon: "rifle", protected: false });
  await page.waitForFunction(() => window.__e.remoteList.some(p => p.name === "RED-OPP"), { timeout: 10000 });
  await page.waitForTimeout(600);
  const visual = await page.evaluate(() => {
    const entry = [...window.__e.remotes.entries.values()].find(e => e.snapshot.name === "RED-OPP");
    const colors = [];
    entry.visual.group.traverse(obj => {
      const material = obj.material;
      if (material?.color) colors.push(material.color.getHex());
      else if (Array.isArray(material)) for (const m of material) if (m.color) colors.push(m.color.getHex());
    });
    return { enemy: entry.enemy, marker: entry.marker.material.color.getHex(), hasRedBody: colors.includes(0xc1121f) };
  });
  assert.equal(visual.enemy, true);
  assert.equal(visual.marker, 0xc1121f);
  assert.equal(visual.hasRedBody, true);
  await page.keyboard.down("Tab");
  await page.waitForSelector(".team-scoreboard", { timeout: 5000 });
  assert.ok((await page.locator(".team-scoreboard").innerText()).includes("5v5 TEAM DEATHMATCH"));
  assert.ok(!(await page.locator("body").innerText()).includes("Rescue the hostage"));
  await page.keyboard.up("Tab");
  await page.waitForFunction(() => document.querySelectorAll(".team-scoreboard").length === 0, { timeout: 5000 });
  await page.screenshot({ path: "artifacts/deathmatch-red-opponent.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: separate Ironworks 5v5 mode, compact tabs, red opponents");
} finally {
  opponent?.disconnect();
  await browser.close();
}
