import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES } from "../support/public-routes";
import { VIEWPORTS } from "../visual/viewports";

/**
 * 每一條公開路由、每一個斷點，都不能橫向捲（0818 收尾稽核）
 *
 * ── 為什麼補這一組 ────────────────────────────────────────────
 *
 * 收尾清查數出來：八斷點的橫向溢出檢查只涵蓋 `/`、`/work`、`/work/[slug]`
 * 與後台。CR-006 新增的 `/pricing` 與 `/playground`——**首頁最大的兩塊
 * 搬過去的地方**——一個斷點都沒驗過。
 *
 * 而這正是最容易壞的地方：0818 那次 `TemplatePicker`（`lg:grid-cols-4`）
 * 被塞進 22rem 的欄位裡，渲染成一行一個字。
 * typecheck、lint、build、測試全綠，只有打開畫面看得出來。
 *
 * ── 判定方式：真的去捲，不看 scrollWidth ─────────────────────
 *
 * `documentElement.scrollWidth - clientWidth` **量不準**：頁面裡任何一個
 * 自己有橫向捲軸的容器（例如 CRM 的表格）都會把它撐大，
 * 而那種捲動是設計如此的。實測過 390px 的視窗量出 429 這種值。
 *
 * 所以改成「叫視窗往右捲，看它有沒有真的動」——那才是使用者會遇到的事。
 *
 * ⚠️ 一定要 `behavior: "instant"`。
 *
 * 這一組第一版寫 `window.scrollTo(9999, y)`，故意在 /pricing 塞一個
 * 1600px 寬的東西進去，測試**照樣全綠**——站台的 `<html>` 上有
 * `scroll-behavior: smooth`，於是捲動是動畫的，下一行讀到的 scrollX
 * 還是 0。一個永遠量到 0 的檢查，永遠不會紅。
 */

async function windowScrollsSideways(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const y = window.scrollY;
    // behavior: "instant" 蓋掉 CSS 的 scroll-behavior: smooth
    window.scrollTo({ left: 9999, top: y, behavior: "instant" });
    const moved = window.scrollX;
    window.scrollTo({ left: 0, top: y, behavior: "instant" });
    return moved;
  });
}

for (const route of PUBLIC_ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} @ ${viewport.name}px 不會橫向捲`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);

      // 圖片載入後才是最終寬度。networkidle 在有輪詢的頁面會卡住，所以只等 load
      await page.waitForLoadState("load");

      expect(
        await windowScrollsSideways(page),
        `${route.path} 在 ${viewport.name}px 會橫向捲——有東西撐破了版面`,
      ).toBe(0);
    });
  }
}
