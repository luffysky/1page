import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 前台的 CRM 設計器（CR-003-5 / Spec §47）
 *
 * ── 這一組驗的是「設計出來的東西真的用得到」 ─────────────────
 *
 * 一個設計器最糟的失敗不是壞掉，是**設計得出來、存不下來，
 * 或存下來之後打不開**——那正是 saved_sites 犯過一次的錯
 * （存的是成品，而成品裡沒有「當初選的是哪一套模板」，
 * 於是存得進去、永遠載不回編輯器，0814 才補上）。
 *
 * 所以這裡走的是完整一圈：設計 → 存 → 打開 → 填一筆 → 看得到。
 */

const EMAIL = "e2e-crm@1page.test";
const PASSWORD = "E2e!Crm#2026";

let memberId: string | undefined;

test.beforeAll(async () => {
  memberId = await createMember(EMAIL, PASSWORD);
});

test.afterAll(async () => {
  // 設計刪掉時記錄跟著走（on delete cascade），所以只要刪定義
  await sql(`delete from crm_definitions where owner_id = '${memberId}'`).catch(() => {});
  if (memberId) await deleteMember(memberId);
});

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("密碼").fill(PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(new RegExp(next.split("?")[0]!), { timeout: 20_000 });
}

/**
 * 建一份自己的設計，回傳它的 id。
 *
 * ⚠️ 每條測試建自己的，不靠前一條留下的東西。
 *
 * 原本後面幾條都去撈「這個帳號的第一份設計」——那讓它們在單獨執行
 * （`-g`）時全部紅，而紅的原因與它們要驗的事無關。
 * 測試之間的順序依賴是最難查的一種紅燈。
 */
async function createDesign(page: Page, name: string): Promise<string> {
  await signIn(page, "/crm");
  await page.getByLabel("這份 CRM 叫什麼").fill(name);

  // 已經存過一份的話按鈕會變成「更新這一份」，這時要的是「另存新的一份」
  const saveAsNew = page.getByRole("button", { name: "另存新的一份" });
  await (
    (await saveAsNew.count()) > 0 ? saveAsNew : page.getByRole("button", { name: "存到我的帳號" })
  ).click();

  await expect(page.getByRole("status")).toContainText(/存好了|另存/, { timeout: 20_000 });

  const rows = await sql(
    `select id from crm_definitions where owner_id = '${memberId}' and name = '${name}'`,
  );
  const id = rows[0]?.id as string | undefined;
  expect(id, `建立「${name}」失敗`).toBeTruthy();
  return id!;
}

test("首頁走得到設計器——不用把網址打進去", async ({ page }) => {
  /*
   * 這個專案已經七次做完功能卻沒有入口（登入頁、路由、分析事件……）。
   * `audit:wiring【8】`爬的是同源連結，這一條是它在瀏覽器裡的版本：
   * 導覽收起來的時候連結還在不在 DOM 裡，它抓不到。
   */
  await page.goto("/");
  await page.getByRole("link", { name: "設計 CRM" }).first().click();
  await expect(page.getByRole("heading", { name: "設計你自己的 CRM" })).toBeVisible();
});

test("不登入也設計得出東西，而且說得出存檔要登入", async ({ page }) => {
  await page.goto("/crm");

  // 定價 B：免費設計、存檔才要帳號。免費那一半不能有任何門檻
  await expect(page.getByRole("heading", { name: "設計", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "＋ 單行文字" }).click();
  await expect(page.getByRole("button", { name: "新欄位 單行文字" })).toBeVisible();

  await expect(page.getByText("設計不用登入，存下來才要")).toBeVisible();
  await expect(page.getByRole("link", { name: "登入後存檔" })).toBeVisible();
});

test("預覽的欄位聚焦不到——它是照片，不是表單", async ({ page }) => {
  /*
   * ⚠️ 用 disabled 而不是 readOnly。
   *
   * `readOnly` 的輸入框**仍然吃 Tab**：使用者會停在一排打不了字的框上，
   * 再也找不到下一個能操作的東西——而 axe 不報這件事。
   * CR-003-2 的 form 區塊踩過一次，這裡是同一條線。
   */
  await page.goto("/crm");

  const previewInputs = page.locator(
    "section:has(h2:text('長這樣')) input, section:has(h2:text('長這樣')) select, section:has(h2:text('長這樣')) textarea",
  );
  const count = await previewInputs.count();
  expect(count, "預覽區應該要有欄位可驗").toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    await expect(previewInputs.nth(index)).toBeDisabled();
  }
});

