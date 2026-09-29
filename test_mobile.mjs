import { chromium } from "playwright";

async function testMobile() {
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
  const url = "https://initial-apparel-outstanding-tiffany.trycloudflare.com?mode=deathmatch";
  console.log("Navigating to mobile game view:", url);

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("Clicking Deploy on mobile...");
  await page.locator(".deploy-btn").click();
  await page.waitForTimeout(2000);

  // Check mobile controls existence
  const fireBtn = await page.locator("button:has-text('FIRE')").isVisible();
  const aimBtn = await page.locator("button:has-text('AIM')").isVisible();
  const jumpBtn = await page.locator("button:has-text('JUMP')").isVisible();
  const swapBtn = await page.locator("button:has-text('SWAP')").isVisible();

  console.log("Mobile Controls Check:", { fireBtn, aimBtn, jumpBtn, swapBtn });

  await page.screenshot({ path: "artifacts/mobile_gameplay.png" });
  console.log("Screenshot saved to artifacts/mobile_gameplay.png!");

  await browser.close();
}

testMobile().catch(console.error);
