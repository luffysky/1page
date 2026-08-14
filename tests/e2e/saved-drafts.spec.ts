import { expect, test, type Page } from "@playwright/test";

/**
 * 存下來的草稿要載得回來（CR-003-4）
 *
 * ── 為什麼這一組非有不可 ──────────────────────────────────────
 *
 * 「存到我的帳號」做完的當下，每一條測試都是綠的：存檔會成功、
 * 會員中心列得出來、RLS 擋得掉別人的。唯獨沒有人驗過**打得開**。
 *
 * 而它打不開——第一版存的是 `buildSiteConfig()` 算出來的成品，
 * 成品裡沒有「當初選的是哪一套模板」。那是一個只寫不讀的功能，
 * 每一項單獨看都對。
 *
 * 所以這裡驗的是整條來回：排版 → 存 → 離開 → 從會員中心點回來 →
 * **看到的是剛才排的那個順序**。中間任何一段掉了，最後一步就會紅。
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/*
 * 拋棄式的**一般會員**帳號，不進 admin_users。
 *
 * 刻意不共用 authed-breakpoints 那個後台帳號：這條路徑要證明的正是
 * 「一般人自己的後台」能用，拿員工帳號測就把兩個後台混在一起了。
 */
const E2E_EMAIL = "e2e-member@1page.test";
const E2E_PASSWORD = "E2e!Member#2026";

async function gotrue(path: string, init?: RequestInit) {
  return fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
  });
}

async function sql(query: string) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

let e2eUserId: string | undefined;

test.beforeAll(async () => {
  // 不靜默跳過：2E 有過教訓，兩條安全測試因為沒載入 .env.local 而
  // 安靜地跳過，報告全綠了好一陣子。
  if (!supabaseUrl || !serviceKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const existing = await sql(`select id from auth.users where email = '${E2E_EMAIL}'`);
  for (const row of existing) await gotrue(`/users/${row.id}`, { method: "DELETE" });

  const created = await gotrue("/users", {
    method: "POST",
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD, email_confirm: true }),
  });
  const body = (await created.json()) as { id?: string };
  if (!body.id) throw new Error(`建立測試會員帳號失敗：${JSON.stringify(body)}`);
  e2eUserId = body.id;
});

test.afterAll(async () => {
  // profiles 與 saved_sites 都是 on delete cascade，刪帳號就一起走
  if (e2eUserId) await gotrue(`/users/${e2eUserId}`, { method: "DELETE" });
});

test.beforeEach(async () => {
  // 每條測試都從「一份都沒有」開始，否則第二條會看到第一條留下的東西
  if (e2eUserId) await sql(`delete from public.saved_sites where owner_id = '${e2eUserId}'`);
});

async function signIn(page: Page) {
  await page.goto("/login?next=%2Fedit");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("密碼").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(/\/edit/, { timeout: 20_000 });
}

const order = (page: Page) =>
  page
    .locator("[data-section-widget]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-section-widget")));

/** 把第二塊搬到最前面，回傳搬完之後的順序 */
async function rearrange(page: Page) {
  const before = await order(page);

  await page.locator("[data-section-widget]").nth(1).getByRole("group").first().click();
  await page.getByRole("button", { name: /往上移/ }).click();

  const after = await order(page);
  expect(after, "沒搬動任何東西，後面的驗證就沒有意義").not.toEqual(before);
  return after;
}

test.describe("存下來的草稿", () => {
  test("排好、存起來、從會員中心點回來，看到的還是那個順序", async ({ page }) => {
    await signIn(page);

    const arranged = await rearrange(page);

    await page.getByLabel("幫這份網站取個名字").fill("回來看看");
    await page.getByRole("button", { name: "存到我的帳號" }).click();
    await expect(page.getByRole("status")).toContainText("存好了");

    /*
     * 刻意繞去會員中心再點回來，而不是直接 goto /edit?draft=…。
     *
     * 直接打網址只證明那條路由能用；使用者實際會走的是
     * 「會員中心 → 編輯」。少了那顆按鈕，功能一樣是進不去的
     * ——那正是這個專案反覆踩到的同一種毛病。
     */
    await page.goto("/account");
    await expect(page.getByText("回來看看")).toBeVisible();
    await page.getByRole("link", { name: "編輯" }).click();

    await page.waitForURL(/\/edit\?draft=/);
    await expect(page.getByRole("status").first()).toContainText("回來看看");

    expect(await order(page), "載回來的順序跟存進去的不一樣").toEqual(arranged);
  });

  test("再按一次存檔是更新，不是又多一份", async ({ page }) => {
    await signIn(page);
    await rearrange(page);

    await page.getByLabel("幫這份網站取個名字").fill("同一份");
    await page.getByRole("button", { name: "存到我的帳號" }).click();
    await expect(page.getByRole("status")).toContainText("存好了");

    // 存完之後按鈕本身要改口，否則使用者不知道下一次按會蓋掉哪一份
    const update = page.getByRole("button", { name: "更新這一份" });
    await expect(update).toBeVisible();
    await update.click();
    await expect(page.getByRole("status")).toContainText("更新好了");

    await page.goto("/account");
    expect(
      await page.getByRole("link", { name: "編輯" }).count(),
      "按兩次存檔就多出一份，二十份的上限會被自己的修改記錄塞滿",
    ).toBe(1);
  });

  test("另存新的一份才會多一份", async ({ page }) => {
    await signIn(page);

    await page.getByLabel("幫這份網站取個名字").fill("第一份");
    await page.getByRole("button", { name: "存到我的帳號" }).click();
    await expect(page.getByRole("status")).toContainText("存好了");

    /*
     * 三種存檔結果的訊息刻意都不一樣。
     *
     * 第一版三種都寫「存好了」，於是這條測試在第二次按下之前就通過了
     * ——它看到的是**上一次**留在畫面上的那句話。訊息一樣的東西
     * 在測試裡分不出來，在使用者眼裡也分不出來。
     */
    await page.getByLabel("幫這份網站取個名字").fill("第二份");
    await page.getByRole("button", { name: "另存新的一份" }).click();
    await expect(page.getByRole("status")).toContainText("另存了一份新的");

    await page.goto("/account");
    expect(await page.getByRole("link", { name: "編輯" }).count()).toBe(2);
    await expect(page.getByText("第一份")).toBeVisible();
    await expect(page.getByText("第二份")).toBeVisible();
  });

  test("別人的草稿載不到，而且不會安靜地變成一份空白", async ({ page }) => {
    await signIn(page);

    /*
     * 一個合法但不屬於這個帳號的 id。
     *
     * 沒有「載不到」的提示時，使用者看到的是一份預設版型，
     * 他會以為自己存的東西被清掉了——而接著排的東西一存檔
     * 還會真的多出一份無關的草稿。
     */
    await page.goto("/edit?draft=00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("status").first()).toContainText("找不到這份草稿");
  });

  test("沒登入就點草稿網址會被送去登入，不是說東西不見了", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/edit?draft=00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/login\?next=/);

    await context.close();
  });
});
