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
