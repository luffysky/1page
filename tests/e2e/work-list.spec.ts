import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { VIEWPORTS } from "../visual/viewports";

/**
 * `/work` 列表 + Filter（Spec §8.7）— 2B 的 Gate 第 5 項。
 */

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    }));
}

test("預設顯示全部作品", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/共 \d+ 件/)).toBeVisible();
  await expect(page.getByRole("link", { name: "山序設計 / Interior Studio" })).toBeVisible();
});

test("點選分類後只剩該分類作品，且 URL 同步", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("button", { name: "AI", exact: true }).click();

  await expect(page).toHaveURL(/\?category=ai$/);
  await expect(page.getByRole("link", { name: "AI Website Workshop" })).toBeVisible();
  await expect(page.getByRole("link", { name: "暮光甜室" })).toBeHidden();
});

test("來源類型與分類同時生效（AND）", async ({ page }) => {
  await page.goto("/work?category=web&type=internal");

  await expect(page.getByRole("link", { name: "一頁起家" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "山序設計 / Interior Studio" })).toBeHidden();
});

test("直接以網址進站即為已篩選狀態", async ({ page }) => {
  await page.goto("/work?category=brand");
  await expect(page.getByRole("button", { name: "Brand", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("非法篩選值退回 All，不 404", async ({ page }) => {
  const response = await page.goto("/work?category=banana&type=nope");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
});

test("空結果給出誠實說明，不偷偷退回全部", async ({ page }) => {
  await page.goto("/work?category=video");

  await expect(page.getByText(/目前沒有.*公開作品/)).toBeVisible();
  await expect(page.getByRole("link", { name: "山序設計 / Interior Studio" })).toBeHidden();
  await expect(page.getByRole("link", { name: "清除篩選" })).toBeVisible();
});

test("回到 All 時把參數從網址移除", async ({ page }) => {
  await page.goto("/work?category=ai");
  await page.getByRole("button", { name: "All" }).click();
  await expect(page).not.toHaveURL(/category=/);
});

test("上一頁可回到前一個篩選", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await expect(page).toHaveURL(/category=brand/);

  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page).toHaveURL(/category=ai/);

  await page.goBack();
  await expect(page).toHaveURL(/category=brand/);
  await expect(page.getByRole("button", { name: "Brand", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("標籤與服務篩選真的會改變結果，而且進得了網址（Spec §8.7）", async ({ page }) => {
  await page.goto("/work");
  const before = await page.locator("article").count();
  expect(before).toBeGreaterThan(1);

  await page.getByText("更多篩選").click();

  // 服務：Brand & Design。按下去結果要變少，不是變多也不是不變
  await page.getByRole("button", { name: "Brand & Design", exact: true }).click();
  await expect(page).toHaveURL(/service=brand-design/);

  const afterService = await page.locator("article").count();
  expect(afterService, "按了服務篩選，結果件數沒有變少").toBeLessThan(before);
  expect(afterService, "篩到一件都不剩，這條就證明不了篩選是對的").toBeGreaterThan(0);

  /*
   * 重新整理之後條件還在——這是「篩選狀態進網址」的整個重點：
   * 可分享、可作為廣告落地頁、重新整理不掉狀態。
   */
  await page.reload();
  await expect(page.getByRole("button", { name: "Brand & Design", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.locator("article").count()).toBe(afterService);
});

test("帶著 ?tag= 的連結進來時，那個條件看得見", async ({ page }) => {
  /*
   * 「更多篩選」預設是收起來的。從外部連結帶條件進來卻收著的話，
   * 使用者會看到一份被篩過的清單，而畫面上找不到是誰在篩——
   * 那比沒有篩選器更難理解。
   */
  await page.goto("/work?tag=landing-page");

  const chip = page.getByRole("button", { name: "Landing Page", exact: true });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("未知的 tag / service 參數退回不限，不是篩出零筆", async ({ page }) => {
  // 舊連結或亂打的網址不該讓人看到一片空白
  await page.goto("/work");
  const all = await page.locator("article").count();

  await page.goto("/work?tag=does-not-exist&service=nope");

  /*
   * 網址上那兩個參數會留著（server 不會替使用者改寫網址），
   * 但它們不該篩掉任何東西——與既有的「非法分類退回 All」同樣的處理。
   */
  expect(await page.locator("article").count(), "亂打的參數把作品篩光了").toBe(all);
});

test("每件作品都標示來源類型（Spec §8.2 / §29）", async ({ page }) => {
  await page.goto("/work");
  const cards = page.locator("article");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    await expect(
      cards.nth(i).getByText(/Demo|Concept Project|Internal Product|Client Project/),
    ).toBeVisible();
  }
});

test("沒有任何作品卡標為 Client Project", async ({ page }) => {
  await page.goto("/work");

  // 只掃作品卡。「Client Project」在篩選列中作為選項存在是正確的——
  // 那是可選的篩選條件，不是宣稱我們有客戶案例。
  await expect(page.locator("article").getByText("Client Project")).toHaveCount(0);
});

for (const viewport of VIEWPORTS) {
  test(`/work @ ${viewport.name}px 無 a11y 違規且無橫向捲動`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/work");

    expect(await scan(page)).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(0);
  });
}
