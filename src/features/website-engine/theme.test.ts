import { describe, expect, it } from "vitest";

import type { ThemeConfig } from "./schema";
import {
  findUnsafeThemeValues,
  isSafeCssValue,
  SITE_VAR_PREFIX,
  SITE_VARS,
  themeToCssVars,
} from "./theme";

/**
 * Theme Engine（Plan §3 的兩套 token 系統隔離）。
 *
 * 這裡驗證兩件事：
 *   1. 產生的變數全部在 `--site-*` 命名空間內（不會碰到官網的 `--color-brand-*`）
 *   2. 不安全的值不會被寫進 CSS —— 注入點的第二道防線
 */

const THEME: ThemeConfig = {
  colors: {
    background: "#f4e6d5",
    surface: "#ffffff",
    text: "#2a211c",
    muted: "rgb(120, 110, 100)",
    accent: "#b65d43",
  },
  typography: { heading: "Noto Serif TC", body: "Inter" },
  radius: "16px",
  spacingScale: "1rem",
};

describe("命名空間隔離", () => {
  it("產生的變數全部以 --site- 開頭", () => {
    const vars = themeToCssVars(THEME);
    expect(Object.keys(vars).length).toBeGreaterThan(0);

    for (const name of Object.keys(vars)) {
      expect(name.startsWith(SITE_VAR_PREFIX), name).toBe(true);
    }
  });

  it("絕不產生官網品牌 token —— Preview 不得污染官網", () => {
    const vars = themeToCssVars(THEME);
    for (const name of Object.keys(vars)) {
      expect(name.startsWith("--color-brand-"), `${name} 屬於官網品牌命名空間`).toBe(false);
      expect(name.startsWith("--font-"), name).toBe(false);
      expect(name.startsWith("--text-"), name).toBe(false);
    }
  });

  it("完整主題會產生全部九個變數", () => {
    const vars = themeToCssVars(THEME);
    for (const name of Object.values(SITE_VARS)) {
      expect(vars[name], `缺少 ${name}`).toBeDefined();
    }
    expect(findUnsafeThemeValues(THEME)).toEqual([]);
  });
});

describe("注入點的第二道防線", () => {
  it.each([
    ["red; background: url(//evil)", "分號可在同一個 style 屬性內插入額外宣告"],
    ["#fff}", "大括號可跳出區塊"],
    ["#fff{", "同上"],
    ["red/*", "註解可吞掉後續內容"],
    ["red*/", "同上"],
    ["<script>", "尖角括號"],
    ["red\\", "反斜線跳脫"],
  ])("拒絕 %s（%s）", (value) => {
    expect(isSafeCssValue(value)).toBe(false);
  });

  it("接受正常的色彩與長度值", () => {
    for (const value of [
      "#fff",
      "rgb(1, 2, 3)",
      "hsl(200 50% 50%)",
      "16px",
      "1rem",
      "Noto Serif TC",
    ]) {
      expect(isSafeCssValue(value), value).toBe(true);
    }
  });

  it("不安全的值被略過，其餘照常產出 —— 失敗要盡量小", () => {
    // 少一個顏色會退回容器預設值；整個主題失效則是整片空白
    const tainted: ThemeConfig = {
      ...THEME,
      colors: { ...THEME.colors, accent: "red; background: url(//evil)" },
    };

    const vars = themeToCssVars(tainted);
    expect(vars[SITE_VARS.accent]).toBeUndefined();
    expect(vars[SITE_VARS.background]).toBe("#f4e6d5");
    expect(findUnsafeThemeValues(tainted)).toEqual([SITE_VARS.accent]);
  });

  it("與 3A schema 形成兩層防線", () => {
    // schema 把關「進入系統的資料」，此處把關「離開系統的輸出」。
    // 若有人繞過 schema 直接呼叫渲染（測試、腳本、未來的新資料來源），
    // 這一層仍在。因此兩層都必須各自成立，不能互相假設。
    const bypassed = {
      ...THEME,
      colors: { ...THEME.colors, text: "black; --site-accent: red" },
    } as ThemeConfig;

    expect(themeToCssVars(bypassed)[SITE_VARS.text]).toBeUndefined();
  });
});
