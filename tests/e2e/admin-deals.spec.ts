import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 後台報價與成交（CR-004 / Phase B BE）
 *
 * ── 這一組驗的是「不好意思寫的那一欄，系統不讓你跳過」 ──────────
 *
 * 一份 CRM 最容易退化成聯絡簿的地方，就是輸掉的案子被安靜地標成 lost
 * 然後沒有人寫為什麼。三個月後回頭看，只剩一排「未成交」——
 * 那份資料回答不了任何問題。
 *
 * 所以這裡兩個方向都要驗：
 *   1. 從畫面上跳過去，會看到一句**人看得懂**的話
 *   2. 繞過畫面直接寫資料庫，也會被擋——那才是真正的邊界
 *
 * ⚠️ 只驗第 1 條是不夠的。應用層的檢查會被下一條寫入路徑繞過
 * （匯入腳本、另一個 action），而繞過去的那些資料事後補不回來。
 */

const ADMIN_EMAIL = "e2e-deals@1page.test";
const ADMIN_PASSWORD = "E2e!Deals#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

const CLIENT_NAME = "E2E 報價測試客戶";
const DEAL_TITLE = "E2E 一頁式官網";

let adminId: string | undefined;
let clientId: string | undefined;

test.beforeAll(async () => {
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT");

  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );

  const rows = await sql(
    `insert into clients (name, kind, status, source)
     values ('${CLIENT_NAME}', 'company', 'active', 'e2e')
     returning id`,
  );
  clientId = rows[0].id;
});

