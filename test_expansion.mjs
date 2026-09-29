import { chromium, devices } from "playwright";

async function main() {
  console.log("Launching Mobile Chrome test with landscape mobile emulation...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 }, // Landscape mobile phone
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  const url = "http://localhost:3000/?mode=deathmatch";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Take screenshot of Loadout Menu with Rank Badge and Crates Button
  await page.screenshot({ path: "artifacts/loadout_rank_crates.png" });
  console.log("Saved loadout screenshot: artifacts/loadout_rank_crates.png");

  // Check if "CRATES & SKINS" button is visible and click it
  const cratesBtn = page.getByRole("button", { name: /CRATES & SKINS/i });
  console.log("Clicking CRATES & SKINS button...");
  await cratesBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "artifacts/crate_modal_open.png" });
  console.log("Saved crate modal screenshot: artifacts/crate_modal_open.png");

  // Click OPEN CASE
  const openCaseBtn = page.getByRole("button", { name: /OPEN CASE/i });
  if (await openCaseBtn.isVisible()) {
    console.log("Clicking OPEN CASE (1 KEY)...");
    await openCaseBtn.click();
    console.log("Waiting for roulette wheel spin animation (5s)...");
    await page.waitForTimeout(5200);

    await page.screenshot({ path: "artifacts/crate_unboxed_result.png" });
    console.log("Saved unbox result screenshot: artifacts/crate_unboxed_result.png");
  }

  // Close crate modal
  const closeBtn = page.getByRole("button", { name: "✕" });
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(600);
  }

  // Click Deploy to Enter 5v5 Arena
  const deployBtn = page.getByRole("button", { name: /ENTER 5v5 ARENA/i });
  console.log("Deploying to 5v5 Arena...");
  await deployBtn.click();
  await page.waitForTimeout(2500);

  // Take screenshot of mobile gameplay with new HUD, Rank, Weapon Skin tag, and Aim-to-Fire stick
  await page.screenshot({ path: "artifacts/mobile_gameplay_aim_stick.png" });
  console.log("Saved mobile gameplay screenshot: artifacts/mobile_gameplay_aim_stick.png");

  // Simulate touching and dragging on the Aim-to-Fire stick
  console.log("Testing Aim-to-Fire stick touch drag...");
  const fireStick = page.locator("text=AIM");
  if (await fireStick.isVisible()) {
    const box = await fireStick.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
  }

  await browser.close();
  console.log("Verification finished successfully!");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
