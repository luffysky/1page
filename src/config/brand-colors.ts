/**
 * 品牌色的 TypeScript 鏡像。
 *
 * ── 為什麼需要這份鏡像 ────────────────────────────────────────
 *
 * `src/styles/tokens.css` 是設計數值的唯一來源，但有些地方拿不到 CSS 變數：
 *
 *   PWA manifest       JSON，沒有 CSS 環境
 *   動態產生的圖示      ImageResponse 在伺服器端算圖，不經過瀏覽器
 *   viewport themeColor  meta 標籤的值，必須是字面值
 *
 * 因此這裡是全站唯一允許重複寫下色碼的地方。
 *
 * ⚠️ tokens.css 仍是唯一來源，這份只是鏡像。
 * `brand-colors.test.ts` 會比對兩者，不一致就讓測試失敗——
 * 這與資料庫型別採同一個模式：允許重複，但不允許無聲分歧。
 */

export const BRAND_COLORS = {
  /** --color-brand-bg */
  bg: "#f4efe7",
  /** --color-brand-ink */
  ink: "#141414",
  /** --color-brand-paper */
  paper: "#fffdf9",
  /** --color-brand-accent */
  accent: "#ef3e2f",
} as const;
