import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES, unlistedRoutes } from "../support/public-routes";
import { VIEWPORTS } from "./viewports";

/**
 * Gate 第 5 項：產生八斷點截圖供人工 review（Plan §9）。
 * 不做 pixel diff —— 判定由人做。
 *
 * 產出位置：artifacts/<SHOT_TAG>/<route>-<width>.png
 */
const TAG = process.env.SHOT_TAG ?? "latest";

/**
 * 公開頁面全部拍，外加四個 _dev 展示頁。
 *
 * ⚠️ 公開的那幾條來自 `tests/support/public-routes.ts`，與 a11y 掃描同一份。
 * 原本這裡是另一份手寫清單，於是 CR-006 新增的 /pricing 與 /playground
 * 從來沒有進過人工視覺 review——而沒有任何東西會說。
 */
const ROUTES = [
  ...PUBLIC_ROUTES.map((route) => ({
    name: route.path === "/" ? "home" : route.path.slice(1).replace(/\//g, "-"),
    path: route.path,
  })),
  { name: "dev-tokens", path: "/_dev/tokens" },
  { name: "dev-theme", path: "/_dev/theme" },
  { name: "dev-primitives", path: "/_dev/primitives" },
  { name: "dev-templates", path: "/_dev/templates" },
];

test("截圖清單沒有漏掉任何一條公開頁面", () => {
  // 與 a11y 那一組同一個守衛，因為它們現在讀同一份清單
  expect(unlistedRoutes()).toEqual([]);
});

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.screenshot({
        path: `artifacts/${TAG}/${route.name}-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
}
