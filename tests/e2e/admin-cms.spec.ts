import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 內容管理（CR-004 / Phase B BH）
 *
 * ── 這一組驗的是「改完之後，每一個讀取端都跟著變」 ────────────
 *
 * 文案原本寫死在 `src/config/*.ts`——改一句話要走一次 commit 與部署。
 * 待辦上「FAQ 四個空缺」之所以一直沒補，正是因為那個成本。
 *
 * 搬進 CMS 之後最危險的失敗方式不是「存不進去」，是**存進去了但
 * 只有一半跟著變**：首頁顯示新價格，而 AI 顧問的系統提示還是舊的。
 * 那件事沒有任何地方會報錯，只有問到價格的那個潛在客戶會發現。
 */

const ADMIN_EMAIL = "e2e-cms@1page.test";
const ADMIN_PASSWORD = "E2e!Cms#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

const MARKER = "E2E 測試用的價格說明（會被還原）";

let adminId: string | undefined;

test.beforeAll(async () => {
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT");

  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );
});

test.afterAll(async () => {
  /*
   * 把整份文件刪掉，而不是寫回舊值。
   *
   * 刪掉之後讀取端會退回程式碼裡的預設值——那正是「還沒在後台改過」
   * 的狀態，也就是測試開始之前的樣子。寫回舊值反而會留下一列，
   * 讓後台顯示「最後更新 …」，與測試前不一樣。
   */
  await sql(`delete from cms_documents where key in ('pricing.tiers', 'faq.list')`);

  if (adminId) await deleteMember(adminId);
});

async function openCms(page: Page, key: string) {
  await page.goto(`${base}/cms`);

  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(new RegExp(base), { timeout: 20_000 });
    await page.goto(`${base}/cms`);
  }

  await page.goto(`${base}/cms/${key}`);
  await expect(page.locator("textarea[name='content']")).toBeVisible();
}

test("還沒在後台改過時，用的是程式碼裡的預設內容", async ({ page }) => {
  /*
   * 這一條看起來不重要，但它是整個 fallback 設計的驗證：
   * 部署了新程式碼、還沒有人按過儲存，網站的行為必須與搬進 CMS
   * 之前**完全一樣**。
   */
  await openCms(page, "pricing.tiers");
  await page.goto(`${base}/cms`);

  await expect(
    page.getByText("還沒在後台改過，目前用的是程式碼裡的預設內容").first(),
  ).toBeVisible();
});

test("改了價格，首頁跟著變", async ({ page }) => {
  await openCms(page, "pricing.tiers");

  const textarea = page.locator("textarea[name='content']");
  const current = JSON.parse((await textarea.inputValue()) || "{}");

  current.tiers[0].summary = MARKER;
  await textarea.fill(JSON.stringify(current, null, 2));

  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  await expect(page.getByText(MARKER)).toBeVisible();
});

test("壞掉的 JSON 存不進去，而且說得出哪裡不對", async ({ page }) => {
  await openCms(page, "faq.list");

  const textarea = page.locator("textarea[name='content']");
  await textarea.fill('{"entries": [{"id": "BAD ID", "question": "", "answer": "x"}]}');

  await page.getByRole("button", { name: "儲存" }).click();

  /*
   * 訊息要指名是哪一個欄位。
   *
   * 只說「格式不正確」的話，一份三百行的 JSON 裡有一個欄位打錯，
   * 使用者只能一行一行看。zod 的 path 就是為了這件事。
   */
  const status = page.getByRole("status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("entries");
});

test("存過之後有版本紀錄，而且回得去", async ({ page }) => {
  await openCms(page, "pricing.tiers");

  const textarea = page.locator("textarea[name='content']");
  const first = JSON.parse(await textarea.inputValue());
  first.tiers[0].summary = "第一版的說明";
  await textarea.fill(JSON.stringify(first, null, 2));
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.reload();
  const second = JSON.parse(await textarea.inputValue());
  second.tiers[0].summary = "第二版的說明";
  await textarea.fill(JSON.stringify(second, null, 2));
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.reload();
  await expect(page.getByText("第二版的說明")).toBeVisible();

  // 還原成上一版
  await page.getByRole("button", { name: "還原成這一版" }).first().click();

  await expect
    .poll(async () => (await textarea.inputValue()).includes("第一版的說明"), { timeout: 15_000 })
    .toBe(true);
});
