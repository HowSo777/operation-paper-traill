import { chromium } from "playwright";

async function main() {
  console.log("Testing Motorcycle Free Look Decoupling...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/?mode=rescue", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Deploy to Rescue Mode
  const deployBtn = page.getByRole("button", { name: /DEPLOY FOR RESCUE/i });
  await deployBtn.click();
  await page.waitForTimeout(2000);

  // Walk forward to the bike and press E to mount
  // Player spawns near bike: mount by pressing E
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1000);

  // Take screenshot while looking straight ahead
  await page.screenshot({ path: "artifacts/bike_straight_ahead.png" });
  console.log("Saved screenshot: artifacts/bike_straight_ahead.png");

  // Move mouse left / look left
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(340, 360, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // Take screenshot while looking left
  await page.screenshot({ path: "artifacts/bike_looking_left.png" });
  console.log("Saved screenshot: artifacts/bike_looking_left.png");

  await browser.close();
  console.log("Motorcycle test complete!");
}

main().catch(console.error);
