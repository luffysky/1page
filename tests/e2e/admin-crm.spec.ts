import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 後台 CRM：客戶與聯絡記錄（CR-004 / Phase B BD）
 *
 * ── 這一組驗的是「詢問變成客戶之後，該帶的東西都帶過來了」 ────
 *
 * `leads` 從 Phase 5 起就存著訪客留下的需求，而在 BD 之前它只能看與回信。
 * 轉成客戶最容易做錯的兩件事：
 *
 *   1. 把 lead 直接改成客戶——那樣「他當初說的」與「我們後來改的」
 *      就分不開了，而談價格談到一半時那件事會很重要
 *   2. 聯絡方式沒帶過來，於是要再打一次
 *
 * 所以這裡走完整條：收件匣按建立客戶 → 客戶列表看得到 →
 * 聯絡人已經在裡面 → 原始詢問仍然原封不動。
 */

const ADMIN_EMAIL = "e2e-crm@1page.test";
const ADMIN_PASSWORD = "E2e!Crm#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

const LEAD_BUSINESS = "E2E 測試商號";
const LEAD_CONTACT = "E2E 聯絡人";
const LEAD_EMAIL = "e2e-lead@example.test";

let adminId: string | undefined;
let leadId: string | undefined;

test.beforeAll(async () => {
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT");

  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );

  const rows = await sql(
    `insert into leads (business_name, business_industry, contact_name, contact_email, source)
     values ('${LEAD_BUSINESS}', '測試業', '${LEAD_CONTACT}', '${LEAD_EMAIL}', 'agent')
     returning id`,
  );
  leadId = rows[0].id;
});

test.afterAll(async () => {
  /*
   * 順序有意義：先解開 lead 的關聯再刪客戶。
   *
   * 反過來的話 `on delete set null` 會先把 client_id 清掉，
   * 那筆測試用的 lead 就留在收件匣裡，而下一次跑測試會看到它。
   */
  await sql(
    `delete from client_contacts where client_id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}' and client_id is not null);
     delete from notes where subject_id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}' and client_id is not null);
     delete from activities where subject_id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}' and client_id is not null);
     delete from clients where id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}' and client_id is not null);
     delete from leads where business_name = '${LEAD_BUSINESS}';`,
  );

  if (adminId) await deleteMember(adminId);
});

/**
 * 打開那個測試客戶的詳細頁。
 *
 * ⚠️ 不用 `getByRole("link", { name: /…/ })`。
 * 那個連結的可及名稱是整張卡片的文字（名稱＋類型＋產業＋狀態），
 * 而卡片會在 RSC 串流回來時重新掛載——Playwright 等到的是一個
 * 一直被換掉的元素，於是點擊卡在「等待可操作」直到逾時。
 *
 * 用 href 定位就沒有這個問題：它比對的是屬性，不是會變的文字。
 */
async function openClient(page: Page) {
  /*
   * 客戶不存在就直接用 SQL 建一個。
   *
   * ⚠️ 讓每一條測試自給自足，不要依賴前一條的副作用。
   * 依賴的話，單獨跑其中一條（`-g`）會紅，而紅的原因與程式碼無關——
   * 那種紅燈久了就會被當成雜訊。
   *
   * 轉換那條測試自己會建，這裡只是補上其餘測試需要的前提。
   */
  const existing = await sql(
    `select client_id from leads where business_name = '${LEAD_BUSINESS}' and client_id is not null`,
  );

  let clientId = existing[0]?.client_id as string | undefined;

  if (!clientId) {
    const created = await sql(
      `with c as (
         insert into clients (name, kind, industry, status, source)
         values ('${LEAD_BUSINESS}', 'company', '測試業', 'prospect', 'lead')
         returning id
       )
       update leads set client_id = (select id from c)
        where business_name = '${LEAD_BUSINESS}'
        returning client_id`,
    );
    clientId = created[0]?.client_id as string;

    await sql(
      `insert into client_contacts (client_id, name, email, is_primary)
       values ('${clientId}', '${LEAD_CONTACT}', '${LEAD_EMAIL}', true)`,
    );
  }

  await page.goto(`${base}/clients/${clientId}`);
}

async function signInAdmin(page: Page, path: string) {
  await page.goto(path);

  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(new RegExp(base), { timeout: 20_000 });
    await page.goto(path);
  }
}

