/**
 * Section 元件專用的樣式類別。
 *
 * ── 為什麼用 Tailwind 任意值而不是 inline style ────────────────
 *
 * `bg-[var(--site-color-background)]` 是**類別**，不是 inline style。
 * 這代表 Section 元件完全不需要 `style={}`，也就不會觸碰
 * `no-hardcoded-design-values` 的 inline style 規則——
 * 那條規則的例外清單應該保持很短，只留真正無法用類別表達的情況
 * （例如上傳進度條的執行期百分比）。
 *
 * ⚠️ Section 元件**只能**使用這裡的類別，不得使用官網的 `--color-brand-*`。
 * 用了就會讓被預覽的客戶網站長得像我們，那是 Plan §3 要避免的另一個方向。
 *
 * 主題變數本身由 SiteScope 注入（見 site-scope.tsx）。
 */

export const site = {
  bg: "bg-[var(--site-color-background)]",
  surface: "bg-[var(--site-color-surface)]",
  accentBg: "bg-[var(--site-color-accent)]",

  text: "text-[var(--site-color-text)]",
  muted: "text-[var(--site-color-muted)]",
  accent: "text-[var(--site-color-accent)]",
  onAccent: "text-[var(--site-color-background)]",

  heading: "font-[var(--site-font-heading)]",
  body: "font-[var(--site-font-body)]",

  radius: "rounded-[var(--site-radius)]",
  gap: "gap-[var(--site-spacing)]",
  pad: "p-[var(--site-spacing)]",

  border: "border-[var(--site-color-muted)]",
} as const;
