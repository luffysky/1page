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
});

test("必填沒填就存不進去，而且說得出是哪一欄", async ({ page }) => {
  await signIn(page, "/crm");

  const rows = await sql(`select id from crm_definitions where owner_id = '${memberId}' limit 1`);
  const definitionId = rows[0]?.id as string | undefined;
  expect(definitionId, "前一條測試應該已經存過一份").toBeTruthy();

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
