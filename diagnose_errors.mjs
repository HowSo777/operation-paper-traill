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
  page.on("response", (r) => {
    if (r.status() >= 400) {
      console.log("[HTTP_ERROR]", r.status(), r.url());
    }
  });

  console.log("Navigating to Cloudflare tunnel URL ...");
  try {
    const res = await page.goto("https://changes-cells-fraser-librarian.trycloudflare.com", { waitUntil: "networkidle", timeout: 25000 });
    console.log("Page status:", res?.status());
    await page.waitForTimeout(3000);
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    console.log("HTML length:", html.length);
    console.log("Canvas elements:", await page.evaluate(() => document.querySelectorAll("canvas").length));
    console.log("Menu overlay elements:", await page.evaluate(() => document.querySelectorAll(".menu-overlay").length));
    console.log("Body innerText:", JSON.stringify(await page.evaluate(() => document.body.innerText)));
  } catch (err) {
    console.error("Navigation error:", err);
  } finally {
    await browser.close();
  }
}

diagnose();
