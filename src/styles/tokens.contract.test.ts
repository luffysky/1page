import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Token 契約測試 — 直接對應 Implementation Plan §4「1A 出口條件」。
 *
 * 這三組測試不是形式主義：它們把「Design Token 是唯一數值來源」
 * 與「兩套 Token 系統不得混用」從口頭約定變成會 fail 的東西。
 */

const ROOT = process.cwd();
const tokensCss = readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8");
const globalsCss = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

/** Plan §4：Phase 1 必須完成的八類 token */
const REQUIRED_TOKENS: Record<string, string[]> = {
  color: [
    "--color-brand-bg",
    "--color-brand-paper",
    "--color-brand-cream",
    "--color-brand-ink",
    "--color-brand-muted",
    "--color-brand-line",
    "--color-brand-accent",
    "--color-brand-accent-strong",
    "--color-brand-accent-soft",
    "--color-brand-on-ink",
    "--color-brand-on-accent",
    "--color-brand-focus",
  ],
  typography: [
    "--font-sans",
    "--font-display",
    "--text-display-1",
    "--text-display-2",
    "--text-heading-1",
    "--text-heading-2",
    "--text-lead",
    "--text-body",
    "--text-body-sm",
    "--text-caption",
    "--text-kicker",
  ],
  spacing: ["--spacing-gutter", "--spacing-gutter-lg", "--spacing-section", "--spacing-section-lg"],
  radius: [
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-2xl",
    "--radius-pill",
  ],
  shadow: ["--shadow-soft", "--shadow-lifted"],
  container: ["--container-page", "--container-prose"],
  breakpoint: [
    "--breakpoint-sm",
    "--breakpoint-md",
    "--breakpoint-lg",
    "--breakpoint-xl",
    "--breakpoint-2xl",
    "--breakpoint-3xl",
  ],
  motion: [
    "--ease-brand",
    "--ease-brand-out",
    "--duration-fast",
    "--duration-base",
    "--duration-slow",
  ],
};

describe("Design Token 八類齊備（Plan §4）", () => {
  for (const [category, tokens] of Object.entries(REQUIRED_TOKENS)) {
    it(`${category} token 全數定義於 tokens.css`, () => {
      const missing = tokens.filter((token) => !tokensCss.includes(`${token}:`));
      expect(missing).toEqual([]);
    });
  }
});

describe("兩套 Token 系統隔離（Plan §3）", () => {
  it("tokens.css 不得宣告任何 --site-* token", () => {
    // --site-* 屬於 SiteConfig.theme（Spec §14），必須 scoped 注入至
    // [data-site-scope]，寫進 :root 會讓 Preview 污染官網或反向繼承品牌色。
    const declarations = tokensCss.match(/^\s*--site-[\w-]+\s*:/gm) ?? [];
    expect(declarations).toEqual([]);
  });

  it("globals.css 不得宣告任何 --site-* token", () => {
    const declarations = globalsCss.match(/^\s*--site-[\w-]+\s*:/gm) ?? [];
    expect(declarations).toEqual([]);
  });
});

describe("字級符合 Spec §3 Hero 規格", () => {
  it("display-1 的 clamp 下限為 2.75rem（44px）、上限為 7rem（112px）", () => {
    // Spec §3：Hero H1 桌機 72–112px、行動 44–64px
    // Demo 的 clamp(52px, 8vw, 96px) 不符規格，已於 Spec §45.2 記錄，不得沿用
    const match = tokensCss.match(/--text-display-1:\s*clamp\(([^)]+)\)/);
    expect(match).not.toBeNull();

    const [min, , max] = match![1]!.split(",").map((part) => part.trim());
    expect(min).toBe("2.75rem");
    expect(max).toBe("7rem");
  });
});
