import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 後台專案與工時（CR-004 / Phase B BF）
 *
 * ── 這一組驗的是「談完之後，做的過程接得上」 ──────────────────
 *
 * 報價與專案是兩件事，而它們之間那一步最容易斷：
 * 成交了要開始做，卻得自己記得到另一頁重打一次名稱與客戶。
 * 重打的那些欄位一定會有一次打錯，而打錯之後兩張表就對不起來了。
 *
 * 所以這裡走完整條：成交的報價 → 開成專案 → 記工時 → 交付。
 */

const ADMIN_EMAIL = "e2e-eng@1page.test";
const ADMIN_PASSWORD = "E2e!Eng#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

const CLIENT_NAME = "E2E 專案測試客戶";
const DEAL_TITLE = "E2E 品牌識別設計";

let adminId: string | undefined;
let clientId: string | undefined;
let dealId: string | undefined;

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

  // 已成交的報價——「開成專案」那顆按鈕只在這個階段出現
  const deals = await sql(
    `insert into deals (client_id, title, stage, amount)
     values ('${clientId}', '${DEAL_TITLE}', 'won', 60000)
     returning id`,
  );
  dealId = deals[0].id;
});

test.afterAll(async () => {
  await sql(
    `delete from activities where subject_id in (select id from engagements where client_id = '${clientId}');
     delete from engagements where client_id = '${clientId}';
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

/** 開那個測試專案，沒有就用 SQL 建一個。每一條測試都要自給自足 */
async function openEngagement(page: Page) {
  const existing = await sql(`select id from engagements where deal_id = '${dealId}'`);

  let engagementId = existing[0]?.id as string | undefined;

  if (!engagementId) {
    const created = await sql(
      `insert into engagements (client_id, deal_id, title, status)
       values ('${clientId}', '${dealId}', '${DEAL_TITLE}', 'active')
       returning id`,
    );
    engagementId = created[0].id as string;
  }

  await page.goto(`${base}/engagements/${engagementId}`);
  return engagementId;
}

test("成交的報價按一下就開成專案，而報價本身不變", async ({ page }) => {
  await signInAdmin(page, `${base}/deals/${dealId}`);

  await page.getByRole("button", { name: "開成專案" }).click();

  /*
   * 按第二次不該多一個。
   *
   * 這是 `convertLeadToClient` 踩過的同一個坑：沒有擋的話，
   * 手滑按兩下就有兩個一模一樣的專案，而兩個都會出現在列表上。
   */
  await expect(page.getByRole("button", { name: "已經開案了" })).toBeDisabled({ timeout: 15_000 });

  const engagements = await sql(
    `select client_id, title from engagements where deal_id = '${dealId}'`,
  );
  expect(engagements.length, "按一次只該開一個案").toBe(1);
  expect(engagements[0].title, "名稱要帶過來，不該要人重打").toBe(DEAL_TITLE);
  expect(engagements[0].client_id).toBe(clientId);

  /*
   * 報價完全沒有被改動。
   *
   * 與 lead → client 同一個設計：談的過程與做的過程是兩件事，
   * 而請款時「當初報多少」必須還查得到。
   */
  const deal = await sql(`select stage, amount from deals where id = '${dealId}'`);
  expect(deal[0].stage).toBe("won");
  expect(Number(deal[0].amount)).toBe(60000);
});

test("工時可以寫 1:30，不用自己換算成分鐘", async ({ page }) => {
  await signInAdmin(page, `${base}/engagements`);
  const engagementId = await openEngagement(page);

  await page.getByLabel("長度").fill("1:30");
  await page.getByLabel("做了什麼").fill("E2E 提案討論");
  await page.getByRole("button", { name: "記一筆工時" }).click();

  await expect(page.getByText("E2E 提案討論")).toBeVisible({ timeout: 15_000 });

  /*
   * 顯示成「1 小時 30 分」，不是「1.5 小時」。
   *
   * 資料庫存分鐘就是為了避開「0.30 是 18 分還是 30 分」的誤會，
   * 顯示時換回小數等於把那個誤會請回來——而它在對帳時會變成真的錢。
   */
  await expect(page.getByText("1 小時 30 分").first()).toBeVisible();

  // 存進去的真的是 90 分鐘
  const rows = await sql(
    `select minutes from time_entries where engagement_id = '${engagementId}' order by created_at desc limit 1`,
  );
  expect(rows[0].minutes).toBe(90);
});

test("長度打了看不懂的字，會說看不懂，而不是安靜記一個錯的數字", async ({ page }) => {
  await signInAdmin(page, `${base}/engagements`);
  const engagementId = await openEngagement(page);

  const before = await sql(
    `select count(*)::int as n from time_entries where engagement_id = '${engagementId}'`,
  );

  await page.getByLabel("長度").fill("一小時半");
  await page.getByRole("button", { name: "記一筆工時" }).click();

  await expect(page.locator('p[role="alert"]')).toContainText("看不懂這個長度");

  /*
   * ⚠️ 這一半才是重點：猜一個值的話，打錯字的那一次會安靜地記下
   * 一個錯的工時，而那筆資料看起來跟正常的一模一樣，事後沒有人發現。
   */
  const after = await sql(
    `select count(*)::int as n from time_entries where engagement_id = '${engagementId}'`,
  );
  expect(after[0].n, "看不懂的輸入不該留下任何一筆").toBe(before[0].n);
});

test("標成已交付卻沒填日期，會被擋下來", async ({ page }) => {
  await signInAdmin(page, `${base}/engagements`);
  await openEngagement(page);

  await page.getByLabel("狀態").selectOption("delivered");

  // 選了已交付，交付日期欄位才出現——平常擺著它是空的，會被當裝飾略過
  await expect(page.getByLabel("交付日期")).toBeVisible();

  await page.getByRole("button", { name: "儲存" }).click();

  await expect(page.locator('p[role="alert"]')).toContainText("要填交付日期");

  const rows = await sql(`select status from engagements where deal_id = '${dealId}'`);
  expect(rows[0].status, "被擋下來的送出不該改到資料").not.toBe("delivered");
});

test("里程碑可以打勾，也可以退回", async ({ page }) => {
  await signInAdmin(page, `${base}/engagements`);
  const engagementId = await openEngagement(page);

  await page.getByLabel("里程碑").fill("初稿交付");
  await page.getByLabel("請款比例（%）").fill("50");
  await page.getByRole("button", { name: "新增里程碑" }).click();

  await expect(page.getByText("初稿交付")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("尚未完成")).toBeVisible();

  await page.getByRole("button", { name: "標記完成" }).click();
  await expect(page.getByText(/已完成 \d{4}-\d{2}-\d{2}/)).toBeVisible({ timeout: 15_000 });

  /*
   * 退回也要能走。
   *
   * 打勾與退回如果是兩個 action，很容易只做一半——
   * 而「不小心按了完成」是真的會發生的事。
   */
  await page.getByRole("button", { name: "退回未完成" }).click();
  await expect(page.getByText("尚未完成")).toBeVisible({ timeout: 15_000 });

  const rows = await sql(
    `select done_on from milestones where engagement_id = '${engagementId}' and title = '初稿交付'`,
  );
  expect(rows[0].done_on, "退回之後不該留著一個舊日期").toBeNull();
});
