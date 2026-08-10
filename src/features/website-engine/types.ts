/**
 * Website Engine 型別（Spec §9 / §10 / §14 / §15）
 *
 * ⚠️ 型別一律從 `schema.ts` 的 Zod schema 推導（`z.infer`），不手寫。
 *
 * 1C 時這裡是手寫的介面，因為當時還沒有驗證層。3A 有了 schema 之後，
 * 兩份定義並存就會慢慢分歧——而分歧的方向永遠是
 * 「程式以為某欄位可以是任意字串，驗證器其實不允許」這類最難查的。
 * 這正是 2D 在資料庫型別上遇過的問題，同一個教訓不重複犯。
 */

export type {
  SiteConfig,
  SiteSection,
  SiteSectionType,
  ThemeConfig,
  ValidationFailure,
  ValidationResult,
} from "./schema";

export {
  findDuplicateSectionIds,
  siteConfigSchema,
  siteSectionSchema,
  SITE_SECTION_TYPES,
  themeConfigSchema,
  validateSiteConfig,
} from "./schema";

/** Spec §15：Preview 支援的裝置 */
export type Device = "desktop" | "tablet" | "mobile";

/**
 * Preview 的 CSS 變數作用域屬性名（Plan §3）。
 *
 * ThemeConfig 必須以 `--site-*` 注入到帶有此屬性的容器上，
 * 絕不可寫進 `:root`——否則被預覽的網站主題會污染官網品牌色，
 * 或反過來繼承官網的色彩。
 *
 * 1C 就備妥了這個容器（當時是空殼），3B 才真正注入。
 */
export const SITE_SCOPE_ATTRIBUTE = "data-site-scope";
