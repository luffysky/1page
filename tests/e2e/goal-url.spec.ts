import { expect, test } from "@playwright/test";

/**
 * 1B 的 Gate 第 5 項。
 *
 * 1B 幾乎沒有視覺產出，這一關要驗的是 URL 行為（Plan §5）。
 * 單元測試以 mock 驗證 Provider 邏輯；這裡在真實瀏覽器裡驗證整條鏈路：
 * server 讀 searchParams → Provider → 使用者互動 → 寫回 URL → 上一頁。
 *
 * 需要開發環境（debug panel 僅於 development 渲染）。
 */

test("URL → state：?goal=ai 進入時 context 即為 ai", async ({ page }) => {
  await page.goto("/?goal=ai");
  await expect(page.getByTestId("debug-goal")).toHaveText("ai");
  await expect(page.getByTestId("debug-filtering")).toHaveText("true");
});

test("非法值 fallback 為 unsure，頁面正常回應不 404", async ({ page }) => {
  const response = await page.goto("/?goal=banana");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("debug-goal")).toHaveText("unsure");
  await expect(page.getByTestId("debug-filtering")).toHaveText("false");
});

test("無參數時為 unsure，不套用任何篩選", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("debug-goal")).toHaveText("unsure");
});

test("state → URL：選取 goal 後網址同步更新", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "我要導入 AI" }).click();

  await expect(page).toHaveURL(/\?goal=ai$/);
  await expect(page.getByTestId("debug-goal")).toHaveText("ai");
});

test("切換 goal 不造成整頁重新載入", async ({ page }) => {
  await page.goto("/");

  // 在 window 上留一個標記；整頁 reload 會清掉它，client 端導航則會保留
  await page.evaluate(() => {
    (window as unknown as { __noReload?: boolean }).__noReload = true;
  });

  await page.getByRole("button", { name: "我要建立品牌" }).click();
  await expect(page).toHaveURL(/\?goal=brand$/);

  const survived = await page.evaluate(
    () => (window as unknown as { __noReload?: boolean }).__noReload === true,
  );
  expect(survived).toBe(true);
});

test("選回 unsure 時把 goal 參數從網址移除", async ({ page }) => {
  await page.goto("/?goal=ai");
  await page.getByRole("button", { name: "我還不知道需要什麼" }).click();

  await expect(page).not.toHaveURL(/goal=/);
  await expect(page.getByTestId("debug-goal")).toHaveText("unsure");
});

test("上一頁可回到前一個 goal", async ({ page }) => {
  await page.goto("/?goal=website");
  await expect(page.getByTestId("debug-goal")).toHaveText("website");

  await page.getByRole("button", { name: "我要導入 AI" }).click();
  await expect(page.getByTestId("debug-goal")).toHaveText("ai");

  // 必須等 URL 真的寫入才能上一頁。
  // 樂觀狀態更新刻意早於 URL 寫入（Plan §5 的三段式同步），
  // 只等畫面文字就 goBack 會在歷史紀錄產生前退出去。
  await expect(page).toHaveURL(/\?goal=ai$/);

  await page.goBack();

  await expect(page).toHaveURL(/\?goal=website$/);
  await expect(page.getByTestId("debug-goal")).toHaveText("website");
});

test("重新整理保留 goal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "我要開始行銷" }).click();
  await expect(page).toHaveURL(/\?goal=marketing$/);

  await page.reload();
  await expect(page.getByTestId("debug-goal")).toHaveText("marketing");
});

test("保留網址上的其他查詢參數（廣告進站情境）", async ({ page }) => {
  await page.goto("/?utm_source=ig");
  await page.getByRole("button", { name: "我要一個網站" }).click();

  await expect(page).toHaveURL(/utm_source=ig/);
  await expect(page).toHaveURL(/goal=website/);
});
