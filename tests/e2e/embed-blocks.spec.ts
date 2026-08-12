import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * 白名單嵌入（CR-003-3）
 *
 * `embeds.test.ts` 驗的是「網址組得對不對」，那是純函式。
 * 這裡驗的是瀏覽器裡才看得到的那一半：**在訪客按下去之前，
 * 有沒有東西已經連出去了。**
 *
 * 那件事沒有辦法用單元測試證明——facade 寫錯（例如預設 loaded = true，
 * 或有人為了「少一次點擊」把它拿掉）的時候，畫面看起來只是更方便了，
 * 沒有任何東西會紅。
 */

const THIRD_PARTY = /google|youtube|gstatic|ytimg/;

test.describe("嵌入區塊", () => {
  test("按下去之前不會連到任何第三方", async ({ page }) => {
    /*
     * 這個預覽長在我們自己的首頁上。直接放 iframe 的話，
     * 每個只是來看看我們接不接案的訪客，都會被送去 Google 一次
     * ——帶著他的 IP 與我們的網域。
     */
    const hosts: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).host;
      if (THIRD_PARTY.test(host)) hosts.push(host);
    });

    await page.goto("/");
    await page.getByRole("button", { name: /^Local Business/ }).click();

    const facade = page.locator("[data-embed-facade]");
    await facade.scrollIntoViewIfNeeded();
    await expect(facade).toBeVisible();

    expect(hosts, "還沒按就已經連出去了——facade 大概沒有生效").toEqual([]);
  });

  test("按下去之後才建立 iframe，而且帶著該有的限制", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Local Business/ }).click();

    const facade = page.locator("[data-embed-facade]");
    await facade.scrollIntoViewIfNeeded();
    await facade.click();

    const frame = page.locator("[data-site-scope] iframe");
    await expect(frame).toBeVisible();

    const attrs = await frame.evaluate((el: HTMLIFrameElement) => ({
      src: el.src,
      sandbox: el.getAttribute("sandbox") ?? "",
      title: el.title,
    }));

    // 主機由我們決定，不是由內容決定
    expect(new URL(attrs.src).host).toBe("www.google.com");
    expect(new URL(attrs.src).protocol).toBe("https:");

    // 沒有 title 的 iframe 是 axe 的 serious 違規
    expect(attrs.title.length).toBeGreaterThan(0);

    // 被嵌入的第三方不該有辦法把訪客整頁導走
    expect(attrs.sandbox).not.toContain("allow-top-navigation");
    expect(attrs.sandbox).toContain("allow-scripts");
  });

  test("載入之後 axe 仍然沒有 critical/serious", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Local Business/ }).click();

    const facade = page.locator("[data-embed-facade]");
    await facade.scrollIntoViewIfNeeded();
    await facade.click();
    await page.locator("[data-site-scope] iframe").waitFor();

    const results = await new AxeBuilder({ page })
      .include("#templates")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});
