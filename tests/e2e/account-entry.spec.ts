import { expect, test } from "@playwright/test";

/**
 * 會員入口（Spec V1.3 §47 CR-002 / Phase M）
 *
 * ── 為什麼需要這一條 ──────────────────────────────────────────
 *
 * 登入頁、profiles 資料表、RLS、trigger 全部做好了，
 * 但**選單上沒有任何一個地方連得到登入頁**——一般人只能自己把
 * /login 打進網址列。整套帳號系統對它的使用者等於不存在。
 *
 * 這與【8】路由可達性抓到的是同一種縫：東西做好了，沒有入口。
 * 差別只在那次抓的是後台路由，這次漏的是最外層的登入。
 */

test.describe("會員入口", () => {
  test("首頁看得到登入入口", async ({ page }) => {
    await page.goto("/");

    const login = page.getByRole("link", { name: "登入" }).first();
    await expect(login).toBeVisible();
    await expect(login).toHaveAttribute("href", "/login");
  });

  test("每一條公開頁面都有入口，不是只有首頁", async ({ page }) => {
    // 訪客不會總是從首頁進來。作品頁看完想登入，那裡也要有。
    for (const path of ["/", "/work", "/start"]) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: "登入" }).first(),
        `${path} 沒有登入入口`,
      ).toBeVisible();
    }
  });

  test("未登入不會洩漏後台入口", async ({ page }) => {
    /*
     * 會員中心與網站後台是兩個不同的東西，而後者的路徑是密的。
     * 加會員入口的時候最容易順手把兩個做成同一顆按鈕——那會讓
     * 密路徑出現在所有人的 HTML 裡。
     */
    await page.goto("/");

    await expect(page.getByRole("link", { name: /後台/ })).toHaveCount(0);

    const html = await page.content();
    const segment = process.env.ADMIN_SEGMENT?.trim();
    if (segment) expect(html).not.toContain(segment);
  });

  test("未登入進會員中心會被送去登入頁，而且記得原本要去哪", async ({ page }) => {
    await page.goto("/account");

    expect(new URL(page.url()).pathname).toBe("/login");
    // 記住 next，登入後才回得到會員中心而不是被丟回首頁
    expect(new URL(page.url()).searchParams.get("next")).toBe("/account");
  });
});
