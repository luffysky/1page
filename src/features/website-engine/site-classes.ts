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

  /*
   * ⚠️ 字型必須用 `font-(family-name:--x)`，不能寫成 `font-[var(--x)]`。
   *
   * `font-*` 在 Tailwind 裡同時是 font-family 與 font-weight 的前綴，
   * 任意值形式無法判斷你要哪一個，結果是**什麼都不產出**。
   * 語法沒有錯、建置不會失敗、測試也不會紅——畫面上就只是繼承了官網的字體。
   *
   * 這個 bug 從 3C 存在到 4A 才被發現，發現的方式是實際去讀
   * 瀏覽器算出來的 `font-family`（見 theme-scope.spec.ts 的字型那一條）。
   * 在那之前 theme-scope 只驗色彩，而色彩用的是 `bg-[var(--x)]`／`text-[var(--x)]`，
   * 那兩個前綴沒有歧義，所以一直是對的——一組守衛只驗一半的典型。
   */
  heading: "font-(family-name:--site-font-heading)",
  body: "font-(family-name:--site-font-body)",

  radius: "rounded-[var(--site-radius)]",

  /*
   * 版面節奏由 ThemeConfig 的 spacingScale 推導。
   *
   * 原本 Section 直接寫 `py-20`、`p-6` 這類固定值，
   * 結果是 `spacingScale` 這個欄位注入了 `--site-spacing` 之後**沒有任何東西讀它**——
   * 主題裡有一個設定，改了畫面完全不動。那是最難察覺的一種壞掉：
   * 它不會報錯，只會讓「精品一點」跟「更極簡」的疏密看起來一模一樣。
   *
   * 倍數而非固定值：主題調整的是整體疏密，各區塊之間的比例維持不變。
   */
  sectionY: "py-[calc(var(--site-spacing)*5)]",
  sectionYLoose: "py-[calc(var(--site-spacing)*6)]",
  sectionYTight: "py-[calc(var(--site-spacing)*4)]",
  footerY: "py-[calc(var(--site-spacing)*2.5)]",
  cardPad: "p-[calc(var(--site-spacing)*1.5)]",
} as const;
