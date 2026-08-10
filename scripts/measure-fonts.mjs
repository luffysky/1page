import { chromium } from "@playwright/test";

/**
 * 1A Gate 要求：實測首屏字型傳輸量並記錄（Implementation Plan §4）。
 *
 * 裁決 A（思源宋標題）是 Phase 1 的頭號效能風險——中文襯線字型體積龐大，
 * 且正好落在 LCP 元素（H1）上。這支腳本量的就是「緩解策略是否真的有效」。
 *
 * 用法：先啟動 production server，再 node scripts/measure-fonts.mjs <url>
 */
const url = process.argv[2] ?? "http://127.0.0.1:3100/";

const browser = await chromium.launch();
const page = await browser.newPage();

const fonts = [];
page.on("response", async (response) => {
  const requestUrl = response.url();
  if (!/\.(woff2?|ttf|otf)(\?|$)/i.test(requestUrl)) return;
  let bytes = 0;
  try {
    bytes = (await response.body()).length;
  } catch {
    bytes = 0;
  }
  fonts.push({ url: requestUrl.split("/").pop(), bytes });
});

await page.goto(url, { waitUntil: "networkidle" });

// 量首屏：不捲動，等字型 swap 完成
await page.waitForTimeout(1500);

const total = fonts.reduce((sum, font) => sum + font.bytes, 0);

console.log(`\nURL: ${url}`);
console.log(`字型檔數量: ${fonts.length}`);
for (const font of fonts.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${(font.bytes / 1024).toFixed(1).padStart(8)} KB  ${font.url}`);
}
console.log(`\n首屏字型傳輸總量: ${(total / 1024).toFixed(1)} KB\n`);

await browser.close();
