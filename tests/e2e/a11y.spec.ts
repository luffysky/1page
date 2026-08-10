import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { VIEWPORTS } from "../visual/viewports";

/**
 * A11y 基線（Spec §35 / Plan §8）
 *
 * 判準：axe 的 critical / serious 違規為零。
 * 不用 moderate/minor 當門檻，是因為那層常含情境相關的建議，
 * 拿來當硬性 Gate 會讓人開始為了過關而寫奇怪的標記。
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  return blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
  }));
}

test("首頁無 critical / serious 違規", async ({ page }) => {
  await page.goto("/");
  expect(await scan(page)).toEqual([]);
});

test("已篩選狀態下同樣無違規", async ({ page }) => {
  await page.goto("/?goal=ai");
  expect(await scan(page)).toEqual([]);
});

test("篩選後無作品的空狀態同樣無違規", async ({ page }) => {
  await page.goto("/?goal=content");
  expect(await scan(page)).toEqual([]);
});

test("行動版選單開啟時無違規", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "開啟選單" }).click();
  expect(await scan(page)).toEqual([]);
});

for (const viewport of VIEWPORTS) {
  test(`首頁 @ ${viewport.name}px 無違規且無橫向捲動`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    expect(await scan(page)).toEqual([]);

    // Spec §34：每個斷點都不得出現橫向捲動
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(0);
  });
}

test("鍵盤可走完首頁所有互動元素且 focus 皆可見", async ({ page }) => {
  await page.goto("/");

  const focusable = await page
    .locator("a[href], button:not([disabled]), input:not([disabled])")
    .count();
  expect(focusable).toBeGreaterThan(10);

  // 逐一 Tab，確認焦點確實在不同元素間移動，且每一個都有可見的 focus 樣式
  const visited: string[] = [];
  for (let step = 0; step < Math.min(focusable, 30); step += 1) {
    await page.keyboard.press("Tab");

    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      // Next.js 的開發工具浮層（<nextjs-portal>）也在 tab 順序中，
      // 但它不是產品內容，production build 不存在。不納入 a11y 判定。
      if (el.tagName.startsWith("NEXTJS-")) return null;
      const style = getComputedStyle(el);
      return {
        key: `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 24)}`,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });

    if (!info) continue;
    visited.push(info.key);

    // Spec §35：focus 必須可見。globals.css 對 :focus-visible 設 3px outline。
    expect(info.outlineStyle, `${info.key} 沒有可見的 focus 樣式`).not.toBe("none");
    expect(parseFloat(info.outlineWidth), `${info.key} 的 focus outline 寬度為 0`).toBeGreaterThan(
      0,
    );
  }

  expect(new Set(visited).size).toBeGreaterThan(5);
});

test("prefers-reduced-motion 生效時不套用過場動畫", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const seconds = await page.evaluate(() => {
    const button = document.querySelector("button[aria-pressed]");
    if (!button) return null;
    // 瀏覽器可能以指數記法回報極小值（0.01ms → "1e-05s"），故直接轉數值比較
    return parseFloat(getComputedStyle(button).transitionDuration);
  });

  expect(seconds).not.toBeNull();
  expect(seconds!).toBeLessThan(0.001);
});
