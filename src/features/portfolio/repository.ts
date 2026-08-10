import type { PortfolioCard } from "@/components/portfolio/portfolio-layout";
import { getHomeGoal, type HomeGoal, isFilteringGoal } from "@/config/home-goals";

/**
 * Portfolio Repository（Plan §7）
 *
 * Phase 1 沒有資料庫，但 Spec §8 明文禁止把作品寫成 hardcoded JSX。
 * 解法是先立介面，Phase 2 只換實作，元件與型別不動。
 *
 * ⚠️ 介面只放「現在真的有呼叫端」的方法（Guardrail 2）。
 * 不加 getBySlug()——`/work/[slug]` 是 Phase 2 的事，目前零呼叫端。
 * 沒有呼叫端的方法是規格債，不是前瞻性。
 */

/**
 * 列表用的視圖模型。
 *
 * `PortfolioCard` 保持純呈現（版面元件不需要知道分類），
 * 篩選所需的 categories 掛在這一層。Phase 2 由 PortfolioProject.categories 映射。
 */
export interface PortfolioListItem extends PortfolioCard {
  categories: string[];
}

export interface PortfolioRepository {
  /** 首頁只顯示 Featured Projects（Spec §8.11），建議 3～6 件 */
  listFeatured(): Promise<PortfolioListItem[]>;
  /** 依 Home Goal 篩選（Spec §6.1 對應表） */
  listByGoal(goal: HomeGoal): Promise<PortfolioListItem[]>;
}

/**
 * Goal 篩選的唯一實作，server 與 client 共用。
 *
 * Phase 1 資料在記憶體中，篩選於 client 完成以避免每次切 goal 都等 RSC
 * 回來（Plan §6.2 的「整頁 reload 感」）；repository 也用同一支函式，
 * 確保兩邊的篩選規則不會分岔。
 */
export function filterByGoal<T extends PortfolioListItem>(items: T[], goal: HomeGoal): T[] {
  if (!isFilteringGoal(goal)) return items;

  const wanted = new Set(getHomeGoal(goal).workCategories);
  return items.filter((item) => item.categories.some((category) => wanted.has(category)));
}
