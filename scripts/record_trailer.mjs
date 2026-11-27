import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TRAILER_DIR = path.resolve("trailer");
if (!fs.existsSync(TRAILER_DIR)) {
  fs.mkdirSync(TRAILER_DIR, { recursive: true });
}

async function main() {
  console.log("Launching Edge browser for recording...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: TRAILER_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  console.log("Navigating to https://operation-paper-trail.embarko.app ...");
  await page.goto("https://operation-paper-trail.embarko.app", { waitUntil: "networkidle" });

  await page.waitForTimeout(2000);

  // 1. Showcase Menu & Loadout
  console.log("Showcasing Loadout & Matchmaking...");
  await page.mouse.move(640, 360, { steps: 5 });
  await page.waitForTimeout(1000);

  // Open Crates & Arsenal
  console.log("Opening Crates & Arsenal...");
  const crateBtn = page.locator('button:has-text("CRATES & ARSENAL")');
  if (await crateBtn.count() > 0) {
    await crateBtn.first().click();
    await page.waitForTimeout(1500);

    // Click OPEN CASE button if enabled
    const openCaseBtn = page.locator('button:has-text("OPEN CASE")');
    if (await openCaseBtn.count() > 0 && !(await openCaseBtn.first().isDisabled())) {
      console.log("Spinning CS:GO Roulette Reel...");
      await openCaseBtn.first().click();
      await page.waitForTimeout(6000); // Wait for roulette animation to complete
      
      const equipBtn = page.locator('button:has-text("EQUIP SKIN")');
      if (await equipBtn.count() > 0) {
        await equipBtn.first().click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log("Browsing case skins preview...");
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1500);
    }

    // Close crate modal
    const closeBtn = page.locator('button:has-text("✕")');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(1000);
    }
  }

  // 2. Deploy into Match
  console.log("Deploying into 3D Arena...");
  const deployBtn = page.locator('.deploy-btn');
  if (await deployBtn.count() > 0) {
    await deployBtn.click();
    await page.waitForTimeout(2500);
  }

  // 3. Gameplay Action Sequence
  console.log("Recording Gameplay Action...");
  const gameCanvas = page.locator('canvas[data-engine]').first();
  if (await gameCanvas.count() > 0) {
    const box = await gameCanvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await gameCanvas.click({ force: true });
    }
    await page.waitForTimeout(800);

    // Forward run & tactical strafe
    console.log("Movement & Combat...");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);
    
    // Look right towards enemy lanes
    await page.mouse.move(750, 360, { steps: 8 });
    await page.waitForTimeout(400);

    // Fire weapon burst (muzzle flashes & tracers)
    console.log("Burst fire sequence...");
    for (let i = 0; i < 5; i++) {
      await page.mouse.down({ button: "left" });
      await page.waitForTimeout(90);
      await page.mouse.up({ button: "left" });
      await page.waitForTimeout(100);
    }

    // Strafe jump
    await page.keyboard.down("KeyA");
    await page.keyboard.press("Space");
    await page.waitForTimeout(800);
    await page.keyboard.up("KeyA");

    // Look left
    await page.mouse.move(500, 340, { steps: 8 });
    await page.waitForTimeout(400);

    // Switch to weapon 2 (AWP Sniper)
    console.log("Switching to Sniper...");
    await page.keyboard.press("Digit2");
    await page.waitForTimeout(700);

    // Aim down sights (RMB) - triggers sniper scope vignette
    await page.mouse.down({ button: "right" });
    await page.waitForTimeout(1000);
    await page.mouse.move(530, 350, { steps: 6 });
    await page.waitForTimeout(500);

    // Sniper shot!
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(100);
    await page.mouse.up({ button: "left" });
    await page.waitForTimeout(600);
    await page.mouse.up({ button: "right" });

    // Switch to weapon 3
    await page.keyboard.press("Digit3");
    await page.waitForTimeout(600);

    // Reload animation
    await page.keyboard.press("KeyR");
    await page.waitForTimeout(1600);

    // Final sprint and slide
    await page.keyboard.down("KeyD");
    await page.keyboard.down("KeyC");
    await page.waitForTimeout(1200);
    await page.keyboard.up("KeyC");
    await page.keyboard.up("KeyD");
    await page.keyboard.up("KeyW");
  }

  await page.waitForTimeout(2000);

  // 4. Finalize video
  console.log("Finalizing video recording...");
  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const finalPath = path.join(TRAILER_DIR, "paper_trail_official_trailer.webm");
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.copyFileSync(videoPath, finalPath);
    const stat = fs.statSync(finalPath);
    console.log(`Trailer saved successfully: ${finalPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

main().catch(err => {
  console.error("Recording error:", err);
  process.exit(1);
});
