/**
 * Website Engine 型別（Spec §9 / §10 / §14 / §15）
 *
 * ⚠️ Phase 1 只定義型別，不實作任何 Engine。
 * SiteRenderer、Theme Resolver、Section Registry 全部屬於 Phase 3。
 *
 * 之所以在 1C 就定義，是因為 TemplateExperienceShell 的 props 需要它——
 * 讓殼從第一天就用正確的型別，Phase 3 接上時不必重新定義介面。
 */

/** Spec §15：Preview 支援的裝置 */
export type Device = "desktop" | "tablet" | "mobile";

/** Spec §14：Theme 與 Layout 分離 */
export interface ThemeConfig {
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  radius: string;
  spacingScale: string;
}

/** Spec §10 */
export type SiteSectionType =
  | "hero"
  | "about"
  | "services"
  | "features"
  | "gallery"
  | "portfolio"
  | "pricing"
  | "testimonials"
  | "faq"
  | "cta"
  | "contact"
  | "map"
  | "footer";

export interface SiteSection {
  id: string;
  type: SiteSectionType;
  variant: string;
  content: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/** Spec §9：Agent 只操作這個結構，不修改 React source code */
export interface SiteConfig {
  id: string;
  brand: {
    name: string;
    tagline?: string;
    logo?: string;
    industry?: string;
  };
  theme: ThemeConfig;
  sections: SiteSection[];
  settings: {
    language: string;
  };
}

/**
 * Preview 的 CSS 變數作用域屬性名（Plan §3）。
 *
 * ThemeConfig 必須以 `--site-*` 注入到帶有此屬性的容器上，
 * 絕不可寫進 `:root`——否則被預覽的網站主題會污染官網品牌色，
 * 或反過來繼承官網的色彩。
 *
 * Phase 1 的容器是空殼，但容器本身從現在就存在，
 * 避免 Phase 3 實作時把 scope 邊界忘掉。
 */
export const SITE_SCOPE_ATTRIBUTE = "data-site-scope";
