import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 請款與收款（CR-004 / Phase B BG）
 *
 * ── 這一組驗的是「帳要對得起來」 ──────────────────────────────
 *
 * 這一塊**沒有金流**，也不打算有。invoices 與 payments 是記帳：
 * 自己開發票、自己對帳，系統只把「誰欠多少、收了沒」記下來。
 *
 * 記帳系統最糟的失敗不是壞掉，是**安靜地算錯**：
 *   - 明細加了而總額沒動，那張單就這樣寄出去
 *   - 收了一半就把單標成已收款，「還差多少」再也算不出來
 *   - 兩張單用同一個編號
 *
 * 三件事都不會有任何錯誤訊息，所以三條都在這裡驗。
 */

const ADMIN_EMAIL = "e2e-invoice@1page.test";
const ADMIN_PASSWORD = "E2e!Invoice#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

const CLIENT_NAME = "E2E 請款測試客戶";
const INVOICE_NUMBER = "E2E-TEST-0001";

let adminId: string | undefined;
let clientId: string | undefined;

test.beforeAll(async () => {
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT");

  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );

  const clients = await sql(
    `insert into clients (name, kind, status, source)
     values ('${CLIENT_NAME}', 'company', 'active', 'e2e')
     returning id`,
  );
  clientId = clients[0].id;
});

test.afterAll(async () => {
  await sql(
    `delete from payments where invoice_id in (select id from invoices where client_id = '${clientId}');
     delete from invoice_lines where invoice_id in (select id from invoices where client_id = '${clientId}');
     delete from invoices where client_id = '${clientId}';
     delete from activities where subject_id = '${clientId}';
     delete from clients where id = '${clientId}';`,
  );

  if (adminId) await deleteMember(adminId);
});

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

/** 開那張測試請款單，沒有就用 SQL 建一張。每條測試都要自給自足 */
async function openInvoice(page: Page) {
  const existing = await sql(
    `select id from invoices where client_id = '${clientId}' and number = '${INVOICE_NUMBER}'`,
  );

  let invoiceId = existing[0]?.id as string | undefined;

  if (!invoiceId) {
    const created = await sql(
      `insert into invoices (client_id, number, status, issued_on, subtotal, tax, total)
       values ('${clientId}', '${INVOICE_NUMBER}', 'sent', current_date, 0, 0, 0)
       returning id`,
    );
    invoiceId = created[0].id as string;
  }

  await page.goto(`${base}/invoices/${invoiceId}`);
  return invoiceId;
}

test("加了明細，總額跟著變——而且是存進資料庫的那個總額", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  const invoiceId = await openInvoice(page);

  await page.getByLabel("項目說明").fill("網站設計");
  await page.getByLabel("數量").fill("2");
  await page.getByLabel("單價").fill("15000");
  await page.getByRole("button", { name: "新增明細" }).click();

  await expect(page.getByText("網站設計")).toBeVisible({ timeout: 15_000 });

  /*
   * ⚠️ 從資料庫驗，不是從畫面。
   *
   * 畫面上的數字可以是即時算出來的，而**寄出去的那張單用的是
   * invoices.total**。兩者不同步的話，客戶收到的金額與系統裡的不一樣，
   * 而畫面上完全看不出來。
   */
  const rows = await sql(`select subtotal, total from invoices where id = '${invoiceId}'`);
  expect(Number(rows[0].subtotal)).toBe(30000);
  expect(Number(rows[0].total)).toBe(30000);
});

test("收了一半，狀態不會自己變成已收款", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  const invoiceId = await openInvoice(page);

  // 先確保有金額可以收
  await sql(
    `update invoices set subtotal = 30000, tax = 0, total = 30000 where id = '${invoiceId}'`,
  );
  await page.reload();

  /*
   * ⚠️ `exact: true`：稅率那一欄的說明裡也有「金額」兩個字
   * （「金額由明細算出來後存下來」），而說明會進到可及名稱裡。
   * 不加的話這一條會在兩個框之間搖擺，而失敗訊息看不出原因。
   */
  await page.getByLabel("金額", { exact: true }).fill("10000");
  await page.getByLabel("方式").fill("匯款");
  await page.getByRole("button", { name: "記一筆收款" }).click();

  await expect(page.getByText("匯款")).toBeVisible({ timeout: 15_000 });

  /*
   * ⚠️ 這一條是整組的核心。
   *
   * 收了一半就翻狀態的話，「還差多少」就再也算不出來了——
   * 而那是這整張表存在的理由。什麼時候算收完是人的判斷
   * （可能有匯費、可能談了折讓）。
   */
  const rows = await sql(`select status from invoices where id = '${invoiceId}'`);
  expect(rows[0].status, "系統自己把單改成已收款了").toBe("sent");

  await expect(page.getByText(/還差 TWD 20,000/)).toBeVisible();
});

test("標成已收款但還沒收足，畫面會說出來", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  const invoiceId = await openInvoice(page);

  await sql(
    `update invoices set subtotal = 30000, tax = 0, total = 30000, status = 'paid' where id = '${invoiceId}'`,
  );
  await page.goto(`${base}/invoices/${invoiceId}`);

  /*
   * 系統不自作主張改狀態，但要把不一致指出來。
   * 不說的話，一張沒收完的單會安靜地待在「已收款」裡，
   * 而它就從催款清單上消失了。
   */
  await expect(page.getByRole("status")).toContainText("還差");
});

test("重複的編號被擋下來，而且說的是人話", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  await openInvoice(page);

  await page.goto(`${base}/invoices/new`);

  await page.getByLabel("請款單編號").fill(INVOICE_NUMBER);
  await page.getByLabel("客戶").selectOption({ label: CLIENT_NAME });
  await page.getByRole("button", { name: "儲存" }).click();

  /*
   * 資料庫回的是 `duplicate key value violates unique constraint
   * "invoices_number_key"`——看得懂那句話的人不需要這個系統。
   *
   * 重複的請款單編號是會計事故，所以由資料庫擋；
   * 而使用者要看到的是「換一個」。
   */
  await expect(page.locator('p[role="alert"]')).toContainText("已經用過");
});

test("草稿以外的狀態一定要有開立日期", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices/new`);

  await page.getByLabel("請款單編號").fill("E2E-TEST-NO-DATE");
  await page.getByLabel("客戶").selectOption({ label: CLIENT_NAME });
  await page.getByLabel("狀態").selectOption("sent");
  await page.getByRole("button", { name: "儲存" }).click();

  // 沒有日期的已寄出，之後回答不了「這筆帳放了多久」——而那是催款時唯一有用的資訊
  await expect(page.locator('p[role="alert"]')).toContainText("開立日期");

  const rows = await sql(
    `select count(*)::int as n from invoices where number = 'E2E-TEST-NO-DATE'`,
  );
  expect(rows[0].n, "被擋下來的送出不該留下任何一列").toBe(0);
});

test("畫面上說得出這裡不經手金流", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  await openInvoice(page);

  /*
   * 「記一筆收款」看起來很像會去跟銀行要錢。
   *
   * 這個專案沒有金流，而讓人以為有比沒有更糟——
   * 那是 SMTP 那件事的同一個教訓（做一顆按了會 422 的註冊按鈕，
   * 比沒有那顆按鈕更糟）。
   */
  await expect(page.getByText("這裡只是記帳，不會真的去收錢")).toBeVisible();
});

test("請款單詳細頁沒有 critical/serious 的 a11y 違規", async ({ page }) => {
  await signInAdmin(page, `${base}/invoices`);
  await openInvoice(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(serious.map((violation) => violation.id)).toEqual([]);
});
