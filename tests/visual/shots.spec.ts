import { test } from "@playwright/test";

import { VIEWPORTS } from "./viewports";

/**
 * Gate 第 5 項：產生八斷點截圖供人工 review（Plan §9）。
 * 不做 pixel diff —— 判定由人做。
 *
 * 產出位置：artifacts/<SHOT_TAG>/<route>-<width>.png
 */
const TAG = process.env.SHOT_TAG ?? "latest";

const ROUTES = [
  { name: "home", path: "/" },
  { name: "dev-tokens", path: "/_dev/tokens" },
  { name: "work", path: "/work" },
  { name: "work-detail", path: "/work/interior-studio" },
  { name: "dev-theme", path: "/_dev/theme" },
  { name: "dev-primitives", path: "/_dev/primitives" },
];

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
