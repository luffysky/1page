import type { HomeGoal } from "@/config/home-goals";
import { PORTFOLIO_CATEGORIES } from "@/config/portfolio-categories";

import { DETAIL_BY_SLUG } from "./in-memory-detail";
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
    tags: ["landing-page", "luxury", "minimal"],
    services: ["web", "brand-design"],
  },
  {
    id: "yipage-identity",
    title: "一頁起家",
    kicker: "Identity / System",
    projectType: "internal",
    href: "/work/yipage-identity",
    placeholderTone: "accent",
    categories: ["brand", "web", "internal-product"],
    tags: ["design-system", "editorial"],
    services: ["brand-design", "web"],
  },
  {
    id: "ai-website-workshop",
    title: "AI Website Workshop",
    kicker: "Agent + Website Engine",
    projectType: "demo",
    href: "/work/ai-website-workshop",
    placeholderTone: "ink",
    categories: ["ai", "automation", "internal-product"],
    tags: ["agent", "siteconfig"],
    services: ["ai-automation", "web"],
  },
  {
    id: "dessert-brand",
    title: "暮光甜室",
    kicker: "Brand Identity / Packaging",
    projectType: "concept",
    href: "/work/dessert-brand",
    placeholderTone: "cream",
    categories: ["brand", "graphic"],
    tags: ["logo", "packaging"],
    services: ["brand-design"],
  },
  {
    id: "cafe-social-kit",
    title: "小山咖啡 社群素材組",
    kicker: "Social / Advertising Creative",
    projectType: "concept",
    href: "/work/cafe-social-kit",
    placeholderTone: "accent",
    categories: ["social", "advertising", "content"],
    tags: ["campaign", "instagram"],
    services: ["content-growth"],
  },
  {
    id: "ops-automation",
    title: "接案流程自動化",
    kicker: "Internal Workflow / Agent",
    projectType: "internal",
    href: "/work/ops-automation",
    placeholderTone: "ink",
    categories: ["automation", "ai", "internal-product"],
    tags: ["agent", "workflow"],
    services: ["ai-automation"],
  },
];

/** 首頁精選（Spec §8.11 建議 3～6 件） */
const FEATURED_IDS = new Set(["interior-studio", "yipage-identity", "ai-website-workshop"]);

export const inMemoryPortfolioRepository: PortfolioRepository = {
  /*
   * 沒有資料庫時就用程式碼裡那份。
   *
   * ⚠️ 這不是「兩份真相」——它是**同一份種子**：`supabase/seed.sql` 灌進
   * `portfolio_categories` 的內容就是這個常數，而 `test:db` 有一條在比對兩者。
   * 真的分岔的話那條會紅，不會安靜地各走各的。
   */
  async listCategories() {
    return [...PORTFOLIO_CATEGORIES];
  },

  /*
   * 標籤沒有一份程式碼裡的種子（它們只存在資料庫的 seed.sql），
   * 所以這裡從作品自己身上算出來——與 Supabase 實作同樣的規則：
   * 只回「有作品在用的」。
   *
   * 名稱用 slug 湊出可讀的形式（landing-page → Landing Page）。
   * 這只影響沒有資料庫的開發環境，正式環境讀得到真的名稱。
   */
  async listTags() {
    const slugs = [...new Set(SEED.flatMap((project) => project.tags))].sort();
    return slugs.map((slug) => ({
      slug,
      name: slug.replace(/-/g, " ").replace(/\w/g, (char) => char.toUpperCase()),
    }));
  },

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

  async getBySlug(slug: string) {
    return DETAIL_BY_SLUG.get(slug) ?? null;
  },

  async listRelated(slug: string, limit: number) {
    const current = DETAIL_BY_SLUG.get(slug);
    if (!current) return [];

    const categories = new Set(current.categories);

    // 同分類優先；不足時以其餘作品補滿，避免相關作品區時有時無。
    const sameCategory = SEED.filter(
      (item) => item.id !== current.id && item.categories.some((c) => categories.has(c)),
    );
    const others = SEED.filter(
      (item) => item.id !== current.id && !item.categories.some((c) => categories.has(c)),
    );

    return [...sameCategory, ...others].slice(0, limit);
  },
};
