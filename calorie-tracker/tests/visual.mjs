import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch();
for (const width of [390, 1440]) {
  const page = await browser.newPage({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4173/calorie-tracker/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "artifacts/welcome-" + width + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explore an empty preview" }).click();
  await page.screenshot({
    path: "artifacts/diary-" + width + ".png",
    fullPage: true,
  });
  await page.close();
}
await browser.close();

