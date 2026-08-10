import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";

/**
 * 作品分類（Spec §8.6 / §8.7）
 *
 * V1 採 Category + Tags 兩層，**不建深層樹**。
 * 分類不可寫死在 UI（Spec §8.1），一律從這裡讀。
 *
 * 這份清單與 supabase/migrations 的 portfolio_categories 種子資料同源；
 * 2D 換上真實資料庫後改由 DB 供應，此檔退為型別與預設值來源。
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

const CATEGORY_SLUGS = new Set(PORTFOLIO_CATEGORIES.map((category) => category.slug));

/** 篩選器的「全部」狀態。與 Home Goal 的 unsure 同樣的設計：預設值不進網址 */
export const ALL_CATEGORIES = "all" as const;

export type CategoryFilter = string | typeof ALL_CATEGORIES;

export function parseCategoryFilter(value: unknown): CategoryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && CATEGORY_SLUGS.has(raw) ? raw : ALL_CATEGORIES;
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

export function getCategoryName(slug: string): string {
  return PORTFOLIO_CATEGORIES.find((category) => category.slug === slug)?.name ?? slug;
}