test("鍵盤按 ↑ ↓ 與拖曳做的是同一件事", async ({ page }) => {
  /*
   * WCAG 2.1 §2.5.7：拖曳一定要有非拖曳的替代路徑。
   *
   * ⚠️ 這裡用真的 Tab 走到按鈕，不是 `.focus()`。
   * `.focus()` 是程式直接指定焦點，連 `tabIndex={-1}`（完全不在
   * Tab 順序上）的元素都能成功——那條測試從來沒在驗「鍵盤到得了」。
   * 0813 抓到過一次。
   */
  await page.goto("/crm");

  const rows = page.locator("ul > li:has(button[aria-label^='把'])");
  const firstLabel = await rows.first().locator("button[aria-pressed]").innerText();

  const moveDown = rows.first().locator("button[aria-label^='把']").nth(1);

  /*
   * 從第一列的選取按鈕開始，一直 Tab 到「往下移」。
   *
   * ⚠️ 不寫死按幾次。第一列的「往上移」是 disabled（它已經在最上面），
   * 而 disabled 的按鈕**不在 Tab 順序上**——所以次數會隨著
   * 「第幾列」與「有沒有停用」而變。寫死的話這條測試會在
   * 一個與可及性無關的原因上變紅，或者更糟：在錯的按鈕上按 Enter 而變綠。
   *
   * 要驗的是「鍵盤到得了」，不是「剛好是第二下」。
   */
  await rows.first().locator("button[aria-pressed]").focus();

  let reached = false;
  for (let step = 0; step < 6 && !reached; step += 1) {
    await page.keyboard.press("Tab");
    reached = await moveDown.evaluate((element) => element === document.activeElement);
  }
  expect(reached, "用 Tab 走不到「往下移」——鍵盤使用者沒有替代路徑").toBe(true);

  await page.keyboard.press("Enter");

  // 原本第一列的東西現在在第二列
  await expect(rows.nth(1).locator("button[aria-pressed]")).toContainText(
    firstLabel.split("\n")[0]!,
  );
});

test("存下來、打開、填一筆、看得到", async ({ page }) => {
  await signIn(page, "/crm");

  const name = `E2E 測試用的 CRM ${Date.now()}`;
  await page.getByLabel("這份 CRM 叫什麼").fill(name);
  await page.getByRole("button", { name: "存到我的帳號" }).click();

  await expect(page.getByRole("status")).toContainText("存好了", { timeout: 20_000 });

  // 存了就要打得開。這正是 saved_sites 當初漏掉的那一步
  await page.goto("/account/crm");
  await expect(page.getByText(name)).toBeVisible();

  await page.locator("li", { hasText: name }).getByRole("link", { name: "填資料" }).click();

  await page.getByLabel(/名字/).fill("阿明");
  await page.getByRole("button", { name: "儲存" }).click();

  await expect(page.getByRole("status")).toContainText("記下來了", { timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "阿明" })).toBeVisible();

  /*
   * ⚠️ 存完之後表單要還在，確認也要還在。
   *
   * 第一版把 `<details open>` 綁在筆數上（`open={records.length === 0}`），
   * 結果存完第一筆之後筆數從 0 變 1，重繪把表單收起來——
   * 而「記下來了」那句話跟著消失。使用者看到的是表單憑空不見。
   */
  await expect(page.getByLabel(/名字/), "存完之後表單被收起來了，確認訊息也跟著不見").toBeVisible();
});

