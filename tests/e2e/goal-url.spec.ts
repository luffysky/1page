import { expect, type Page, test } from "@playwright/test";

/**
 * Home Goal Context 的 URL 行為（Plan §5）。
 *
 * 1B 時透過臨時的 GoalDebugPanel 驗證；1D 之後真正的 Goal Selector 已存在，
 * 改為透過真實 UI 驗證——測試應該打在使用者實際會碰到的東西上，
 * 而不是為了測試而留著的除錯裝置。
 */

const GOAL_LABEL = {
  website: "我要一個網站",
  brand: "我要建立品牌",
  marketing: "我要開始行銷",
  content: "我要製作內容",
  ai: "我要導入 AI",
  unsure: "我還不知道需要什麼",
} as const;

type GoalId = keyof typeof GOAL_LABEL;

function goalButton(page: Page, goal: GoalId) {
  return page.getByRole("button", { name: new RegExp(GOAL_LABEL[goal]) });
}

/** 目前選定的 goal 由 aria-pressed 表達，這也是輔助技術讀到的狀態 */
async function expectSelected(page: Page, goal: GoalId) {
  await expect(goalButton(page, goal)).toHaveAttribute("aria-pressed", "true");
}

test("URL → state：?goal=ai 進入時即為已選取狀態", async ({ page }) => {
  await page.goto("/?goal=ai");
  await expectSelected(page, "ai");
});

test("非法值 fallback 為 unsure，頁面正常回應不 404", async ({ page }) => {
  const response = await page.goto("/?goal=banana");
  expect(response?.status()).toBe(200);
  await expectSelected(page, "unsure");
});

test("無參數時為 unsure，不套用任何篩選", async ({ page }) => {
  await page.goto("/");
  await expectSelected(page, "unsure");
  await expect(page.getByText(/已依「.*」篩選/)).toBeHidden();
});

test("state → URL：選取 goal 後網址同步更新", async ({ page }) => {
  await page.goto("/");
  await goalButton(page, "ai").click();

  await expect(page).toHaveURL(/\?goal=ai$/);
  await expectSelected(page, "ai");
});

test("切換 goal 不造成整頁重新載入", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    (window as unknown as { __noReload?: boolean }).__noReload = true;
  });

  await goalButton(page, "brand").click();
  await expect(page).toHaveURL(/\?goal=brand$/);

  const survived = await page.evaluate(
    () => (window as unknown as { __noReload?: boolean }).__noReload === true,
  );
  expect(survived).toBe(true);
});

test("選回 unsure 時把 goal 參數從網址移除", async ({ page }) => {
  await page.goto("/?goal=ai");
  await goalButton(page, "unsure").click();

  await expect(page).not.toHaveURL(/goal=/);
  await expectSelected(page, "unsure");
});

test("上一頁可回到前一個 goal", async ({ page }) => {
  await page.goto("/?goal=website");
  await expectSelected(page, "website");

  await goalButton(page, "ai").click();
  await expectSelected(page, "ai");

  // 必須等 URL 真的寫入才能上一頁：樂觀狀態更新刻意早於 URL 寫入
  // （Plan §5 的三段式同步），只等畫面就 goBack 會在歷史紀錄產生前退出去。
  await expect(page).toHaveURL(/\?goal=ai$/);

  await page.goBack();

  await expect(page).toHaveURL(/\?goal=website$/);
  await expectSelected(page, "website");
});

test("重新整理保留 goal", async ({ page }) => {
  await page.goto("/");
  await goalButton(page, "marketing").click();
  await expect(page).toHaveURL(/\?goal=marketing$/);

  await page.reload();
  await expectSelected(page, "marketing");
});

test("保留網址上的其他查詢參數（廣告進站情境）", async ({ page }) => {
  await page.goto("/?utm_source=ig");
  await goalButton(page, "website").click();

  await expect(page).toHaveURL(/utm_source=ig/);
  await expect(page).toHaveURL(/goal=website/);
});
