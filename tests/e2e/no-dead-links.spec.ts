import { expect, type Page, test } from "@playwright/test";

/**
 * 站內連結不得指向不存在的目標。
 *
 * 這條測試是因為 2C 期間發現兩個死連結而加的，兩個都沒有任何既有測試抓到：
 *   Hero 主 CTA 指向 #try —— 首頁根本沒有 #try（實際是 #advisor）
 *   Final CTA 指向 #contact —— 在 /work 與詳細頁上不存在該錨點
 *
 * 錨點連結特別容易腐爛：改了 section id 不會有任何東西壞掉，
 * 直到有人真的點下去才發現什麼都沒發生。
 */

const ROUTES = ["/", "/work", "/work/interior-studio"];

async function collectLinks(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((el) => el.getAttribute("href") ?? "")
      .filter((href) => href && !href.startsWith("http") && !href.startsWith("mailto:")),
  );
}

for (const route of ROUTES) {
  test(`${route} 的站內連結都指向存在的目標`, async ({ page }) => {
    await page.goto(route);
    const links = await collectLinks(page);
    expect(links.length).toBeGreaterThan(0);

    const dead: string[] = [];

    for (const href of new Set(links)) {
      const hashIndex = href.indexOf("#");

      if (hashIndex >= 0) {
        const path = href.slice(0, hashIndex);
        const id = href.slice(hashIndex + 1);
        if (!id) continue;

        // 指向本頁的錨點：直接檢查元素是否存在
        const targetsCurrentPage = path === "" || path === route || (path === "/" && route === "/");
        if (targetsCurrentPage) {
          // 用屬性選擇器而非 `#id`：CSS.escape 是瀏覽器 API，Node 端沒有
          const exists = await page.locator(`[id="${id}"]`).count();
          if (exists === 0) dead.push(`${route} → ${href}（本頁無此錨點）`);
          continue;
        }

        // 指向其他頁的錨點：載入該頁再確認
        const probe = await page.context().newPage();
        const response = await probe.goto(path || "/");
        const ok = response?.ok() ?? false;
        const exists = ok ? await probe.locator(`[id="${id}"]`).count() : 0;
        await probe.close();

        if (!ok) dead.push(`${route} → ${href}（目標頁面無法載入）`);
        else if (exists === 0) dead.push(`${route} → ${href}（目標頁無此錨點）`);
        continue;
      }

      // 純路由連結
      const probe = await page.context().newPage();
      const response = await probe.goto(href);
      const status = response?.status() ?? 0;
      await probe.close();
      if (status >= 400) dead.push(`${route} → ${href}（HTTP ${status}）`);
    }

    expect(dead).toEqual([]);
  });
}
