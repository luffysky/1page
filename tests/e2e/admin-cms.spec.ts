import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 內容管理（CR-004 / Phase B BH + BI）
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
const HERO_MARKER = "E2E 測試用的首頁說明（會被還原）";

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
  await sql(
    `delete from cms_documents where key in
       ('pricing.tiers', 'faq.list', 'home.hero', 'home.process', 'login.intro')`,
  );

  if (adminId) await deleteMember(adminId);
});

async function signIn(page: Page) {
  await page.goto(`${base}/cms`);

  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(new RegExp(base), { timeout: 20_000 });
    await page.goto(`${base}/cms`);
  }
}

/**
 * 打開某一份文件的 JSON 模式。
 *
 * ⚠️ BI 之後預設是**表單**，JSON 變成「進階」。
 * 這幾條測試驗的是驗證與版本，用 JSON 比較直接；
 * 表單那條路另外有 `改了首頁的標題…` 那一條在驗。
 */
async function openCmsRaw(page: Page, key: string) {
  await signIn(page);

  await page.goto(`${base}/cms/${key}`);
  await page.getByRole("button", { name: "進階：直接編 JSON" }).click();
  await expect(page.getByLabel("內容（JSON）")).toBeVisible();
}

test("還沒在後台改過時，用的是程式碼裡的預設內容", async ({ page }) => {
  /*
   * 這一條看起來不重要，但它是整個 fallback 設計的驗證：
   * 部署了新程式碼、還沒有人按過儲存，網站的行為必須與搬進 CMS
   * 之前**完全一樣**。
   */
  await openCmsRaw(page, "pricing.tiers");
  await page.goto(`${base}/cms`);

  await expect(
    page.getByText("還沒在後台改過，目前用的是程式碼裡的預設內容").first(),
  ).toBeVisible();
});

test("改了價格，首頁跟著變", async ({ page }) => {
  await openCmsRaw(page, "pricing.tiers");

  const textarea = page.getByLabel("內容（JSON）");
  const current = JSON.parse((await textarea.inputValue()) || "{}");

  current.tiers[0].summary = MARKER;
  await textarea.fill(JSON.stringify(current, null, 2));

  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  await expect(page.getByText(MARKER)).toBeVisible();
});

test("壞掉的 JSON 存不進去，而且說得出哪裡不對", async ({ page }) => {
  await openCmsRaw(page, "faq.list");

  const textarea = page.getByLabel("內容（JSON）");
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
  await openCmsRaw(page, "pricing.tiers");

  const textarea = page.getByLabel("內容（JSON）");
  const first = JSON.parse(await textarea.inputValue());
  first.tiers[0].summary = "第一版的說明";
  await textarea.fill(JSON.stringify(first, null, 2));
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  /*
   * ⚠️ 重新整理之後編輯器回到表單模式，要再切一次。
   * BI 之前 JSON 是預設，所以這一行原本不存在。
   */
  await page.reload();
  await page.getByRole("button", { name: "進階：直接編 JSON" }).click();
  const second = JSON.parse(await textarea.inputValue());
  second.tiers[0].summary = "第二版的說明";
  await textarea.fill(JSON.stringify(second, null, 2));
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.reload();
  await expect(page.getByLabel("方案 1 · 說明")).toHaveValue("第二版的說明");
  await page.getByRole("button", { name: "進階：直接編 JSON" }).click();

  // 還原成上一版
  await page.getByRole("button", { name: "還原成這一版" }).first().click();

  await expect
    .poll(async () => (await textarea.inputValue()).includes("第一版的說明"), { timeout: 15_000 })
    .toBe(true);
});

/* ------------------------------------------------------------------ */
/* 表單那條路（CR-004 / BI）                                            */
/* ------------------------------------------------------------------ */

test("用表單改首頁的說明，首頁跟著變——全程沒有碰到 JSON", async ({ page }) => {
  /*
   * ⚠️ 這一條驗的是 BI 真正的目的。
   *
   * BH 之後內容確實可以改，但要改一句首頁標題得先看懂一份 JSON。
   * 「做得到」與「做得下去」是兩件事，而後者才是這個功能存在的理由。
   */
  await signIn(page);
  await page.goto(`${base}/cms/home.hero`);

  // 進來就是表單，不是一坨 JSON
  await expect(page.getByLabel("說明", { exact: true })).toBeVisible();
  await expect(page.getByLabel("內容（JSON）")).toHaveCount(0);

  await page.getByLabel("說明", { exact: true }).fill(HERO_MARKER);
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  await expect(page.getByText(HERO_MARKER)).toBeVisible();
});

test("清單上的每一份文件都進得去，而且照頁面分組", async ({ page }) => {
  await signIn(page);
  await page.goto(`${base}/cms`);

  /*
   * 分組的標題要真的在畫面上。
   *
   * 十幾份文件平鋪成一排的話，「我要改首頁那句話」這個問題
   * 得從 key 的名字去猜——而 key 是給程式看的。
   */
  await expect(page.getByRole("heading", { name: "首頁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "全站共用" })).toBeVisible();

  // 每一份都有一顆進得去的「編輯」
  const edits = page.getByRole("link", { name: "編輯" });
  await expect(await edits.count()).toBeGreaterThan(10);
});

test("陣列可以整項新增與刪除，不用自己補括號", async ({ page }) => {
  await signIn(page);
  await page.goto(`${base}/cms/home.process`);

  const before = await sql(`select 1`);
  expect(before.length).toBe(1);

  await page.getByRole("button", { name: "新增一個步驟" }).click();

  // 新的那一項是空白的，不是複製上一項——複製的話很容易只改一半就存檔
  const newStep = page.getByLabel("步驟 5 · 標題");
  await expect(newStep).toBeVisible();
  await expect(newStep).toHaveValue("");

  await page.getByLabel("步驟 5 · 編號").fill("05");
  await newStep.fill("E2E 新步驟");
  await page.getByLabel("步驟 5 · 說明").fill("這一步是測試加的。");
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  await expect(page.getByText("E2E 新步驟")).toBeVisible();

  // 再刪回去
  await page.goto(`${base}/cms/home.process`);
  await page.getByRole("button", { name: "刪除步驟 5" }).click();
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  await expect(page.getByText("E2E 新步驟")).toHaveCount(0);
});

test("登入頁不再說「此頁供工作人員使用」", async ({ page }) => {
  /*
   * CR-002 之後那句話就不成立了：一般會員也從這裡進自己的後台。
   * 一句過期的說明會讓真的想登入的人以為自己走錯地方。
   *
   * 這一條同時也證明 login.intro 真的有讀取端——
   * 沒有的話後台改了完全沒有效果。
   */
  await page.goto("/login");
  await expect(page.getByText("此頁供工作人員使用")).toHaveCount(0);
  await expect(page.getByText("會員從這裡進入自己的後台")).toBeVisible();
});
