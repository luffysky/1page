import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * 模板內的客服體驗（CR-003-1）
 *
 * ── 為什麼不在 a11y-all-routes 裡就好 ──────────────────────────
 *
 * 那份掃的是「路由載入後的樣子」。這個泡泡預設是收起來的，
 * 所以整段對話介面——輸入框、log 區、關閉鈕——在那份掃描裡
 * 從來沒有存在過。展開之後才是使用者真正面對的東西。
 *
 * 這裡不打真的 API：模型的回答是活的，拿它當斷言只會換來一支
 * 時好時壞的測試。行為正確性由 demo-prompt.test.ts（提示詞內容）
 * 與 demo-assistant-isolation.test.ts（零工具、額度分開）守。
 * 這裡只守「打得開、看得出是示範、鍵盤走得完、axe 乾淨」。
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("預覽裡的客服體驗", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("展開後 axe 沒有 critical/serious", async ({ page }) => {
    await page.getByRole("button", { name: /客服聊聊/ }).click();

    const results = await new AxeBuilder({ page })
      .include("#templates")
      .withTags(WCAG_TAGS)
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
      "展開的客服對話有 a11y 問題",
    ).toEqual([]);
  });

  test("泡泡真的穿上被預覽網站的顏色", async ({ page }) => {
    /*
     * 這條驗的是**算出來的顏色**，不是有沒有掛上類別。
     *
     * 泡泡原本被放在 SiteRenderer 的 `[data-site-scope]` 外面
     * （因為它不能跟著內容捲走），而 `--site-*` 全部宣告在那個元素上。
     * 於是 `site.accentBg` 解析到一個不存在的變數——背景是透明的。
     * 類別都在、沒有錯誤、測試也不會紅，只是那顆按鈕沒有顏色。
     *
     * 這是這個專案第二次踩到「寫法看起來對、產出是空的」：
     * 第一次是 `font-[var(--x)]`（見 site-classes.ts）。兩次都只有
     * 去讀 computed style 才看得到，所以這裡也讀 computed style。
     */
    const bg = async () =>
      page
        .getByRole("button", { name: /客服聊聊/ })
        .evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.getByRole("button", { name: /^Product/ }).click();
    const product = await bg();

    await page.getByRole("button", { name: /^Local Business/ }).click();
    const localBusiness = await bg();

    for (const [name, color] of [
      ["Product", product],
      ["Local Business", localBusiness],
    ]) {
      // 比對「alpha 是 0」而不是寫出某個顏色字面值——
      // no-hardcoded-design-values 會（正確地）抓走測試檔裡的顏色字面值。
      expect(color, `${name} 的客服泡泡是透明的——變數大概沒解析到`).not.toMatch(
        /,\s*0\s*\)$|^transparent$/,
      );
    }

    // 兩套模板的主色不同，泡泡的顏色就該不同。
    // 相同代表它掛的其實是某個固定值，而不是主題變數。
    expect(product, "換了模板，客服泡泡的顏色卻沒變").not.toBe(localBusiness);
  });

  test("展開後不會溢出預覽框，最窄的裝置也一樣", async ({ page }) => {
    /*
     * SiteScope 的 base 帶了 `@container`（container-type: inline-size），
     * 那會對行內軸做尺寸內縮——包著泡泡的那層就**不再依內容撐開**。
     * 量出來 width: 0，整個對話框溢出到預覽框外面，蓋住我們自己的頁面。
     *
     * 這種錯截圖看得出來，但沒有任何測試會紅，所以直接量 bounding box。
     * Mobile 是最緊的情況：框只有 384px 寬，而對話框想要 352px。
     */
    for (const device of ["Desktop", "Mobile"]) {
      await page
        .getByRole("radio", { name: device })
        .or(page.getByRole("button", { name: device }))
        .first()
        .click();

      await page.getByRole("button", { name: /客服聊聊/ }).click();

      const frame = await page
        .locator("[data-site-scope]")
        .first()
        .evaluate((el) => el.closest(".relative")!.getBoundingClientRect().toJSON());
      const bubble = await page
        .locator("[data-site-scope]")
        .last()
        .evaluate((el) => el.getBoundingClientRect().toJSON());

      expect(bubble.width, `${device}：泡泡寬度是 0，大概是被 @container 內縮掉了`).toBeGreaterThan(
        100,
      );
      expect(bubble.right, `${device}：泡泡超出預覽框右緣`).toBeLessThanOrEqual(frame.right);
      expect(bubble.left, `${device}：泡泡超出預覽框左緣`).toBeGreaterThanOrEqual(frame.left);

      await page.getByRole("button", { name: "關閉客服對話" }).click();
    }
  });

  test("看得出這是示範，而不是一間真的店", async ({ page }) => {
    /*
     * 讓人以為在跟一間真的店講話、之後才發現店是假的，
     * 會讓他連帶懷疑這個網站上其他東西的真假。
     */
    await page.getByRole("button", { name: /客服聊聊/ }).click();

    await expect(page.getByText("這是示範")).toBeVisible();
  });

  test("鍵盤打得開、也關得掉", async ({ page }) => {
    const opener = page.getByRole("button", { name: /客服聊聊/ });
    await opener.focus();
    await page.keyboard.press("Enter");

    const input = page.getByLabel("問這間店");
    await expect(input).toBeVisible();

    await page.getByRole("button", { name: "關閉客服對話" }).focus();
    await page.keyboard.press("Enter");

    await expect(input).toBeHidden();
    await expect(opener).toBeVisible();
  });

  test("預覽裡沒有可聚焦、卻什麼都不會發生的控制項", async ({ page }) => {
    /*
     * 模板是**版面示意**，不是能用的網站。所以裡面不該有真的輸入框
     * 或真的送出鈕——它們沒有後端可以收。
     *
     * 這件事 axe 抓不到：沒有任何規則在問「這個可聚焦的東西有用嗎」。
     * 但鍵盤使用者會依序停在幾個打不了字的框上，然後找不到送出鈕。
     *
     * form 區塊因此做成「表單的照片」（見 sections/detail.tsx），
     * 按鈕沒有 href 時也渲染成 span（見 sections/shared.tsx）。
     * 這條守的是那兩個決定不會在某次重構裡被「修好」成真的控制項。
     */
    for (const template of ["Product", "Studio", "Local Business", "Personal"]) {
      await page.getByRole("button", { name: new RegExp(`^${template}`) }).click();

      // 只看模板內容（section 裡面）。客服泡泡也在 scope 裡，
      // 但它是真的能用的東西，不在這條規則的範圍內。
      const focusable = page.locator(
        "[data-site-scope] section input, [data-site-scope] section textarea," +
          "[data-site-scope] section select, [data-site-scope] section button",
      );

      expect(await focusable.count(), `${template} 的預覽裡有沒有作用的表單控制項`).toBe(0);
    }
  });

  test("扮演的是被預覽的那間店，換模板就換一間", async ({ page }) => {
    // 這個泡泡的名字必須跟著預覽走。寫死成我們自己的名字，
    // 整個「這是你的網站」的示範就垮了。
    await page.getByRole("button", { name: /^Local Business/ }).click();
    await expect(page.getByRole("button", { name: /晴日咖啡.*客服聊聊|客服聊聊/ })).toBeVisible();

    await page.getByRole("button", { name: /客服聊聊/ }).click();
    await expect(page.getByText("晴日咖啡 客服")).toBeVisible();

    await page.getByRole("button", { name: "關閉客服對話" }).click();
    await page.getByRole("button", { name: /^Studio/ }).click();
    await page.getByRole("button", { name: /客服聊聊/ }).click();

    await expect(page.getByText("光合設計 客服")).toBeVisible();
  });
});
