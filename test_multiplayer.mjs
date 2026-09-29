import { chromium } from "playwright";

async function testMultiplayer() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const url = "https://initial-apparel-outstanding-tiffany.trycloudflare.com?mode=deathmatch";
  console.log("Testing multiplayer sync on:", url);

  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  page1.on("console", m => {
    if (m.type() === "error") console.log("[PAGE1 ERR]", m.text());
  });
  page2.on("console", m => {
    if (m.type() === "error") console.log("[PAGE2 ERR]", m.text());
  });

  console.log("Loading Player 1...");
  await page1.goto(url, { waitUntil: "networkidle" });
  console.log("Loading Player 2...");
  await page2.goto(url, { waitUntil: "networkidle" });

  console.log("Clicking Deploy on Player 1...");
  await page1.locator(".deploy-btn").click();

  console.log("Clicking Deploy on Player 2...");
  await page2.locator(".deploy-btn").click();

  await page1.waitForTimeout(3000);
  await page2.waitForTimeout(3000);

  // Check socket connected state on both
  const p1Socket = await page1.evaluate(() => {
    const canvas = document.querySelector("canvas");
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith("__reactFiber"))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const v = hook.memoizedState?.current;
        if (v?.net) {
          return {
            connected: v.net.connected,
            selfId: v.net.selfId,
            remotesCount: v.remoteList?.length || 0,
            remotes: v.remoteList?.map(r => ({ id: r.id, name: r.name, team: r.team, pos: r.pos }))
          };
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  });

  const p2Socket = await page2.evaluate(() => {
    const canvas = document.querySelector("canvas");
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith("__reactFiber"))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const v = hook.memoizedState?.current;
        if (v?.net) {
          return {
            connected: v.net.connected,
            selfId: v.net.selfId,
            remotesCount: v.remoteList?.length || 0,
            remotes: v.remoteList?.map(r => ({ id: r.id, name: r.name, team: r.team, pos: r.pos }))
          };
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  });

  console.log("=== MULTIPLAYER SYNC REPORT ===");
  console.log("Player 1 State:", JSON.stringify(p1Socket, null, 2));
  console.log("Player 2 State:", JSON.stringify(p2Socket, null, 2));

  await browser.close();
}

testMultiplayer().catch(console.error);
