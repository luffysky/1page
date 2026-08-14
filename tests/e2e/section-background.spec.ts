import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * 每一塊的背景（CR-004 / Phase B BJ）
 *
 * ── 這一組驗的是「看得到不等於讀得到」 ────────────────────────
 *
 * 背景壞掉的方式很少是白畫面。多半是照片很漂亮、文字壓在上面
 * 「有點」看不清楚——而那個「有點」在自己的螢幕上通常還讀得出來，
 * 因為看的人已經知道那行字寫什麼。
 *
 * 所以這裡除了「設定得起來」之外，還要驗：
 *   - 選了媒體背景時**預設就有遮罩**，不是從 0 開始
 *   - 背景整層都在無障礙樹之外（它是裝飾，不是內容）
 *   - 訪客開了「減少動態效果」時，影片不會播——而且是**不放 video 元素**
 */

async function selectFirstSection(page: Page) {
  await page.goto("/edit");
  await page.locator("[data-section-widget]").first().getByRole("group").first().click();
  await expect(page.getByRole("combobox", { name: "背景來源" })).toBeVisible();
}

test("換成純色，那一塊真的變色", async ({ page }) => {
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("color");
  await page.getByLabel("顏色", { exact: true }).fill("#123456");

  /*
   * 從瀏覽器**算出來的值**去驗，不是從 DOM 屬性。
   *
   * 屬性上有 style 只證明我們寫了一個字串進去；
   * 這個專案踩過的正是那種——設定注入了、沒有任何 CSS 讀它。
   */
  const painted = page.locator('[style*="rgb(18, 52, 86)"]').first();
  await expect(painted).toBeVisible({ timeout: 10_000 });
});

test("漸層只填一端時不會假裝成功", async ({ page }) => {
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("gradient");
  await page.getByLabel("起點顏色", { exact: true }).fill("#ffffff");

  /*
   * 只有一端的漸層在 CSS 上是無效的。
   *
   * 這裡要的不是「有沒有畫錯」，是**編輯器有沒有說出來**——
   * 沒說的話使用者會以為自己選好了，然後去找別的地方為什麼沒變。
   */
  await expect(page.getByText("漸層要兩個顏色才成立")).toBeVisible();

  await page.getByLabel("終點顏色", { exact: true }).fill("#000000");
  await expect(page.getByText("漸層要兩個顏色才成立")).toHaveCount(0);
});

test("選了圖片背景，遮罩不是從 0 開始", async ({ page }) => {
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("image");

  /*
   * ⚠️ 這一條是整組裡最重要的。
   *
   * 從 0 開始的話，第一眼看到的是「照片很漂亮、字有點看不清楚」，
   * 而真正讀不出來的是別人，在別的螢幕上。
   * 預設壓一層，要拿掉是一個明確的動作。
   */
  const overlay = page.getByLabel("遮罩濃度");
  await expect(overlay).toHaveValue("40");
});

test("影片背景會提醒要放封面圖", async ({ page }) => {
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("video");

  /*
   * 找的是那句**提醒**，不是欄位標籤。
   *
   * 只寫 /封面圖/ 會同時抓到欄位的 <label>，而那個欄位不管有沒有填
   * 都在畫面上——也就是這一條無論如何都會綠，驗不到任何東西。
   */
  await expect(page.getByText("建議也選一張封面圖")).toBeVisible();
});

test("減少動態效果時，影片元素根本不會出現", async ({ page }) => {
  /*
   * ⚠️ 這一條要驗的是「**不放** video 元素」，不是「video 被藏起來」。
   *
   * 純 CSS 只能藏：影片仍然會被下載、仍然會播放（只是看不到），
   * 耗流量、耗電，而且哪天有人拿掉那條 CSS，行為就悄悄變回去。
   *
   * 所以先在一般狀態下確認**有**播放器，再切成減少動態確認**沒有**——
   * 只驗其中一半的話，一個永遠不放 video 的壞掉版本也會綠。
   */
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("video");
  await page
    .getByLabel("影片", { exact: true })
    .fill("https://1page-r2.snowrealm.pet/e2e/background.mp4");

  const preview = page.locator("[data-site-scope]");
  await expect(preview.locator("video")).toHaveCount(1, { timeout: 10_000 });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(preview.locator("video"), "要求減少動態時仍然放了 video 元素").toHaveCount(0);
});

test("背景整層在無障礙樹之外——它是裝飾，不是內容", async ({ page }) => {
  await selectFirstSection(page);

  await page.getByLabel("背景來源").selectOption("color");
  await page.getByLabel("顏色", { exact: true }).fill("#123456");

  const painted = page.locator('[style*="rgb(18, 52, 86)"]').first();
  await expect(painted).toBeVisible({ timeout: 10_000 });

  /*
   * ⚠️ 第一版這裡只跑 axe，然後就宣稱「不會被讀螢幕的人讀到」。
   *
   * 我把 `aria-hidden` 整個拿掉驗證——**axe 照樣全綠**。
   * 也就是那條測試從來沒有在驗它名字說的那件事。
   * （這正是 CLAUDE.md 第二條：守衛通過不等於守衛有效。）
   *
   * 現在直接問結構：那一層有沒有 aria-hidden。
   * 一段讀螢幕的人聽到「圖片：hero-bg-3.jpg」不會得到任何資訊，
   * 只會被打斷——而 axe 看不出這件事，因為那在技術上完全合法。
   */
  const layer = painted.locator("xpath=ancestor-or-self::div[@aria-hidden='true']");
  await expect(layer, "背景層沒有 aria-hidden，會被讀螢幕的人聽到").toHaveCount(1);

  // axe 仍然跑一次：它抓得到對比度與其他這裡沒有明講的問題
  const results = await new AxeBuilder({ page }).include("[data-site-scope]").analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
