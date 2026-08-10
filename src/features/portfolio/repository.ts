import type { PortfolioCard } from "@/components/portfolio/portfolio-layout";
import { getHomeGoal, type HomeGoal, isFilteringGoal } from "@/config/home-goals";
import {
  ALL_CATEGORIES,
  ALL_PROJECT_TYPES,
  type CategoryFilter,
  type ProjectTypeFilter,
} from "@/config/portfolio-categories";

/**
 * Portfolio Repository（Plan §7）
 *
 * Phase 1 沒有資料庫，但 Spec §8 明文禁止把作品寫成 hardcoded JSX。
 * 解法是先立介面，2D 接上 Supabase 時只換實作，元件與型別不動。
 *
 * ⚠️ 介面只放「現在真的有呼叫端」的方法（Guardrail 2）。
 * 每新增一個方法，都必須有一個正在使用它的畫面。
 */

/**
 * 列表用的視圖模型。
 *
 * `PortfolioCard` 保持純呈現（版面元件不需要知道分類），
 * 篩選所需的欄位掛在這一層。2D 由 portfolio_projects 映射。
 */
export interface PortfolioListItem extends PortfolioCard {
  categories: string[];
}

export interface PortfolioListFilter {
  category: CategoryFilter;
  projectType: ProjectTypeFilter;
}

export interface PortfolioRepository {
  /** 首頁只顯示 Featured Projects（Spec §8.11），建議 3～6 件 */
  listFeatured(): Promise<PortfolioListItem[]>;
  /** 依 Home Goal 篩選（Spec §6.1 對應表） */
  listByGoal(goal: HomeGoal): Promise<PortfolioListItem[]>;
  /** `/work` 列表（Spec §8.7）。只回傳已發布作品 */
  listPublished(filter: PortfolioListFilter): Promise<PortfolioListItem[]>;
}

/**
 * Goal 篩選的唯一實作，server 與 client 共用。
 *
 * Phase 1 資料在記憶體中，篩選於 client 完成以避免每次切 goal 都等 RSC
 * 回來（Plan §6.2）；repository 也用同一支函式，
 * 確保兩邊的篩選規則不會分岔。
 */
export function filterByGoal<T extends PortfolioListItem>(items: T[], goal: HomeGoal): T[] {
  if (!isFilteringGoal(goal)) return items;

  const wanted = new Set(getHomeGoal(goal).workCategories);
  return items.filter((item) => item.categories.some((category) => wanted.has(category)));
}

/** `/work` 的篩選邏輯。與 goal 篩選分開：兩者的語意不同，不該互相牽動 */
export function filterForList<T extends PortfolioListItem>(
  items: T[],
  filter: PortfolioListFilter,
): T[] {
  return items.filter((item) => {
    const categoryOk =
      filter.category === ALL_CATEGORIES || item.categories.includes(filter.category);
    const typeOk =
      filter.projectType === ALL_PROJECT_TYPES || item.projectType === filter.projectType;
    return categoryOk && typeOk;
  });
}
