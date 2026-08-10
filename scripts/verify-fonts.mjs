import { chromium } from "@playwright/test";

/**
 * 1A 出口條件：「中文字型實際載入並在樣本頁可見」
 *
 * V3 Demo 的失敗正是宣告了 Inter 卻從未載入任何字體資源（Spec §45.2），
 * 而 CSS 宣告成功與「瀏覽器真的用了那個字型」是兩回事。
 *
 * 這支腳本透過 CDP CSS.getPlatformFontsForNode 直接問瀏覽器：
 * 這個節點的字，實際是用哪個字型畫出來的、畫了幾個字。
 */
const url = process.argv[2] ?? "http://127.0.0.1:3100/";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const client = await page.context().newCDPSession(page);
await client.send("DOM.enable");
await client.send("CSS.enable");

const { root } = await client.send("DOM.getDocument", { depth: -1 });

for (const selector of ["h1", "p"]) {
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  if (!nodeId) continue;

  const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
  const declared = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      return getComputedStyle(el).fontFamily.split(",")[0].trim();
    });

  console.log(`\n<${selector}>  宣告字族: ${declared}`);
  for (const font of fonts) {
    console.log(`   實際使用: ${font.familyName.padEnd(28)} 字數 ${font.glyphCount}`);
  }
}

await browser.close();
