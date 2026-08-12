import { expect, test } from "@playwright/test";

/**
 * Theme Engine 的作用域隔離（Plan §3 / 3B 出口條件）。
 *
 * 單元測試驗證「產生的變數名稱都在 --site-* 命名空間」，
 * 但那證明不了「瀏覽器實際計算出來的樣式是隔離的」——
 * CSS 的繼承與層疊只有在真的瀏覽器裡才看得準。
 */

// 大部分測試在 /_dev/theme 上跑；字型與間距那一組需要多套主題並列，
// 在自己的 describe 裡另外導向 /_dev/templates。
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

/**
 * 主題不是只有顏色。
 *
 * 4A 之前，`--site-font-*` 已經被正確注入到 scope 容器上，
 * 但 Section 元件的 `font-[var(--site-font-heading)]` **什麼都沒產出**——
 * `font-*` 同時是 font-family 與 font-weight 的前綴，任意值形式無法判斷要哪一個。
 * 結果是所有預覽的字體都繼承官網的 Inter / Noto Serif TC。
 *
 * 這個 bug 活了一整個 Phase，因為 theme-scope 只驗色彩。
 * 顏色用的 `bg-[var(--x)]` / `text-[var(--x)]` 沒有歧義，所以一直是對的，
 * 而「有一組守衛」跟「守衛涵蓋這一項」是兩件事。
 *
 * 判準是**瀏覽器算出來的 font-family**，不是 class 字串——
 * 那正是當初漏掉的那一步。
 */
test.describe("主題的字型與間距真的生效", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/_dev/templates");
  });

  test("標題採用主題字型，不是官網的字體", async ({ page }) => {
    const result = await page.evaluate(() => {
      const scopes = [...document.querySelectorAll("[data-site-scope]")];

      return scopes
        .map((scope) => {
          const heading = scope.querySelector("h1, h2, h3");
          if (!heading) return null;
          return {
            declared: getComputedStyle(scope).getPropertyValue("--site-font-heading").trim(),
            computed: getComputedStyle(heading).fontFamily,
          };
        })
        .filter((entry) => entry !== null);
    });

    expect(result.length).toBeGreaterThan(0);

    for (const { declared, computed } of result) {
      // 主題宣告的第一個字族必須出現在實際算出來的 font-family 裡
      const first = declared.split(",")[0]!.trim();
      expect(computed, `主題宣告 ${declared}，實際卻是 ${computed}`).toContain(first);

      // 官網自己的字體不得滲進預覽
      expect(computed).not.toContain("Inter");
      expect(computed).not.toContain("Noto Serif TC");
    }
  });

  test("同一個區塊在不同 spacingScale 的主題下留白不同", async ({ page }) => {
    // ThemeConfig 有 spacingScale 這個欄位，但在 4A 之前沒有任何東西讀它——
    // 改了完全不會有反應。這條確認它真的接上了版面。
    //
    // ⚠️ 比對必須限定在**同一個版面**（className 相同）的區塊之間。
    //    第一版是「隨便挑各主題的第一個 section 來比」，那條會假性通過：
    //    不同模板的第一個 section 本來就用不同的間距類別，
    //    數值不同完全不代表 spacingScale 生效了。
    const groups = await page.evaluate(() => {
      const rows: { spacing: string; layout: string; padding: number }[] = [];

      for (const scope of document.querySelectorAll("[data-site-scope]")) {
        const spacing = getComputedStyle(scope).getPropertyValue("--site-spacing").trim();

        for (const section of scope.querySelectorAll("section")) {
          rows.push({
            spacing,
            layout: section.className,
            padding: Number.parseFloat(getComputedStyle(section).paddingTop),
          });
        }
      }

      return rows;
    });

    const byLayout = new Map<string, Map<string, number>>();
    for (const row of groups) {
      const entry = byLayout.get(row.layout) ?? new Map<string, number>();
      entry.set(row.spacing, row.padding);
      byLayout.set(row.layout, entry);
    }

    // 至少要有一個版面同時出現在兩種 spacingScale 的主題下，否則這條測不到東西
    const comparable = [...byLayout.values()].filter((entry) => entry.size > 1);
    expect(comparable.length, "沒有任何區塊同時出現在兩種間距的主題下").toBeGreaterThan(0);

    for (const entry of comparable) {
      const paddings = new Set(entry.values());
      expect(
        paddings.size,
        `同一版面在 ${[...entry.keys()].join(" / ")} 下留白相同：${[...entry.values()].join(", ")}`,
      ).toBe(entry.size);
    }
  });
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
