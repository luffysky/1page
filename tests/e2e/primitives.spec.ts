import { expect, test } from "@playwright/test";

/**
 * 1C 的 Gate 第 5 項行為驗證。
 *
 * 兩件事單元測試驗不出來，必須進真實瀏覽器：
 *   1. 原生 <dialog> 的 Escape 關閉與 focus trap
 *   2. disabled 控制項在真的點下去時確實沒有任何反應
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/_dev/primitives");
});

test.describe("Mobile Nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("768px 以下顯示選單按鈕，桌機連結隱藏", async ({ page }) => {
    await expect(page.getByRole("button", { name: "開啟選單" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主要導覽" })).toBeHidden();
  });

  test("可開啟、可關閉，且 aria-expanded 隨之變化", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "開啟選單" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(page.getByRole("navigation", { name: "行動版導覽" })).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "關閉選單" }).click();
    await expect(page.getByRole("navigation", { name: "行動版導覽" })).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape 可關閉選單", async ({ page }) => {
    await page.getByRole("button", { name: "開啟選單" }).click();
    await expect(page.getByRole("navigation", { name: "行動版導覽" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "行動版導覽" })).toBeHidden();
  });

  test("開啟後 focus 進入選單，且不會 tab 到背景的可互動元素", async ({ page }) => {
    await page.getByRole("button", { name: "開啟選單" }).click();

    // modal dialog 的保證是「焦點不會落到背景的可互動內容」，
    // 而不是「activeElement 永遠在 dialog 內」——焦點環繞一圈後會先經過
    // <body> 再繞回 dialog 的第一個元素，那是瀏覽器正常行為。
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");

      const escaped = await page.evaluate(() => {
        const dialog = document.getElementById("mobile-nav");
        const active = document.activeElement;
        if (!dialog || !active) return false;
        if (dialog.contains(active)) return false;
        if (active === document.body || active === document.documentElement) return false;
        return true; // 落到背景的實際元素上 = 逃出去了
      });

      expect(escaped).toBe(false);
    }

    // 繞完一圈後仍應回到選單內，證明是環繞而非真的離開
    const backInside = await page.evaluate(() => {
      const dialog = document.getElementById("mobile-nav");
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(backInside).toBe(true);
  });

  test("可用鍵盤開啟選單", async ({ page }) => {
    await page.getByRole("button", { name: "開啟選單" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("navigation", { name: "行動版導覽" })).toBeVisible();
  });
});

test.describe("Shell 禁止假互動", () => {
  /*
   * 4B 之前這裡有一條「Template Experience 的切換控制項點下去毫無反應」。
   * 那條測的是殼——控制項一律 disabled，寧可不能按也不要假裝會動。
   *
   * 4B 把它接上真的 SiteConfig 之後，那個判準就過期了：
   * 現在它**應該**有反應。對應的驗證搬到兩個地方，
   * 分別驗單元與瀏覽器兩層：
   *   src/components/shared/no-fake-interaction.test.tsx
   *   tests/e2e/template-experience.spec.ts
   *
   * 這一頁只留 Agent 那一半——它到 Phase 5 之前仍然是殼。
   */
  test("Agent 輸入框無法輸入", async ({ page }) => {
    const input = page.getByRole("textbox");
    await expect(input).toBeDisabled();
    await expect(page.getByRole("button", { name: "問 AI 顧問" })).toBeDisabled();
  });
});

test("八個 primitive 全數呈現", async ({ page }) => {
  for (const name of [
    "Navbar",
    "Hero",
    "EditorialSection",
    "PortfolioLayout",
    "SitePreview",
    "AgentWorkspaceShell",
    "PricingLadder",
    "DarkCtaBlock",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
});

test("完整六級價格皆呈現（Spec §26.1）", async ({ page }) => {
  for (const tier of [
    "AI Advisor",
    "Website Workshop",
    "Template Build",
    "Semi-Custom",
    "Custom",
    "Strategy + Design + Build",
  ]) {
    await expect(page.getByRole("heading", { name: tier, exact: true })).toBeVisible();
  }
});