test("詢問轉成客戶，聯絡方式一起帶過來，而原始詢問不變", async ({ page }) => {
  await signInAdmin(page, `${base}/inbox`);

  const card = page.locator("li", { hasText: LEAD_BUSINESS });
  await expect(card.getByRole("button", { name: "建立客戶" })).toBeEnabled();
  await card.getByRole("button", { name: "建立客戶" }).click();

  // 轉過之後那顆按鈕要變成不可按——不然按第二次會多一個一模一樣的客戶
  await expect(card.getByRole("button", { name: "已建立客戶" })).toBeDisabled({ timeout: 15_000 });

  await page.goto(`${base}/clients`);
  await openClient(page);

  // 聯絡方式帶過來了，而且是主要聯絡人
  await expect(page.getByText(LEAD_CONTACT)).toBeVisible();
  await expect(page.getByText(LEAD_EMAIL)).toBeVisible();
  await expect(page.getByText("主要").first()).toBeVisible();

  /*
   * 原始詢問完全沒有被改動。
   *
   * 這是整個設計的核心：leads 是證據，clients 是我們的理解。
   * 轉換只在 lead 身上補一個 client_id 指過去。
   */
  const lead = await sql(
    `select business_name, contact_email, client_id from leads where id = '${leadId}'`,
  );
  expect(lead[0].business_name).toBe(LEAD_BUSINESS);
  expect(lead[0].contact_email).toBe(LEAD_EMAIL);
  expect(lead[0].client_id, "轉換之後應該指向新建的客戶").not.toBeNull();
});

test("改狀態會自己記進時間軸，不靠人記得寫", async ({ page }) => {
  await signInAdmin(page, `${base}/clients`);
  await openClient(page);

  await page.getByLabel("狀態").selectOption("active");
  await page.getByRole("button", { name: "儲存" }).click();

  await page.waitForURL(new RegExp(`${base}/clients$`), { timeout: 20_000 });
  await openClient(page);

  /*
   * 時間軸由資料庫的 trigger 寫，不是由 action 寫。
   *
   * 靠呼叫端的話，漏掉的那個操作就是時間軸上一段空白——
   * 而「沒發生過」與「發生了但沒記」在畫面上長得一模一樣。
   */
  await expect(page.getByText("改了狀態")).toBeVisible();
  await expect(page.getByText("prospect → active")).toBeVisible();
});

test("按了儲存但什麼都沒改，不會多一筆時間軸", async ({ page }) => {
  await signInAdmin(page, `${base}/clients`);
  await openClient(page);

  const before = await sql(
    `select count(*)::int as n from activities where subject_id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}')`,
  );

  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForURL(new RegExp(`${base}/clients$`), { timeout: 20_000 });

  const after = await sql(
    `select count(*)::int as n from activities where subject_id in
       (select client_id from leads where business_name = '${LEAD_BUSINESS}')`,
  );

  // 按了儲存但沒改東西不是一個事件。記下來的話時間軸會被雜訊塞滿
  expect(after[0].n, "沒有任何變更卻多記了一筆").toBe(before[0].n);
});

test("加聯絡人並設為主要，原本那位就不再是主要", async ({ page }) => {
  await signInAdmin(page, `${base}/clients`);
  await openClient(page);

  await page.getByLabel("姓名").fill("第二位聯絡人");
  await page.getByLabel("Email").fill("second@example.test");
  await page.getByLabel("設為主要聯絡人").check();
  await page.getByRole("button", { name: "新增聯絡人" }).click();

  await expect(page.getByText("第二位聯絡人")).toBeVisible({ timeout: 15_000 });

  /*
   * 「主要」只能有一個。資料庫有部分唯一索引擋著，
   * 但 action 要先讓位，否則使用者看到的是一個看不懂的資料庫錯誤。
   */
  /*
   * `exact: true` 是必要的：「主要」這兩個字也出現在上方的說明
   * （「主要聯絡人只能有一位」）與核取方塊的標籤（「設為主要聯絡人」）裡。
   * 不加的話這一條會數到三個，而失敗訊息完全看不出原因。
   */
  await expect(page.getByText("主要", { exact: true })).toHaveCount(1);
});

test("寫一則備註，看得到", async ({ page }) => {
  await signInAdmin(page, `${base}/clients`);
  await openClient(page);

  await page.getByLabel("新增一則備註").fill("E2E：今天通過電話，對方在考慮");
  await page.getByRole("button", { name: "新增備註" }).click();

  await expect(page.getByText("E2E：今天通過電話，對方在考慮")).toBeVisible({ timeout: 15_000 });
});
