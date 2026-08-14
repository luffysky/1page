import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";

/**
 * 作品分類（Spec §8.6 / §8.7）
 *
 * V1 採 Category + Tags 兩層，**不建深層樹**。
 * 分類不可寫死在 UI（Spec §8.1）。
 *
 * ── 這份常數現在的角色是「種子」，不是真相 ────────────────────
 *
 * 真相是 `portfolio_categories` 資料表（見 `PortfolioRepository.listCategories`）。
 * 這裡留下同一份內容，用途只有兩個：
 *   1. `supabase/seed.sql` 灌進資料庫的初始值
 *   2. 沒有設定 Supabase 時的 in-memory 實作
 *
 * ⚠️ 2D 的註解本來就寫著「2D 換上真實資料庫後改由 DB 供應」——
 * 而那件事**從來沒有做**：資料表有 11 筆種子、畫面讀的一直是這個陣列，
 * 兩份內容剛好一樣，沒有任何機制保證它們維持一樣。
 * 現在 `test:db` 有一條在比對兩者，分岔就會紅。
 */

export interface PortfolioCategory {
  slug: string;
  name: string;
}

export const PORTFOLIO_CATEGORIES: readonly PortfolioCategory[] = [
  { slug: "web", name: "Web" },
  { slug: "ui-ux", name: "UI / UX" },
  { slug: "brand", name: "Brand" },
  { slug: "graphic", name: "Graphic" },
  { slug: "content", name: "Content" },
  { slug: "social", name: "Social" },
  { slug: "advertising", name: "Advertising" },
  { slug: "video", name: "Video" },
  { slug: "ai", name: "AI" },
  { slug: "automation", name: "Automation" },
  { slug: "internal-product", name: "Internal Product" },
];

/** 篩選器的「全部」狀態。與 Home Goal 的 unsure 同樣的設計：預設值不進網址 */
export const ALL_CATEGORIES = "all" as const;

export type CategoryFilter = string | typeof ALL_CATEGORIES;

/**
 * 網址參數 → 篩選狀態。
 *
 * ⚠️ 合法的 slug 由呼叫端傳進來，不在這裡讀常數。
 *
 * 讀常數的話會出現一種很難查的狀況：後台停用了某個分類、資料庫不再回傳它，
 * 但因為常數裡還有，這支函式仍然認得那個網址參數——
 * 於是篩選器上沒有那顆按鈕，網址卻篩得動，而結果永遠是零筆。
 */
export function parseCategoryFilter(
  value: unknown,
  categories: readonly PortfolioCategory[],
): CategoryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  const slugs = new Set(categories.map((category) => category.slug));
  return typeof raw === "string" && slugs.has(raw) ? raw : ALL_CATEGORIES;
}

export const ALL_PROJECT_TYPES = "all" as const;

export type ProjectTypeFilter = PortfolioProjectType | typeof ALL_PROJECT_TYPES;

const PROJECT_TYPE_SLUGS = new Set(Object.keys(PROJECT_TYPE_LABELS));

export function parseProjectTypeFilter(value: unknown): ProjectTypeFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && PROJECT_TYPE_SLUGS.has(raw)
    ? (raw as PortfolioProjectType)
    : ALL_PROJECT_TYPES;
}

/**
 * slug → 顯示名稱。找不到就把 slug 原樣顯示。
 *
 * 原樣顯示而不是隱藏：一件作品掛著一個已經被停用的分類時，
 * 藏起來會讓那件作品看起來沒有分類，而「有一個我不認得的分類」
 * 才是當下真正發生的事。
 */
export function getCategoryName(slug: string, categories: readonly PortfolioCategory[]): string {
  return categories.find((category) => category.slug === slug)?.name ?? slug;
}