test("Dashboard 的數字與實際資料對得上", async ({ page }) => {
  /*
   * ── Dashboard 最危險的失敗不是壞掉，是說錯話 ──────────────────
   *
   * 一個看起來很專業的圖表，數字錯了不會有任何提示，
   * 而看的人會拿它做決定。所以這一條驗的全部是**數字**：
   *   - 總筆數與實際填的一致
   *   - 沒有人選過的選項要出現，而且是 0
   *   - 空白不算「有填」
   *
   * 純邏輯在 `features/crm-builder/stats.test.ts`（11 條）。
   * 這一條驗的是那些函式真的被接上了畫面。
   */
  const definitionId = await createDesign(page, "統計測試");
  await page.goto(`/account/crm/${definitionId}`);

  /*
   * 預設那份設計的「狀態」有三個選項。填兩筆、都選同一個，
   * 另外兩個選項必須顯示 0——而不是消失。
   */
  /*
   * ⚠️ 要填到門檻（3 筆）以上，圖表才會畫出來。
   *
   * ⚠️ 而且等待條件是「那一筆出現在表格裡」，不是 `getByRole("status")`——
   * 上一輪的「記下來了」還留在畫面上，用它當條件會立刻通過，
   * 下一次 fill 就撞上重繪到一半的 DOM。那是最典型的 flaky。
   */
  for (const name of ["統計用的甲", "統計用的乙", "統計用的丙"]) {
    await page.getByLabel(/名字/).fill(name);
    await page.getByLabel(/狀態/).selectOption("還在談");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByRole("cell", { name })).toBeVisible({ timeout: 20_000 });
  }

  const dashboard = page.locator("section", { has: page.getByRole("heading", { name: /的概況/ }) });

  const statusCard = dashboard.locator("li", { hasText: "狀態" }).first();
  await expect(statusCard).toContainText("還在談");
  await expect(statusCard, "沒有人選過的選項被藏起來了——那往往正是最有用的資訊").toContainText(
    "已成交",
  );

  /*
   * 「聯絡方式」兩筆都沒填。填寫率要說 0 / 2，
   * 不能把空白當成填了。
   */
  const contactCard = dashboard.locator("li", { hasText: "聯絡方式" }).first();
  await expect(contactCard).toContainText("0 / 3");

  /*
   * ⚠️ 每一張卡只能說它那個型別的話。
   *
   * 「最後聯絡」是日期欄位，而且沒有人填。第一版的條件式
   * （沒有分布、沒有數字、沒有範圍）對它也成立，於是畫面上出現
   * 「最後聯絡（日期）：文字欄位不做分組」——那不是壞掉，是說錯話。
   */
  const dateCard = dashboard.locator("li", { hasText: "最後聯絡" }).first();
  await expect(dateCard, "日期欄位被說成文字欄位").not.toContainText("文字欄位不做分組");
});

test("還沒有資料時不畫一整排 0", async ({ page }) => {
  /*
   * 一個全部都是 0 的 dashboard 看起來像壞掉，而它只是還沒開始。
   * 說出下一步比展示空數字有用。
   */
  await signIn(page, "/crm");

  // 另外存一份全新的，確保它是空的
  await page.getByLabel("這份 CRM 叫什麼").fill("空的統計測試");
  await page
    .getByRole("button", { name: "另存新的一份" })
    .or(page.getByRole("button", { name: "存到我的帳號" }))
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(/存好了|另存/, { timeout: 20_000 });

  await page.goto("/account/crm");
  await page
    .locator("li", { hasText: "空的統計測試" })
    .getByRole("link", { name: "填資料" })
    .click();

  await expect(page.getByText("這一類還沒有任何資料")).toBeVisible();
  // 而清單上也要說「還沒有資料」，不是「0 筆」
  await page.goto("/account/crm");
  await expect(page.locator("li", { hasText: "空的統計測試" })).toContainText("還沒有資料");
});