test.afterAll(async () => {
  // deal_items / activities / notes 靠 cascade 或 subject_id 清
  await sql(
    `delete from notes where subject_id in (select id from deals where client_id = '${clientId}');
     delete from activities where subject_id in (select id from deals where client_id = '${clientId}');
     delete from deals where client_id = '${clientId}';
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

/**
 * 開那筆測試報價的詳細頁，沒有就先用 SQL 建一筆。
 *
 * ⚠️ 與 admin-crm 同樣的理由：每一條測試自給自足。
 * 依賴前一條的副作用時，單獨跑其中一條會紅，而紅的原因與程式碼無關。
 */
async function openDeal(page: Page) {
  const existing = await sql(
    `select id from deals where client_id = '${clientId}' and title = '${DEAL_TITLE}'`,
  );

  let dealId = existing[0]?.id as string | undefined;

  if (!dealId) {
    const created = await sql(
      `insert into deals (client_id, title, stage, amount)
       values ('${clientId}', '${DEAL_TITLE}', 'quoted', 48000)
       returning id`,
    );
    dealId = created[0].id as string;
  }

  await page.goto(`${base}/deals/${dealId}`);
  return dealId;
}

test("新增一筆報價，列表上看得到，金額也算進進行中的合計", async ({ page }) => {
  await signInAdmin(page, `${base}/deals/new`);

  await page.getByLabel("報價名稱").fill(DEAL_TITLE);
  await page.getByLabel("客戶").selectOption({ label: CLIENT_NAME });
  await page.getByLabel("階段").selectOption("quoted");
  await page.getByLabel("金額").fill("48000");
  await page.getByRole("button", { name: "儲存" }).click();

  // 存完直接進詳細頁——接下來要做的是加明細
  await page.waitForURL(new RegExp(`${base}/deals/[0-9a-f-]{36}`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: DEAL_TITLE })).toBeVisible();

  await page.goto(`${base}/deals`);
  await expect(page.getByRole("link", { name: new RegExp(DEAL_TITLE) })).toBeVisible();

  /*
   * 合計要真的把這筆算進去。
   *
   * 只驗「畫面上有一個數字」是沒有意義的守衛——那個數字寫死成 0 也會綠。
   * 所以拿資料庫算一次來比。
   */
  const expected = await sql(
    `select coalesce(sum(amount), 0)::float8 as total from deals
      where stage in ('inquiry', 'quoted', 'negotiating')`,
  );
  const total = Math.round(Number(expected[0].total));

  /*
   * 只找那一段合計，不是整頁找數字。
   *
   * 整頁找的話，卡片上那筆自己的金額也會被算成「合計顯示對了」——
   * 手上只有一筆時兩個數字剛好一樣，於是這條測試在真正該紅的情況下
   * 反而是綠的。
   */
  const summary = page.locator("p", { hasText: "進行中" }).first();
  await expect(summary).toContainText(`TWD ${total.toLocaleString("en-US")}`);
});

test("標成未成交卻沒寫原因，會看到一句人看得懂的話", async ({ page }) => {
  await signInAdmin(page, `${base}/deals`);
  await openDeal(page);

  await page.getByLabel("階段").selectOption("lost");

  // 選了 lost，原因欄位才出現——平常擺著它九成時間是空的，會被當裝飾略過
  await expect(page.getByLabel("未成交的原因")).toBeVisible();

  await page.getByRole("button", { name: "儲存" }).click();

  /*
   * ⚠️ `getByRole("alert")` 會多抓到 Next 自己的路由播報器
   * （`#__next-route-announcer__`，一個永遠存在的空 div）。
   * 這裡指定的是表單裡那一個。
   */
  await expect(page.locator('p[role="alert"]')).toContainText("要寫原因");

  // 而且沒有真的存進去
  const rows = await sql(
    `select stage from deals where client_id = '${clientId}' and title = '${DEAL_TITLE}'`,
  );
  expect(rows[0].stage, "被擋下來的送出不該改到資料").not.toBe("lost");
});

test("繞過畫面直接寫資料庫，一樣被擋", async () => {
  /*
   * 這一條沒有開瀏覽器，因為它驗的正是「不經過瀏覽器的那條路」。
   *
   * 應用層的那句話是為了說人話；真正的邊界是資料庫的 check constraint。
   * 兩者少了任何一個，這個欄位遲早會出現空值。
   */
  await expect(
    sql(
      `insert into deals (client_id, title, stage) values ('${clientId}', 'E2E 直接寫入', 'lost')`,
    ),
  ).rejects.toThrow(/deals_lost_needs_reason/);
});

test("改階段會自己記進時間軸", async ({ page }) => {
  await signInAdmin(page, `${base}/deals`);
  const dealId = await openDeal(page);

  await page.getByLabel("階段").selectOption("negotiating");
  await page.getByRole("button", { name: "儲存" }).click();

  await page.waitForURL(new RegExp(`${base}/deals$`), { timeout: 20_000 });
  await page.goto(`${base}/deals/${dealId}`);

  await expect(page.getByText("改了階段")).toBeVisible();
  await expect(page.getByText("quoted → negotiating")).toBeVisible();
});

test("明細加起來與報價金額對不上時，畫面會說出來", async ({ page }) => {
  await signInAdmin(page, `${base}/deals`);
  const dealId = await openDeal(page);

  await page.getByLabel("項目說明").fill("首頁設計");
  await page.getByLabel("數量").fill("1");
  await page.getByLabel("單價").fill("30000");
  await page.getByRole("button", { name: "新增明細" }).click();

  await expect(page.getByText("首頁設計")).toBeVisible({ timeout: 15_000 });

  /*
   * 報價金額是 48000，明細只有 30000。
   *
   * 系統不自作主張改任何一邊——兩個都是人填的——但要指出來，
   * 因為寄出去的報價單與系統裡的數字差一截是真的會發生的事。
   */
  await expect(page.getByRole("status")).toContainText("不一樣");

  // 補到一樣就不該再吵。這是反方向：警告要在問題消失時消失
  await page.getByLabel("項目說明").fill("內容撰寫");
  await page.getByLabel("數量").fill("1");
  await page.getByLabel("單價").fill("18000");
  await page.getByRole("button", { name: "新增明細" }).click();

  await expect(page.getByText("內容撰寫")).toBeVisible({ timeout: 15_000 });
  await page.goto(`${base}/deals/${dealId}`);

  await expect(page.getByText("明細合計 TWD 48,000")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});
