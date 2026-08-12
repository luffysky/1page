import { describe, expect, it } from "vitest";

import { HOME_GOALS } from "@/config/home-goals";

import { resolveSection } from "../registry";
import { validateSiteConfig } from "../schema";

import {
  ACCENT_IDS,
  buildSiteConfig,
  draftFromTemplate,
  getTemplate,
  listTemplates,
  resolveTheme,
  TEMPLATES,
  THEME_IDS,
  THEME_PRESETS,
} from "./index";
import { PLACEHOLDER } from "./types";

/**
 * 4A 出口條件的自動化驗證。
 *
 * 這裡測的不是「函式回傳了東西」，而是三件會真的害到訪客的事：
 *   1. 某個 template × theme × accent 的組合產出無效設定 → 訪客看到錯誤面板
 *   2. 某個 section 的 variant 打錯 → 靜靜降級成另一個排版，沒人會發現
 *   3. 某組主題的對比度不足 → 字看不清楚，而且只在那個組合下發生
 *
 * 第 3 點特別容易漏：首頁的 axe 掃描只會掃到**當下顯示的那一組**，
 * 其餘 11 組沒有任何東西在看。所以對比度在這裡實算，不靠 axe。
 */

/* ------------------------------------------------------------------ */
/* 所有組合都必須產出有效設定                                          */
/* ------------------------------------------------------------------ */

describe("template × theme × accent", () => {
  for (const template of TEMPLATES) {
    for (const themeId of THEME_IDS) {
      for (const accentId of ACCENT_IDS) {
        it(`${template.id} + ${themeId} + ${accentId} 通過 schema`, () => {
          const config = buildSiteConfig({
            ...draftFromTemplate(template),
            themeId,
            accentId,
          });

          const result = validateSiteConfig(config);
          expect(result.ok ? [] : result.errors).toEqual([]);
        });
      }
    }
  }
});

describe("模板結構", () => {
  it("每套模板的 section id 都不重複", () => {
    for (const template of TEMPLATES) {
      const ids = template.sections.map((section) => section.id);
      expect(new Set(ids).size, `${template.id} 有重複的 section id`).toBe(ids.length);
    }
  });

  it("每個 section 的 type + variant 都能精確解析，不依賴降級", () => {
    // registry 在找不到 variant 時會退回該 type 的第一個 variant。
    // 那個機制是給 Agent 亂寫 variant 時用的安全網，
    // 不是給我們自己寫錯模板時用的——模板寫錯應該在這裡就紅。
    const degraded = TEMPLATES.flatMap((template) =>
      template.sections
        .map((section) => ({ template: template.id, section, resolved: resolveSection(section) }))
        .filter((entry) => entry.resolved === null || entry.resolved.fallback !== "none")
        .map(
          (entry) =>
            `${entry.template}/${entry.section.id}: ${entry.section.type}.${entry.section.variant}`,
        ),
    );

    expect(degraded).toEqual([]);
  });

  it("每套模板都有 hero 與 footer", () => {
    for (const template of TEMPLATES) {
      const types = template.sections.map((section) => section.type);
      expect(types, `${template.id} 缺少 hero`).toContain("hero");
      expect(types, `${template.id} 缺少 footer`).toContain("footer");
    }
  });
});

/* ------------------------------------------------------------------ */
/* 佔位符代換                                                          */
/* ------------------------------------------------------------------ */

describe("佔位符", () => {
  it("產出的設定不得殘留任何佔位符", () => {
    for (const template of TEMPLATES) {
      const serialized = JSON.stringify(buildSiteConfig(draftFromTemplate(template)));
      expect(serialized, `${template.id} 殘留 ${PLACEHOLDER.brand}`).not.toContain(
        PLACEHOLDER.brand,
      );
      expect(serialized, `${template.id} 殘留 ${PLACEHOLDER.industry}`).not.toContain(
        PLACEHOLDER.industry,
      );
    }
  });

  it("改品牌名稱會反映到內容裡", () => {
    const template = getTemplate("studio")!;
    const config = buildSiteConfig({ ...draftFromTemplate(template), brandName: "測試品牌" });

    expect(JSON.stringify(config)).toContain("測試品牌");
    expect(config.brand.name).toBe("測試品牌");
  });

  it("巢狀在陣列與物件裡的佔位符也會代換", () => {
    // items 是 {label, text} 物件陣列。只代換頂層字串的實作會在這裡漏掉，
    // 而漏掉的表現是「網站上有一行寫著 {brand}」——很難看，但不會壞。
    const product = getTemplate("product")!;
    const config = buildSiteConfig({ ...draftFromTemplate(product), brandName: "阿福記帳" });
    const features = config.sections.find((section) => section.id === "features");

    expect(JSON.stringify(features)).toContain("阿福記帳");
  });
});