test("資料太少時不畫圖表，而不是畫一堆 100%", async ({ page }) => {
  /*
   * ⚠️ 一筆資料時每根長條不是滿版就是空的——數學上對，
   * 而使用者的第一個反應是「圖表壞了嗎」，不是「我資料太少」。
   *
   * 這一條的判準是**圖表不在**，不是「有一句話」——
   * 只驗文字的話，圖表照樣畫出來它也會綠。
   */
  const definitionId = await createDesign(page, "門檻測試");
  await page.goto(`/account/crm/${definitionId}`);

  await page.getByLabel(/名字/).fill("只有一筆");
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("status")).toContainText("記下來了", { timeout: 20_000 });

  await expect(page.getByText(/再多記幾筆/)).toBeVisible();
  await expect(
    page.getByRole("list", { name: /每天新增的筆數/ }),
    "資料只有一筆卻還是把圖表畫出來了",
  ).toHaveCount(0);

  // 數字帶仍然要在——那三個數字一筆也成立
  await expect(page.getByText("總共")).toBeVisible();
});

test("統計的排版可以在卡片與橫列之間切換", async ({ page }) => {
  /*
   * 排版存在網址裡（見 crm-dashboard.tsx 的檔頭）。
   * 這一條順便釘住「切排版不會把目前在看的類別弄丟」——
   * 少了 entity，切一次就跳回第一類，而使用者只是想換個看法。
   */
  const definitionId = await createDesign(page, "排版測試");
  await page.goto(`/account/crm/${definitionId}`);

  // 圖表要有門檻以上的資料才會畫，而排版切換就在圖表那一區
  for (const name of ["排版甲", "排版乙", "排版丙"]) {
    await page.getByLabel(/名字/).fill(name);
    await page.getByRole("button", { name: "儲存" }).click();
    // 見上面同一段：不要用 status 當等待條件，上一輪的訊息還在
    await expect(page.getByRole("cell", { name })).toBeVisible({ timeout: 20_000 });
  }

  const chooser = page.getByRole("navigation", { name: "統計的排版" });
  await expect(chooser).toBeVisible();

  // 預設是卡片
  await expect(chooser.getByRole("link", { name: "卡片" })).toHaveAttribute("aria-current", "true");

  await chooser.getByRole("link", { name: "橫列" }).click();
  await expect(page).toHaveURL(/layout=rows/);
  await expect(
    page.getByRole("navigation", { name: "統計的排版" }).getByRole("link", { name: "橫列" }),
  ).toHaveAttribute("aria-current", "true");

  // 兩種排版都要畫得出每一個欄位
  for (const label of ["名字", "狀態"]) {
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
});

test("表格橫向捲動時，外框不動、第一欄釘住", async ({ page }) => {
  /*
   * ── 這一條在守什麼 ────────────────────────────────────────────
   *
   * 兩件只有在真的捲起來才看得出來的事：
   *
   *   1. 捲的是表格，不是整塊——圓角邊框與「已經記下來的」那個抬頭
   *      必須留在原地。捲軸長在更外層的話整頁會晃。
   *   2. 第一欄釘住——捲到第五欄時還要看得出這一列是誰的資料。
   *
   * ⚠️ 判準是**瀏覽器算出來的位置**，不是 class 名稱。
   * 比對 `sticky left-0` 這串字的話，有人把它換成別的寫法就漏掉了；
   * 而更糟的是 sticky 在某些祖先（`overflow: hidden`、`contain`）
   * 底下會靜靜地失效——class 還在，效果沒了。
   */
  const definitionId = await createDesign(page, "捲動測試");
  await page.goto(`/account/crm/${definitionId}`);

  /*
   * 內容要夠長，表格才會真的比容器寬。
   * 短內容在窄視窗下仍然塞得進去——那樣這條測試就什麼都沒驗到。
   */
  await page.getByLabel(/名字/).fill("釘住我");
  await page.getByLabel(/聯絡方式/).fill("this-is-a-deliberately-long-contact-value@example.com");
  await page.getByLabel(/狀態/).selectOption("還在談");
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("cell", { name: "釘住我" })).toBeVisible({ timeout: 20_000 });

  // 窄視窗才會真的產生橫向捲動
  await page.setViewportSize({ width: 390, height: 900 });

  const section = page.locator("section:has(h2:text('已經記下來的'))");

  /*
   * ⚠️ 兩個不同的東西，不要用同一個選擇器。
   *
   * `scroller`  真正在捲的那一層（`overflow-x-auto` 在哪就是哪）
   * `frame`     使用者看到的那個外框（圓角邊框那一層）
   *
   * 第一版兩個都用 `div.overflow-x-auto` 抓——結果把捲軸搬到更外層時，
   * 選擇器跟著搬過去，變成拿自己跟自己比，測試照樣綠。
   * 那是套套邏輯：外框有沒有動，要用**外框**去量。
   */
  const scroller = section.locator("div.overflow-x-auto");
  const frame = section.locator("div.rounded-lg").first();
  await expect(scroller).toBeVisible();
  await expect(frame).toBeVisible();

  const overflows = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflows, "視窗夠窄了，表格卻沒有產生橫向捲動——這一條就驗不到東西").toBe(true);

  const firstCell = page.getByRole("cell", { name: "釘住我" });
  const box = () => firstCell.boundingBox();

  const before = await box();
  const frameBefore = await frame.boundingBox();
  const headingBefore = await section.getByRole("heading", { name: "已經記下來的" }).boundingBox();

  await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  const after = await box();
  const frameAfter = await frame.boundingBox();
  const headingAfter = await section.getByRole("heading", { name: "已經記下來的" }).boundingBox();

  // 1. 外框與抬頭都沒有動
  expect(Math.round(frameAfter!.x), "捲動時整個外框跟著移動了").toBe(Math.round(frameBefore!.x));
  expect(Math.round(headingAfter!.x), "捲動時連抬頭都跟著移動了").toBe(
    Math.round(headingBefore!.x),
  );

  // 2. 第一欄留在原地
  expect(
    Math.abs(after!.x - before!.x),
    "第一欄跟著捲走了——捲到右邊就看不出這一列是誰的",
  ).toBeLessThanOrEqual(1);

  /*
   * 3. 整頁不得因此橫向捲動。
   *
   * ⚠️ 判準是「**推得動嗎**」，不是
   * `documentElement.scrollWidth - clientWidth`。
   *
   * 站上別處的斷點測試都用那個減法，而它們的頁面沒有捲動容器。
   * 這一頁有——實測 `documentElement.scrollWidth` 會被容器裡的內容
   * 灌水（390 的視窗量出 429），而 `window.scrollX` 推到 9999 之後
   * 仍然是 0：整頁根本捲不動。
   *
   * 用那個減法的話，這一條會在一個**沒有發生的問題**上永遠紅著。
   */
  const scrolledX = await page.evaluate(() => {
    window.scrollTo(9999, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return x;
  });
  expect(scrolledX, "表格的捲動外溢到整頁——整頁被推得動了").toBe(0);
});

test("必填沒填就存不進去，而且說得出是哪一欄", async ({ page }) => {
  const definitionId = await createDesign(page, "必填測試");
  await page.goto(`/account/crm/${definitionId}`);

  /*
   * 直接改掉 required 再送出——這模擬的是「有人繞過瀏覽器的必填檢查」。
   * 真正的驗證在 server action，而且用的是**從資料庫讀出來的**定義，
   * 不是表單送上來的那份。
   */
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement>("[required]").forEach((element) => {
      element.required = false;
    });
  });

  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("名字", { timeout: 20_000 });
});

test("設計器與資料頁都沒有 critical/serious 的 a11y 違規", async ({ page }) => {
  await signIn(page, "/crm");

  for (const path of ["/crm", "/account/crm"]) {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(
      serious.map((violation) => violation.id),
      `${path} 有 a11y 違規`,
    ).toEqual([]);
  }
});
