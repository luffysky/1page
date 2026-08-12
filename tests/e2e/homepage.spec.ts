import { expect, test } from "@playwright/test";

/**
 * 1D 的 Gate 第 5 項行為驗證。
 *
 * 核心是 Plan §6.1 的承諾：選一個 goal，首頁四處同步反應。
 * 那是 Goal Selector 從「六張漂亮墓碑」變成 Context Controller 的分界線，
 * 也是最容易做成「有選但沒反應」的地方。
 */

test("IA 順序與 Spec §4 一致", async ({ page }) => {
  await page.goto("/");

  const headings = await page.locator("main h1, main h2").allTextContents();
  const flat = headings.join(" | ");

  const expectedOrder = [
    "從第一頁",
    "你今天想完成什麼",
    "不只說我們會做",
    "自己先試穿",
    "先聊需求",
    "會用 AI",
    "需要的是成果",
    "先試，再決定",
    "合作流程",
    "你不需要",
  ];

  let cursor = -1;
  for (const fragment of expectedOrder) {
    const index = flat.indexOf(fragment);
    expect(index, `找不到或順序錯誤：${fragment}`).toBeGreaterThan(cursor);
    cursor = index;
  }
});

test("選 goal 後四處同步反應（Plan §6.1）", async ({ page }) => {
  await page.goto("/");

  // 未篩選時三件作品全數呈現
  await expect(page.getByRole("link", { name: "AI Website Workshop" })).toBeVisible();
  await expect(page.getByRole("link", { name: "山序設計 / Interior Studio" })).toBeVisible();

  await page.getByRole("button", { name: /我要導入 AI/ }).click();

  // 1. Selected Work → 只剩 ai / automation 分類
  await expect(page.getByRole("link", { name: "AI Website Workshop" })).toBeVisible();
  await expect(page.getByRole("link", { name: "山序設計 / Interior Studio" })).toBeHidden();

  // 2. Template Experience → 模板清單收斂到 product 分類，預覽跟著換過去。
  //    4B 之前這裡只驗一句「將依…篩選模板分類」的說明文字——
  //    那證明的是「我們知道要篩什麼」，不是「真的篩了」。
  await expect(page.getByText(/依「我要導入 AI」篩選，共 1 套/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Product/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // 3. Services → highlight AI & Automation
  await expect(
    page.locator("li[aria-current='true']").filter({ hasText: "AI & Automation" }),
  ).toBeVisible();

  // 4. Agent → 開場情境跟著換
  //
  // 5E 之前這裡讀的是殼上一個顯示 `initialIntent：ai` 的除錯徽章。
  // 那是鷹架，接上真的對話之後就拆了——同步這件事現在用人話講出來，
  // 而測試也應該讀人看得到的那一句，不是讀鷹架。
  await expect(page.locator("#advisor")).toContainText("「我要導入 AI」的情境開場");

  // URL 同步
  await expect(page).toHaveURL(/\?goal=ai$/);
});

test("直接以 ?goal= 進站即為已篩選狀態", async ({ page }) => {
  await page.goto("/?goal=brand");

  await expect(page.getByRole("link", { name: "一頁起家" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "AI Website Workshop" })).toBeHidden();
  await expect(
    page.locator("li[aria-current='true']").filter({ hasText: "Brand & Design" }),
  ).toBeVisible();
});

test("篩選後沒有作品時給出誠實說明，不偷偷顯示全部", async ({ page }) => {
  await page.goto("/?goal=content");

  await expect(page.getByText(/目前還沒有.*相關的公開作品/)).toBeVisible();
  await expect(page.getByRole("link", { name: "AI Website Workshop" })).toBeHidden();
});

test("完整六級價格呈現於首頁（Spec §26.1）", async ({ page }) => {
  await page.goto("/");
  for (const tier of [
    "AI Advisor",
    "Website Workshop",
    "Template Build",
    "Semi-Custom",
    "Custom",
  ]) {
    await expect(page.getByRole("heading", { name: tier, exact: true })).toBeVisible();
  }
});

test("作品皆標示來源類型，Demo 不冒充客戶案例（Spec §8.2 / §29）", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo").first()).toBeVisible();
  await expect(page.getByText("Internal Product")).toBeVisible();
  await expect(page.getByText("Client Project")).toHaveCount(0);
});

test("Hero 次要 CTA 導向作品，而非服務（Spec §5 / §45.1）", async ({ page }) => {
  await page.goto("/");
  const secondary = page.getByRole("link", { name: "看看我們做過什麼" });
  await expect(secondary).toBeVisible();
  // 用 /#work 而非 #work：同一個 Hero 元件若日後出現在其他頁面，
  // 純錨點會失效。導向的目標仍是作品區。
  await expect(secondary).toHaveAttribute("href", "/#work");
});

test("Footer 呈現 AI Disclosure（Spec §28）", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI-assisted · Human-reviewed").last()).toBeVisible();
});
