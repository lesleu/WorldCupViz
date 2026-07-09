import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror:${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console:${msg.text()}`);
});

await page.goto(`${base}/match/1576805`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);

const canvases = await page.locator("canvas").count();
const back = page.getByRole("button", { name: /back/i }).first();
const bodyText = await page.locator("body").innerText();
const hasStats = /Possession|Shots|Fouls/i.test(bodyText);

console.log(
  JSON.stringify(
    {
      canvases,
      backVisible: await back.isVisible(),
      hasStats,
      errors: errors.slice(0, 8),
    },
    null,
    2
  )
);

if (await back.isVisible()) {
  await back.click();
  await page.waitForURL("**/", { timeout: 15000 });
  console.log("back navigated to:", page.url());
}

await browser.close();
process.exit(canvases > 0 ? 0 : 1);
