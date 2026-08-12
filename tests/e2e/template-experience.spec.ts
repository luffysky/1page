import { expect, test } from "@playwright/test";

/**
 * Template Experience（Spec §8.15）
 *
 * 4B 出口條件：「1C 立下的『禁止假互動』測試改為驗證真的會動；
 * 所有切換皆為 SiteConfig mutation，零 DOM style 操作。」
 *
 * 單元測試已經驗過「按了會換內容」。這裡驗的是單元測試看不到的那一半：
 * 瀏覽器實際算出來的樣式真的變了。
 * jsdom 不做樣式計算，`--site-color-background` 換了值它也不知道畫面有沒有跟著換。
 */

const previewScope = "#templates [data-site-scope]";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("預設就有一套模板被選中，不是空狀態", async ({ page }) => {
  const pressed = page.locator("#templates button[aria-pressed='true']");
  await expect(pressed).toHaveCount(1);

  // 預覽區有實際內容，不是佔位
  await expect(page.locator(`${previewScope} h1`).first()).toBeVisible();
});

test("換一套模板，瀏覽器算出來的背景色真的變了", async ({ page }) => {
  const scope = page.locator(previewScope).first();

  const background = () => scope.evaluate((element) => getComputedStyle(element).backgroundColor);
  const heading = () => page.locator(`${previewScope} h1`).first().textContent();

  const beforeBackground = await background();
  const beforeHeading = await heading();

  // Local Business 用 warm 主題（米白底），預設的 Studio 是 minimal（純白底）
  await page.getByRole("button", { name: /^Local Business/ }).click();

  await expect
    .poll(background, { message: "換了模板但計算後的背景色沒變" })
    .not.toBe(beforeBackground);
  expect(await heading()).not.toBe(beforeHeading);
});

test("切換是 SiteConfig 的結果，不是有人去改 DOM 樣式", async ({ page }) => {
  await page.getByRole("button", { name: /^Personal/ }).click();

  // scope 容器上只能有 --site-* 宣告。
  // 若有人用 element.style.background = ... 偽造切換（Spec §45.1 的 V3 做法），
  // 這裡就會出現一條非 --site-* 的宣告。
  const declarations = await page
    .locator(previewScope)
    .first()
    .evaluate((element) =>
      (element.getAttribute("style") ?? "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean),
    );

  expect(declarations.length).toBeGreaterThan(0);
  for (const declaration of declarations) {
    expect(declaration.startsWith("--site-"), `非預期的宣告：${declaration}`).toBe(true);
  }

  // 預覽以外的地方不得出現 --site-*（Plan §3 的隔離）
  const leaked = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--site-color-background").trim(),
  );
  expect(leaked).toBe("");
});

test("預覽區可用鍵盤捲動", async ({ page }) => {
  // 模板比視窗高，預覽因此內部捲動。只有滑鼠能捲的話，
  // 鍵盤使用者永遠看不到下半部。
  const region = page.locator("#templates [role='group']").first();

  await expect(region).toHaveAttribute("tabindex", "0");
  await expect(region).toHaveAttribute("aria-label", /模板預覽/);
});
