import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Project Builder（Spec §30）與 Workshop Gate（Spec §23 / §25）
 *
 * 7B 出口條件：「從 Agent、Template、Portfolio 任一入口進入都不需重填。」
 * 帶入的來源都在 sessionStorage 與網址裡，所以這一組可以完全不呼叫模型——
 * 直接把來源準備好，看表單有沒有接住。
 */

test("送出前不需要填滿，但至少要有聯絡方式", async ({ page }) => {
  await page.goto("/start");

  await page.getByLabel("想達成什麼").fill("想接到更多訂位");
  await page.getByRole("button", { name: "送出需求" }).click();

  // 每個欄位都合法，但這份東西沒有用——聯絡不到人。
  //
  // 指名表單裡的那一則：Next 的路由播報器本身也是 role="alert"，
  // 不限定範圍的話會抓到那個空的。
  await expect(page.locator("form").getByRole("alert")).toContainText("聯絡方式");
});

test("從 Template 過來時帶入品牌與產業（Spec §30）", async ({ page }) => {
  // ⚠️ CR-006：完整控制項搬到 /playground 了，這裡跟著搬。
  // 仍然是真的操作，不是直接寫 storage——那正是這條測試的意義。
  await page.goto("/playground");

  await page.getByLabel("品牌名稱").fill("南方麵包店");
  await page.getByLabel("產業").fill("烘焙坊");

  await page.goto("/start");

  await expect(page.getByLabel("品牌或店名")).toHaveValue("南方麵包店");
  await expect(page.getByLabel("產業")).toHaveValue("烘焙坊");
  await expect(page.getByText(/已經幫你帶入/)).toBeVisible();
});

test("Agent 問到的需求優先於預覽帶入的值", async ({ page }) => {
  // 他親口對 AI 說過的話，比他在預覽裡隨手打的更接近真的需求。
  await page.goto("/playground");
  await page.getByLabel("品牌名稱").fill("預覽裡打的");

  await page.evaluate(() => {
    window.sessionStorage.setItem(
      "1page:lead-context",
      JSON.stringify({ business: { name: "跟 AI 說的" }, contact: { email: "a@b.co" } }),
    );
  });

  await page.goto("/start");

  await expect(page.getByLabel("品牌或店名")).toHaveValue("跟 AI 說的");
  await expect(page.getByLabel("信箱")).toHaveValue("a@b.co");
});

test("從作品頁過來時帶著參考作品", async ({ page }) => {
  await page.goto("/start?ref=interior-studio");
  await expect(page.getByText("參考作品：")).toBeVisible();
});

test("網址上的參考作品是不可信輸入", async ({ page }) => {
  // 這個值會被顯示出來。只留 slug 的形狀，其餘丟掉。
  await page.goto("/start?ref=%3Cscript%3Ealert(1)%3C/script%3E");
  await expect(page.getByText("參考作品：")).toBeHidden();
});

test("Workshop Gate 說清楚界線，而且不是付款頁（Spec §23 / §25）", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "看 Website Workshop" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // §23：聊天免費，開始產生成果時收費，而且不按訊息數計價。
  await expect(dialog).toContainText("不是按訊息數計價");
  await expect(dialog).toContainText("免費就能做的");
  await expect(dialog).toContainText("Workshop 才有的");

  // §25：V1 不串金流。最後一步是留下需求，不是結帳。
  await expect(dialog).toContainText("還沒有線上付款");
  await expect(dialog.getByRole("link", { name: /說說你的專案/ })).toHaveAttribute(
    "href",
    "/start",
  );
});

test("Workshop Gate 可用 Escape 關閉", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "看 Website Workshop" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a11y：/start 沒有 critical / serious 違規", async ({ page }) => {
  await page.goto("/start");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(serious.map((violation) => violation.id)).toEqual([]);
});
