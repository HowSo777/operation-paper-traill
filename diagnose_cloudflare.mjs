import { chromium } from "playwright";

async function diagnose() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  
  page.on("pageerror", (e) => console.log("[PAGE_ERROR]", e.message, "\n", e.stack));
  page.on("console", (m) => console.log("[CONSOLE]", m.type(), m.text()));
  page.on("requestfailed", (r) => console.log("[REQ_FAILED]", r.url(), r.failure()?.errorText));

  console.log("Navigating to Cloudflare tunnel URL ...");
  try {
    const res = await page.goto("https://changes-cells-fraser-librarian.trycloudflare.com", { waitUntil: "networkidle", timeout: 25000 });
    console.log("Status:", res?.status());
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log("Title:", title);
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body Text:", JSON.stringify(bodyText));
    const canvasExists = await page.evaluate(() => !!document.querySelector("canvas"));
    console.log("Canvas exists:", canvasExists);
  } catch (err) {
    console.error("Navigation error:", err);
  } finally {
    await browser.close();
  }
}

diagnose();
