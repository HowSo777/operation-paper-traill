import { chromium } from "playwright";

async function verify() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  
  page.on("pageerror", (e) => console.log("[PAGE_ERROR]", e.message));
  page.on("console", (m) => console.log("[CONSOLE]", m.type(), m.text()));
  page.on("response", (r) => {
    if (r.status() >= 400) console.log("[HTTP_ERROR]", r.status(), r.url());
  });

  const url = "https://initial-apparel-outstanding-tiffany.trycloudflare.com";
  console.log("Navigating to:", url);
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    console.log("Status:", res?.status());
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log("Title:", title);
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body text preview:", bodyText.slice(0, 150));
    console.log("Canvas count:", await page.evaluate(() => document.querySelectorAll("canvas").length));
    console.log("Deploy button exists:", await page.evaluate(() => !!document.querySelector(".deploy-btn")));
    await page.screenshot({ path: "artifacts/online_live.png" });
    console.log("Screenshot saved to artifacts/online_live.png!");
  } catch (err) {
    console.error("Verification error:", err);
  } finally {
    await browser.close();
  }
}

verify();
