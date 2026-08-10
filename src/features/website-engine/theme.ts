import type { ThemeConfig } from "./schema";

/**
 * Theme Engine（Spec §14 / Plan §3）
 *
 * 把 ThemeConfig 轉成 `--site-*` CSS 自訂屬性，注入 `[data-site-scope]` 容器。
 *
 * ── 為什麼一定要 scoped ──────────────────────────────────────
 *
 * 官網自己的品牌 token 是 `--color-brand-*`，掛在 `:root`。
 * 被預覽的客戶網站主題是 `--site-*`，只能掛在 scope 容器上。
 *
 * 若把 `--site-*` 寫進 `:root`，Preview 的主題會滲出去改變官網外觀；
 * 反過來若 Section 元件直接用 `--color-brand-*`，被預覽的網站會長得像我們。
 * 兩者都是「看起來只是顏色怪怪的」，但根因很難查。
 *
 * 命名層級即隔離：看到 `--site-*` 出現在 `:root`，就是架構已經破了。
 */

/** 前綴集中在此，方便測試與 Section 元件引用 */
export const SITE_VAR_PREFIX = "--site-";

export const SITE_VARS = {
  background: `${SITE_VAR_PREFIX}color-background`,
  surface: `${SITE_VAR_PREFIX}color-surface`,
  text: `${SITE_VAR_PREFIX}color-text`,
  muted: `${SITE_VAR_PREFIX}color-muted`,
  accent: `${SITE_VAR_PREFIX}color-accent`,
  fontHeading: `${SITE_VAR_PREFIX}font-heading`,
  fontBody: `${SITE_VAR_PREFIX}font-body`,
  radius: `${SITE_VAR_PREFIX}radius`,
  spacing: `${SITE_VAR_PREFIX}spacing`,
} as const;

/**
 * 注入點的第二道防線。
 *
 * 3A 的 schema 已經擋掉了含 `;` `{` `}` 的值，這裡再擋一次是刻意的重複。
 *
 * 理由：SSR 會把 inline style 序列化成 `style="--site-accent: red"` 屬性。
 * 值裡若有分號，就會變成同一個 style 屬性內的**額外宣告**——
 * 那是真正的 CSS 注入，雖然範圍限於該元素。
 *
 * 兩層防線的價值在於：schema 是給「進入系統的資料」把關，
 * 這裡是給「離開系統的輸出」把關。若哪天有人繞過 schema 直接呼叫渲染
 * （例如寫測試、寫 script、或未來新增別的資料來源），這一層仍在。
 */
const UNSAFE_IN_CSS_VALUE = /[;{}<>\\]|\/\*|\*\//;

export function isSafeCssValue(value: string): boolean {
  return !UNSAFE_IN_CSS_VALUE.test(value);
}

/** CSS 自訂屬性名 → 值。鍵一律為 --site-* */
export type ThemeVars = Record<string, string>;

/**
 * ThemeConfig → CSS 自訂屬性。
 *
 * 任何不安全的值一律略過該項，而非略過整個主題——
 * 少一個顏色會退回容器的預設值，整個主題失效則是整片空白。
 * 失敗要盡量小。
 */
export function themeToCssVars(theme: ThemeConfig): ThemeVars {
  const candidates: [string, string][] = [
    [SITE_VARS.background, theme.colors.background],
    [SITE_VARS.surface, theme.colors.surface],
    [SITE_VARS.text, theme.colors.text],
    [SITE_VARS.muted, theme.colors.muted],
    [SITE_VARS.accent, theme.colors.accent],
    [SITE_VARS.fontHeading, theme.typography.heading],
    [SITE_VARS.fontBody, theme.typography.body],
    [SITE_VARS.radius, theme.radius],
    [SITE_VARS.spacing, theme.spacingScale],
  ];

  const vars: ThemeVars = {};
  for (const [name, value] of candidates) {
    if (isSafeCssValue(value)) vars[name] = value;
  }

  return vars;
}

/**
 * 主題是否完整。
 *
 * 呼叫端可用它判斷「有值被擋掉了」——那代表資料有問題，
 * 應該讓人看見，而不是靜靜地少一個顏色。
 */
export function findUnsafeThemeValues(theme: ThemeConfig): string[] {
  const vars = themeToCssVars(theme);
  return Object.values(SITE_VARS).filter((name) => !(name in vars));
}
