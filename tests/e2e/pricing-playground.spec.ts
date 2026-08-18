import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { PRICING_TIERS } from "@/config/pricing";

/**
 * `/pricing` 與 `/playground`（CR-006）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * CR-006 把首頁上體積最大的兩塊搬出去。搬東西最容易出的錯不是搬壞，
 * 是**搬走之後沒有人到得了新地方**——這個專案已經七次「做完了但畫面上
 * 進不去」，而這次一口氣新增兩條路由。
 *
 * 另一件是 §26.1：六級完整。它的位置變了，要求沒有變。
 */

test.describe("/pricing — §26.1 的新住所", () => {
  test("六級一個都不少，而且順序與資料一致", async ({ page }) => {
    /*
     * ⚠️ 期待值從 `config/pricing` 算出來，不寫死。
     *
     * 寫死六個名字的話，這條測試會在「有人加了一級」時紅——
     * 而那不是錯誤。要釘的是「資料裡有幾級，畫面上就要有幾級」。
     */
    await page.goto("/pricing");

    const headings = await page.locator("main h3").allInnerTexts();
    expect(headings).toEqual(PRICING_TIERS.map((tier) => tier.name));
  });

  test("兩個承接點在，價格也對得上", async ({ page }) => {
    /*
     * §26.1 點名的就是這兩級：
     * 「缺了它們，升級路徑等同從 NT$990 直接跳 NT$30,000」。
     */
    await page.goto("/pricing");

    for (const id of ["template-build", "semi-custom"]) {
      const tier = PRICING_TIERS.find((item) => item.id === id)!;
      const row = page.locator("li", { hasText: tier.name }).first();
      await expect(row, `${tier.name} 不在 /pricing 上`).toBeVisible();
      await expect(row).toContainText(tier.price);
    }
  });

  test("不是六張等寬卡（§26.2）", async ({ page }) => {
    /*
     * §26.2 明文禁止。而「改成卡片」是一個很容易在改版時發生、
     * 又沒有人會察覺違反規格的動作。
     *
     * 判準：那個清單不能是多欄的 grid。縱向階梯每一列都是整寬的。
     */
    await page.goto("/pricing");

    const columns = await page
      .locator("main ul")
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);

    expect(
      columns === "none" || columns.split(" ").length === 1,
      `價格清單變成多欄了：${columns}`,
    ).toBe(true);
  });
});

test.describe("/playground — §8.15 的完整功能範圍", () => {
  test("不用登入就進得去，而且完整控制項都在", async ({ page }) => {
    /*
     * §8.15：「讓訪客在不與 Agent 對話的前提下，自己完成一次試穿。」
     * CR-006 把完整的那一次搬到這裡，那句話的要求一個字都沒變——
     * 加任何門檻都會讓它失效。
     */
    await page.goto("/playground");

    await expect(page.getByRole("heading", { name: /試穿/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "模板" })).toBeVisible();

    // Theme / Accent / 裝置：§8.15「允許」清單裡的三項
    for (const label of ["風格", "主色", "裝置"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("換一套模板，預覽真的跟著換", async ({ page }) => {
    // 切換若沒有生效，畫面上是「按了沒反應」——而那不會有任何錯誤
    await page.goto("/playground");

    const before = await page.locator('[aria-label$="模板預覽"]').getAttribute("aria-label");
    await page.getByRole("list", { name: "模板" }).getByRole("button").nth(1).click();

    await expect(page.locator('[aria-label$="模板預覽"]')).not.toHaveAttribute(
      "aria-label",
      before ?? "",
    );
  });

  test("畫面上說得出它不是編輯器", async ({ page }) => {
    // 看起來很像編輯器卻改不了文字——不說的話，訪客會以為壞了
    await page.goto("/playground");
    await expect(page.getByText("這裡是試穿，不是編輯器")).toBeVisible();
  });
});

test("兩條新路由都從首頁點得到", async ({ page }) => {
  // 這個專案七次做完功能卻沒有入口。一次新增兩條路由時最該先驗這個
  await page.goto("/");

  for (const [name, path] of [
    ["價格", "/pricing"],
    ["試穿", "/playground"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("首頁的價格入口把人帶到完整階梯", async ({ page }) => {
  /*
   * §26.1 的原意（升級路徑不能有斷層）在 CR-006 之後，
   * 只有在首頁真的把人帶過去時才成立。藏起來就等於缺了那幾級。
   */
  await page.goto("/");

  const link = page.getByRole("link", { name: /看完整 \d+ 級/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/pricing$/);
});

for (const path of ["/pricing", "/playground"]) {
  test(`${path} 沒有 critical/serious 的 a11y 違規`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(serious.map((violation) => violation.id)).toEqual([]);
  });
}
