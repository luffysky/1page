import type { HomeGoal } from "@/config/home-goals";

import { filterByGoal, type PortfolioListItem, type PortfolioRepository } from "./repository";

/**
 * Phase 1 的暫時實作。Phase 2 接 Supabase 後整份換掉，元件與型別不動。
 *
 * ⚠️ 每一筆都標為 demo / internal，且 UI 會顯示對應標籤。
 * Spec §8.2、§29：不得將 Demo / Concept 冒充真實客戶案例。
 * 這條在 Phase 1 的假資料上同樣成立——現在還沒有客戶案，就不能長出客戶案。
 */
const SEED: PortfolioListItem[] = [
  {
    id: "interior-studio",
    title: "山序設計 / Interior Studio",
    kicker: "Premium Brand Landing Page",
    projectType: "demo",
    href: "/work/interior-studio",
    placeholderTone: "cream",
    categories: ["web"],
  },
  {
    id: "yipage-identity",
    title: "一頁起家",
    kicker: "Identity / System",
    projectType: "internal",
    href: "/work/yipage-identity",
    placeholderTone: "accent",
    categories: ["brand", "web"],
  },
  {
    id: "ai-website-workshop",
    title: "AI Website Workshop",
    kicker: "Agent + Website Engine",
    projectType: "demo",
    href: "/work/ai-website-workshop",
    placeholderTone: "ink",
    categories: ["ai", "automation"],
  },
];

export const inMemoryPortfolioRepository: PortfolioRepository = {
  async listFeatured() {
    return SEED;
  },

  async listByGoal(goal: HomeGoal) {
    // 篩選後沒有結果時回傳空陣列，由呼叫端決定如何呈現。
    // 不偷偷退回全部——那會讓使用者以為篩選有作用，實際上沒有。
    return filterByGoal(SEED, goal);
  },
};
