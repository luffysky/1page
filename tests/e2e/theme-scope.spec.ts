import { expect, test } from "@playwright/test";

/**
 * Theme Engine 的作用域隔離（Plan §3 / 3B 出口條件）。
 *
 * 單元測試驗證「產生的變數名稱都在 --site-* 命名空間」，
 * 但那證明不了「瀏覽器實際計算出來的樣式是隔離的」——
 * CSS 的繼承與層疊只有在真的瀏覽器裡才看得準。
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/_dev/theme");
});

test("--site-* 絕不出現在 :root", async ({ page }) => {
  const leaked = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const names = [
      "--site-color-background",
      "--site-color-surface",
      "--site-color-text",
      "--site-color-muted",
      "--site-color-accent",
      "--site-font-heading",
      "--site-font-body",
      "--site-radius",
      "--site-spacing",
    ];
    return names.filter((name) => root.getPropertyValue(name).trim() !== "");
  });

  expect(leaked, "主題變數滲漏到 :root —— Preview 會污染官網").toEqual([]);
});

test("官網品牌 token 不受主題影響", async ({ page }) => {
  const brand = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      bg: root.getPropertyValue("--color-brand-bg").trim(),
      ink: root.getPropertyValue("--color-brand-ink").trim(),
      accent: root.getPropertyValue("--color-brand-accent").trim(),
    };
  });

  // tokens.css 的值，不該被任何主題改動
  expect(brand.bg).toBe("#f4efe7");
  expect(brand.ink).toBe("#141414");
  expect(brand.accent).toBe("#ef3e2f");
});

test("兩個 scope 各自套用自己的主題，互不干擾", async ({ page }) => {
  const values = await page.evaluate(() => {
    const scopes = Array.from(document.querySelectorAll("[data-site-scope]"));
    return scopes.map((element) =>
      getComputedStyle(element).getPropertyValue("--site-color-background").trim(),
    );
  });

  expect(values.length).toBeGreaterThanOrEqual(2);
  // 兩份不同的主題必須產生不同的值——若相同，代表其中一個沒生效
  expect(new Set(values).size).toBeGreaterThan(1);
});

test("巢狀 scope 由內層完全覆蓋", async ({ page }) => {
  const result = await page.evaluate(() => {
    const scopes = Array.from(document.querySelectorAll("[data-site-scope]"));
    const nested = scopes.find((element) =>
      scopes.some((other) => other !== element && other.contains(element)),
    );
    if (!nested) return null;

    const outer = scopes.find((other) => other !== nested && other.contains(nested))!;
    return {
      inner: getComputedStyle(nested).getPropertyValue("--site-color-background").trim(),
      outer: getComputedStyle(outer).getPropertyValue("--site-color-background").trim(),
    };
  });

  expect(result).not.toBeNull();
  expect(result!.inner).not.toBe(result!.outer);
});

test("主題實際改變了子元素的計算樣式", async ({ page }) => {
  // 變數存在但沒被使用等於沒生效。這裡驗證的是「畫面真的變了」。
  const colors = await page.evaluate(() => {
    const scopes = Array.from(document.querySelectorAll("[data-site-scope]"));
    return scopes.slice(0, 2).map((scope) => {
      const card = scope.querySelector("div");
      return card ? getComputedStyle(card).backgroundColor : "";
    });
  });

  expect(colors[0]).not.toBe("");
  expect(colors[0]).not.toBe(colors[1]);
});

test("style 屬性中沒有被注入額外的 CSS 宣告", async ({ page }) => {
  const styles = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-site-scope]")).map(
      (element) => element.getAttribute("style") ?? "",
    ),
  );

  for (const style of styles) {
    // 主題變數以外的宣告不該出現在 scope 容器上
    const declarations = style.split(";").filter((part) => part.trim());
    for (const declaration of declarations) {
      expect(declaration.trim().startsWith("--site-"), `非預期的宣告：${declaration}`).toBe(true);
    }
  }
});
