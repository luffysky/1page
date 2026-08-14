import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 首頁版面編輯器（CR-004 / Phase B BJ-2）
 *
 * ── 這一組驗的是「後台排的順序，首頁真的照著排」 ──────────────
 *
 * 版面最容易的假成功是：後台拖得動、看起來有存、而首頁完全沒變。
 * 沒有任何地方會報錯——那正是這個專案犯過七次的那件事的變形。
 *
 * 所以每一條都走完整條：後台改 → 存 → **打開首頁看 DOM 的順序**。
 */

const ADMIN_EMAIL = "e2e-layout@1page.test";
const ADMIN_PASSWORD = "E2e!Layout#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();
const base = `/${segment}/admin`;

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
  await sql(`delete from cms_documents where key = 'home.layout'`);
  if (adminId) await deleteMember(adminId);
});

async function openLayout(page: Page) {
  await page.goto(`${base}/cms/home.layout`);

  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(new RegExp(base), { timeout: 20_000 });
    await page.goto(`${base}/cms/home.layout`);
  }

  await expect(page.getByRole("group", { name: /首屏/ })).toBeVisible();
}

/** 後台列表上的順序 */
const editorOrder = (page: Page) =>
  page
    .getByRole("group")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")?.split("（")[0] ?? ""));

/** 首頁上那幾個錨點的實際順序。這是「真的變了嗎」的唯一證據 */
const homeAnchors = (page: Page) =>
  page
    .locator("main [id]")
    .evaluateAll((els) => els.map((el) => el.id).filter((id) => id.length > 0));

test("用鍵盤把價格搬到服務前面，首頁真的照著換了順序", async ({ page }) => {
  await openLayout(page);

  const before = await editorOrder(page);
  expect(before, "編輯器上讀不到任何區塊，後面的驗證就沒有意義").not.toEqual([]);

  /*
   * ⚠️ 用真的按鈕，不是拖曳。
   *
   * WCAG 2.1 §2.5.7 要求拖曳一定要有替代方式，而這一條就是那個替代
   * 方式本身的測試。它必須在拖曳存在的情況下仍然是綠的。
   */
  await page.getByRole("button", { name: "把「價格」往上移" }).click();

  const after = await editorOrder(page);
  expect(after, "按了往上移但順序沒變").not.toEqual(before);

  await page.getByRole("button", { name: "儲存版面" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  const anchors = await homeAnchors(page);

  expect(
    anchors.indexOf("pricing"),
    "後台排好了，首頁卻沒有跟著換——版面資料沒有任何讀取端",
  ).toBeLessThan(anchors.indexOf("services"));
});

test("拖曳與鍵盤得到一樣的結果", async ({ page }) => {
  await openLayout(page);

  /*
   * ⚠️ 明確派送 dragstart/dragover/drop，不用 Playwright 的 dragTo。
   *
   * dragTo 走的是滑鼠座標。這一頁有十列，來源與目標常常一個在畫面上、
   * 一個捲出去了，放開時游標底下是別的東西——測試會紅，
   * 而紅的原因與我們的 DnD 邏輯無關。
   *
   * 這裡驗的是**我們自己接的那幾個事件**，所以直接派送它們。
   */
  const before = await editorOrder(page);

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("li[draggable='true']"));
    const source = rows.at(-1)!;
    const target = rows[1]!;

    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { dataTransfer: transfer, bubbles: true }));
    target.dispatchEvent(new DragEvent("dragover", { dataTransfer: transfer, bubbles: true }));
    target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
  });

  const after = await editorOrder(page);
  expect(after, "拖了最後一列到第二個位置，順序沒有變").not.toEqual(before);
  expect(after[1], "被拖的那一列沒有落在目標位置").toBe(before.at(-1));
});

test("關掉一塊，首頁上就不見了", async ({ page }) => {
  await openLayout(page);

  const row = page.locator("li", { hasText: "合作流程" }).first();
  await row.getByRole("checkbox").uncheck();

  await page.getByRole("button", { name: "儲存版面" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  expect(await homeAnchors(page), "關掉的區塊還在首頁上").not.toContain("process");

  // 再打開，確認關掉不是單向的——不然使用者關了就回不去
  await openLayout(page);
  await page.locator("li", { hasText: "合作流程" }).first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "儲存版面" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  expect(await homeAnchors(page)).toContain("process");
});

test("首屏與最後那一段關不掉，而且畫面說得出為什麼", async ({ page }) => {
  await openLayout(page);

  /*
   * 只把開關變灰是不夠的：看到的人會以為壞了然後一直按。
   * 這兩塊是這一頁存在的理由——一個負責讓人留下來，
   * 一個負責讓人採取下一步。
   */
  const hero = page.locator("li", { hasText: "首屏" }).first();
  await expect(hero.getByRole("checkbox")).toHaveCount(0);
  await expect(hero.getByText("這一塊不能關")).toBeVisible();
});

test("換了背景，首頁那一塊真的有底色", async ({ page }) => {
  await openLayout(page);

  await page.getByRole("button", { name: "設定「合作流程」的背景" }).click();
  await page.getByLabel("背景來源").selectOption("color");
  await page.getByLabel("顏色", { exact: true }).fill("#123456");

  await page.getByRole("button", { name: "儲存版面" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");

  /*
   * 問瀏覽器**算出來的值**，不是比對 style 屬性的字串。
   *
   * ⚠️ 兩者在這裡真的不一樣：伺服器端渲染的 inline style 原樣是
   * `background-color:#123456`，而在 /edit 裡由 client 設定的同一個值
   * 會被瀏覽器正規化成 `rgb(18, 52, 86)`。比字串的話這條會依
   * 「這一頁是誰渲染的」而時綠時紅。
   *
   * 更重要的是：屬性上有 style 只證明我們寫了一個字串進去。
   * 這個專案踩過的正是那種——設定注入了、沒有任何 CSS 讀它。
   */
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll("*")).some(
            (el) => getComputedStyle(el).backgroundColor === "rgb(18, 52, 86)",
          ),
        ),
      { timeout: 10_000, message: "首頁上沒有任何一塊真的被塗成那個顏色" },
    )
    .toBe(true);
});

/*
 * ⚠️ 收尾一定要走**後台存檔**這條路，不能只在 afterAll 用 SQL 刪掉。
 *
 * 讀取端有快取，而快取是由 tag 失效的——tag 只在 action 存檔時被打掉。
 * 直接下 SQL 刪掉那一列，快取裡仍然留著剛才排過的版面（最長一小時），
 * 於是**後面每一支測首頁的檔案都會看到一個被排過的首頁**。
 *
 * 這不是測試的怪癖，是這個設計真實的一面：繞過應用層改資料庫，
 * 前台不會立刻跟著變。寫在這裡是為了讓下一個人看到就知道。
 */
test("收尾：把版面排回預設並存檔", async ({ page }) => {
  await openLayout(page);

  /*
   * 一顆「回到預設版面」比逐一搬回去可靠得多。
   *
   * 逐一搬回去的話，收尾本身要記得前面每一條改了什麼——
   * 而漏掉的那一項會變成下一支測試莫名其妙的紅燈。
   */
  await page.getByRole("button", { name: "回到預設版面" }).click();
  await page.getByRole("button", { name: "儲存版面" }).click();
  await expect(page.getByRole("status")).toContainText("存好了");

  await page.goto("/");
  const anchors = await homeAnchors(page);

  expect(anchors.indexOf("services"), "沒有排回去，後面的測試會看到一個被排過的首頁").toBeLessThan(
    anchors.indexOf("pricing"),
  );
  expect(anchors).toContain("process");
});
