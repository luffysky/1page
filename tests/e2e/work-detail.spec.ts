import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { VIEWPORTS } from "../visual/viewports";

/**
 * `/work/[slug]` 詳細頁（Spec §8.10、§32）— 2C 的 Gate 第 5 項。
 */

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({ id: v.id, help: v.help }));
}

test("完整 Case Study 的作品顯示全部區塊", async ({ page }) => {
  await page.goto("/work/interior-studio");

  for (const label of ["Problem", "Goal", "Thinking", "Solution", "Result"]) {
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
});

test("沒有 Case Study 的作品不顯示任何空 Section（Spec §8.10）", async ({ page }) => {
  await page.goto("/work/ai-website-workshop");

  // 標題本身也不該出現——不是留一個標題配空白
  for (const label of ["Problem", "Goal", "Thinking", "Solution", "Result"]) {
    await expect(page.getByRole("heading", { name: label, exact: true })).toHaveCount(0);
  }
  // 但頁面本身正常
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI Website Workshop");
});

test("部分 Case Study 只顯示存在的區塊", async ({ page }) => {
  await page.goto("/work/yipage-identity");

  await expect(page.getByRole("heading", { name: "Problem", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solution", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thinking", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Result", exact: true })).toHaveCount(0);
});

test("無媒體時不顯示空的 Gallery", async ({ page }) => {
  await page.goto("/work/interior-studio");
  await expect(page.getByRole("heading", { name: "Gallery" })).toHaveCount(0);
});

test("來源類型標示於 Hero，不埋在頁尾（Spec §8.2 / §29）", async ({ page }) => {
  await page.goto("/work/interior-studio");
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();

  await page.goto("/work/yipage-identity");
  await expect(page.getByText("Internal Product", { exact: true }).first()).toBeVisible();
});

test("未知 slug 回 404（Spec §8.10）", async ({ page }) => {
  const response = await page.goto("/work/does-not-exist");
  expect(response?.status()).toBe(404);
});

test("每件作品有獨立 metadata（Spec §32）", async ({ page }) => {
  await page.goto("/work/interior-studio");
  await expect(page).toHaveTitle(/山序設計/);

  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toContain("/work/interior-studio");

  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  expect(ogTitle).toContain("山序設計");

  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description?.length ?? 0).toBeGreaterThan(10);

  // 換一件作品，metadata 必須跟著換——不是全站共用一組
  await page.goto("/work/ai-website-workshop");
  await expect(page).toHaveTitle(/AI Website Workshop/);
  const canonical2 = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical2).toContain("/work/ai-website-workshop");
});

test("Related Projects 不含自己且可點擊", async ({ page }) => {
  await page.goto("/work/interior-studio");

  const related = page.getByRole("heading", { name: "其他作品" });
  await expect(related).toBeVisible();

  const section = page.locator("section").filter({ has: related });
  await expect(section.getByRole("link", { name: "山序設計 / Interior Studio" })).toHaveCount(0);
  expect(await section.getByRole("link").count()).toBeGreaterThan(0);
});

test("從列表可進入詳細頁", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("link", { name: "山序設計 / Interior Studio" }).click();
  await expect(page).toHaveURL(/\/work\/interior-studio$/);
});

test("麵包屑可回到列表", async ({ page }) => {
  await page.goto("/work/interior-studio");
  await page
    .getByRole("navigation", { name: "麵包屑" })
    .getByRole("link", { name: "作品" })
    .click();
  await expect(page).toHaveURL(/\/work$/);
});

for (const viewport of VIEWPORTS) {
  test(`/work/[slug] @ ${viewport.name}px 無 a11y 違規且無橫向捲動`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/work/interior-studio");

    expect(await scan(page)).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(0);
  });
}
