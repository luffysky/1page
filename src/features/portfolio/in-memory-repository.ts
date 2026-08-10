import type { HomeGoal } from "@/config/home-goals";

import {
  filterByGoal,
  filterForList,
  type PortfolioListFilter,
  type PortfolioListItem,
  type PortfolioRepository,
} from "./repository";

/**
 * Phase 1 / 2B–2C 的暫時實作。2D 接 Supabase 後換掉，元件與型別不動。
 *
 * ⚠️ 每一筆都標為 demo / internal / concept，且 UI 會顯示對應標籤。
 * Spec §8.2、§29：不得將 Demo / Concept 冒充真實客戶案例。
 * 這條在假資料上同樣成立——現在還沒有客戶案，就不能長出客戶案。
 * 因此本檔**沒有任何一筆 `client`**，這是刻意的。
 */
const SEED: PortfolioListItem[] = [
  {
    id: "interior-studio",
    title: "山序設計 / Interior Studio",
    kicker: "Premium Brand Landing Page",
    projectType: "demo",
    href: "/work/interior-studio",
    placeholderTone: "cream",
    categories: ["web", "ui-ux"],
  },
  {
    id: "yipage-identity",
    title: "一頁起家",
    kicker: "Identity / System",
    projectType: "internal",
    href: "/work/yipage-identity",
    placeholderTone: "accent",
    categories: ["brand", "web", "internal-product"],
  },
  {
    id: "ai-website-workshop",
    title: "AI Website Workshop",
    kicker: "Agent + Website Engine",
    projectType: "demo",
    href: "/work/ai-website-workshop",
    placeholderTone: "ink",
    categories: ["ai", "automation", "internal-product"],
  },
  {
    id: "dessert-brand",
    title: "暮光甜室",
    kicker: "Brand Identity / Packaging",
    projectType: "concept",
    href: "/work/dessert-brand",
    placeholderTone: "cream",
    categories: ["brand", "graphic"],
  },
  {
    id: "cafe-social-kit",
    title: "小山咖啡 社群素材組",
    kicker: "Social / Advertising Creative",
    projectType: "concept",
    href: "/work/cafe-social-kit",
    placeholderTone: "accent",
    categories: ["social", "advertising", "content"],
  },
  {
    id: "ops-automation",
    title: "接案流程自動化",
    kicker: "Internal Workflow / Agent",
    projectType: "internal",
    href: "/work/ops-automation",
    placeholderTone: "ink",
    categories: ["automation", "ai", "internal-product"],
  },
];

/** 首頁精選（Spec §8.11 建議 3～6 件） */
const FEATURED_IDS = new Set(["interior-studio", "yipage-identity", "ai-website-workshop"]);

export const inMemoryPortfolioRepository: PortfolioRepository = {
  async listFeatured() {
    return SEED.filter((project) => FEATURED_IDS.has(project.id));
  },

  async listByGoal(goal: HomeGoal) {
    // 篩選後沒有結果時回傳空陣列，由呼叫端決定如何呈現。
    // 不偷偷退回全部——那會讓使用者以為篩選有作用，實際上沒有。
    return filterByGoal(
      SEED.filter((project) => FEATURED_IDS.has(project.id)),
      goal,
    );
  },

  async listPublished(filter: PortfolioListFilter) {
    return filterForList(SEED, filter);
  },
};