/* ------------------------------------------------------------------ */
/* 訪客輸入                                                            */
/* ------------------------------------------------------------------ */

describe("自由文字輸入", () => {
  it("含標籤形狀的輸入仍能產出有效設定", () => {
    // 訪客打到 `<` 的那一瞬間不該看到錯誤面板。
    const config = buildSiteConfig({
      ...draftFromTemplate(TEMPLATES[0]!),
      brandName: "<script>alert(1)</script>",
    });

    expect(validateSiteConfig(config).ok).toBe(true);
    expect(config.brand.name).not.toContain("<");
  });

  it("空白輸入回到模板預設，而不是產生一個沒有名字的網站", () => {
    const template = getTemplate("personal")!;
    const config = buildSiteConfig({ ...draftFromTemplate(template), brandName: "   " });

    expect(config.brand.name).toBe(template.defaultBrandName);
  });

  it("過長的輸入被截斷而非讓驗證失敗", () => {
    const config = buildSiteConfig({
      ...draftFromTemplate(TEMPLATES[0]!),
      brandName: "字".repeat(500),
    });

    expect(validateSiteConfig(config).ok).toBe(true);
    expect(config.brand.name.length).toBeLessThanOrEqual(80);
  });
});

/* ------------------------------------------------------------------ */
/* 篩選（Home Goal 接線）                                              */
/* ------------------------------------------------------------------ */

describe("listTemplates", () => {
  it("不給分類時回傳全部", () => {
    expect(listTemplates()).toHaveLength(TEMPLATES.length);
  });

  it("篩不到時回傳空陣列，不偷偷退回全部", () => {
    expect(listTemplates(["不存在的分類"])).toEqual([]);
  });

  it("每個 Home Goal 的 templateCategories 都至少對應一套模板", () => {
    // 設定檔裡寫了一個分類、卻沒有任何東西屬於它——
    // 上一班補【8】路由可達性時記下的就是這一類問題：
    // 兩邊各自都對，只有接起來的時候是空的，而沒有人在檢查。
    const empty = HOME_GOALS.filter(
      (goal) =>
        goal.templateCategories.length > 0 && listTemplates(goal.templateCategories).length === 0,
    ).map((goal) => `${goal.id} → ${goal.templateCategories.join(",")}`);

    expect(empty).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 對比度（WCAG 2.1 AA）                                               */
/* ------------------------------------------------------------------ */

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("主題對比度", () => {
  const AA = 4.5;

  it("所有主題的文字對背景與 surface 都達 AA", () => {
    for (const preset of THEME_PRESETS) {
      const { background, surface, text, muted } = preset.base.colors;

      expect(contrast(text, background), `${preset.id} text/background`).toBeGreaterThanOrEqual(AA);
      expect(contrast(text, surface), `${preset.id} text/surface`).toBeGreaterThanOrEqual(AA);
      expect(contrast(muted, background), `${preset.id} muted/background`).toBeGreaterThanOrEqual(
        AA,
      );
      expect(contrast(muted, surface), `${preset.id} muted/surface`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("所有 accent 對背景都達 AA（accent 同時當文字色與按鈕底色用）", () => {
    // site-classes.ts 的 onAccent 是 background 色，因此
    // 「accent 上的文字」與「背景上的 accent 文字」是同一組對比，檢查一次就夠。
    for (const themeId of THEME_IDS) {
      for (const accentId of ACCENT_IDS) {
        const theme = resolveTheme(themeId, accentId);

        expect(
          contrast(theme.colors.accent, theme.colors.background),
          `${themeId}/${accentId} accent/background`,
        ).toBeGreaterThanOrEqual(AA);
      }
    }
  });
});
