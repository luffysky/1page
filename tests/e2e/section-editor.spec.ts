import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * 區塊編輯器（CR-003-4 第一段）
 *
 * ── 這裡最重要的一條是「完全不用滑鼠」 ────────────────────────
 *
 * WCAG 2.1 §2.5.7：任何用拖曳完成的操作都要有不需拖曳的替代方式。
 * 這一段刻意先做鍵盤、後做拖曳，就是為了讓那條在第一版就成立——
 * 補做等於整個介面重寫。
 *
 * 所以這份測試裡搬動區塊的那一條**只用 Tab 與 Enter**。
 * 拖曳之後疊上來時，這條必須仍然是綠的。
 */

const order = async (page: import("@playwright/test").Page) =>
  page
    .locator("[data-section-widget]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-section-widget")));

test.describe("區塊編輯器", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/edit");
  });

  test("完全用鍵盤就能把區塊往上搬", async ({ page }) => {
    const before = await order(page);

    // Tab 進第二塊區塊，按 Enter 之前先確認焦點真的在那裡
    const second = page.locator("[data-section-widget]").nth(1).getByRole("group").first();
    await second.focus();

    const movedId = before[1];
    await expect(second).toBeFocused();

    /*
     * ⚠️ 用 Tab 走過去，不是 `.focus()`。
     *
     * 第一版這裡是 `await up.focus()`——那是程式直接指定焦點，
     * 連 `tabIndex={-1}`（完全不在 Tab 順序上）的元素都能成功。
     * 我把按鈕改成 tabIndex={-1} 驗證，測試照樣綠——
     * 也就是它從來沒有在驗「鍵盤到得了」，只在驗「按了會動」。
     *
     * 真正要證明的是**鍵盤使用者走得到那顆按鈕**，所以只能按 Tab。
     */
    const up = page.getByRole("button", { name: /往上移/ });

    let reached = false;
    for (let step = 0; step < 6 && !reached; step += 1) {
      await page.keyboard.press("Tab");
      reached = await up.evaluate((el) => el === document.activeElement).catch(() => false);
    }

    expect(reached, "Tab 走不到「往上移」——鍵盤使用者搬不動區塊").toBe(true);
    await page.keyboard.press("Enter");

    const after = await order(page);
    expect(after[0], "鍵盤搬不動區塊——WCAG 2.5.7 的替代方式沒生效").toBe(movedId);
    expect(after).toHaveLength(before.length);
  });

  test("第一塊不能再往上，最後一塊不能再往下", async ({ page }) => {
    /*
     * 邊界不繞回另一端。一直按「下移」把區塊從最底下跳到最上面，
     * 看起來像壞掉——使用者會以為自己按錯了。
     */
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await expect(page.getByRole("button", { name: /往上移/ })).toBeDisabled();

    await page.locator("[data-section-widget]").last().getByRole("group").first().click();
    await expect(page.getByRole("button", { name: /往下移/ })).toBeDisabled();
  });

  test("沒選取的區塊不會留下按不到卻在 Tab 順序上的按鈕", async ({ page }) => {
    /*
     * 工具列只在選取時進 DOM，不是用 CSS 藏起來。
     * 藏起來的話，鍵盤使用者會在每一塊都撞到三顆看不見的按鈕——
     * 那正是表單區塊那次踩過的坑。
     */
    expect(await page.getByRole("button", { name: /往上移|往下移|移除/ }).count()).toBe(0);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    expect(await page.getByRole("button", { name: /往上移|往下移|移除/ }).count()).toBe(3);
  });

  test("排好的順序跳到別頁再回來還在", async ({ page }) => {
    // Spec §8.15：訪客累積的設定不會在跳轉時消失。
    // 區塊順序是使用者的輸入，算不出來，所以必須被存下來。
    await page.locator("[data-section-widget]").nth(1).getByRole("group").first().click();
    await page.getByRole("button", { name: /往上移/ }).click();

    const edited = await order(page);

    await page.goto("/work");
    await page.goto("/edit");

    /*
     * ⚠️ 用 poll，不是讀一次就斷言。
     *
     * 還原是在掛載後的 effect 裡做的（見 preview-context：放進 useReducer
     * 的初始值會造成 hydration mismatch，因為 server 沒有 sessionStorage）。
     * 所以回訪時會有短暫一瞬間顯示 server 那一版的預設順序。
     *
     * 第一版這裡是讀一次就比，結果它抓到的正是那一瞬間——測試紅了，
     * 但功能其實是好的。這不是把測試改鬆：順序最後**必須**是使用者排的那個，
     * 只是它比第一幀晚到。
     */
    await expect
      .poll(async () => (await order(page)).join(","), {
        message: "排了半天，點一下別頁就全沒了",
      })
      .toBe(edited.join(","));
  });

  test("回到模板原樣", async ({ page }) => {
    const original = await order(page);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await page.getByRole("button", { name: /移除/ }).click();
    expect(await order(page)).not.toEqual(original);

    await page.getByRole("button", { name: "回到模板原樣" }).click();
    expect(await order(page)).toEqual(original);
  });

  test("換模板會換掉整組區塊，不會沿用舊的", async ({ page }) => {
    // 保留舊模板的區塊等於換了版型卻沒換內容，那不是換模板
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await page.getByRole("button", { name: /移除/ }).click();

    await page.getByRole("button", { name: /^Local Business/ }).click();

    const after = await order(page);
    expect(after[0]).toBe("hero");
    expect(after).toContain("faq");
  });

  test("axe 沒有 critical/serious，選取後也一樣", async ({ page }) => {
    const scan = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      return results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => `${v.id}: ${v.help}`);
    };

    expect(await scan()).toEqual([]);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    expect(await scan(), "選取狀態下的工具列有 a11y 問題").toEqual([]);
  });
});
