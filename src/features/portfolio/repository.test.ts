import { describe, expect, it } from "vitest";

import { parseCategoryFilter, parseProjectTypeFilter } from "@/config/portfolio-categories";

import { inMemoryPortfolioRepository } from "./in-memory-repository";
import { filterForList, type PortfolioListItem } from "./repository";

const ITEMS: PortfolioListItem[] = [
  {
    id: "a",
    title: "A",
    kicker: "k",
    projectType: "demo",
    href: "/work/a",
    categories: ["web"],
  },
  {
    id: "b",
    title: "B",
    kicker: "k",
    projectType: "internal",
    href: "/work/b",
    categories: ["ai", "automation"],
  },
  {
    id: "c",
    title: "C",
    kicker: "k",
    projectType: "concept",
    href: "/work/c",
    categories: ["brand", "web"],
  },
];

describe("filterForList（Spec §8.7）", () => {
  it("all × all 回傳全部", () => {
    expect(filterForList(ITEMS, { category: "all", projectType: "all" })).toHaveLength(3);
  });

  it("依分類篩選（作品可屬多個分類）", () => {
    const web = filterForList(ITEMS, { category: "web", projectType: "all" });
    expect(web.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("依來源類型篩選", () => {
    const demo = filterForList(ITEMS, { category: "all", projectType: "demo" });
    expect(demo.map((item) => item.id)).toEqual(["a"]);
  });

  it("兩個條件同時生效（AND 而非 OR）", () => {
    expect(filterForList(ITEMS, { category: "web", projectType: "internal" })).toEqual([]);
    expect(filterForList(ITEMS, { category: "web", projectType: "concept" })).toHaveLength(1);
  });

  it("無結果時回傳空陣列，不退回全部", () => {
    // 偷偷退回全部會讓使用者以為篩選有作用，實際上沒有
    expect(filterForList(ITEMS, { category: "video", projectType: "all" })).toEqual([]);
  });
});

describe("篩選參數解析", () => {
  /*
   * 合法的 slug 由呼叫端傳進來（`/work` 是從資料庫讀的）。
   * 這裡用一組固定的假分類，測的是解析邏輯本身，
   * 不是「目前資料庫裡有哪幾個分類」那種會過期的事實。
   */
  const CATEGORIES = [
    { slug: "web", name: "Web" },
    { slug: "ai", name: "AI" },
  ];

  it("合法分類原樣通過，未知分類退回 all", () => {
    expect(parseCategoryFilter("web", CATEGORIES)).toBe("web");
    expect(parseCategoryFilter("not-a-category", CATEGORIES)).toBe("all");
    expect(parseCategoryFilter(undefined, CATEGORIES)).toBe("all");
    expect(parseCategoryFilter(["ai", "web"], CATEGORIES)).toBe("ai");
    expect(parseCategoryFilter(42, CATEGORIES)).toBe("all");
  });

  it("不在清單裡的分類一律退回 all", () => {
    // 停用一個分類之後，網址上那個參數就不該再篩得動——
    // 否則篩選器上沒有那顆按鈕，網址卻篩得動，結果永遠是零筆
    expect(parseCategoryFilter("web", [{ slug: "ai", name: "AI" }])).toBe("all");
  });

  it("合法來源類型原樣通過，未知退回 all", () => {
    expect(parseProjectTypeFilter("demo")).toBe("demo");
    expect(parseProjectTypeFilter("client")).toBe("client");
    expect(parseProjectTypeFilter("nope")).toBe("all");
    expect(parseProjectTypeFilter(undefined)).toBe("all");
  });
});

describe("in-memory repository", () => {
  it("首頁精選為 3～6 件（Spec §8.11）", async () => {
    const featured = await inMemoryPortfolioRepository.listFeatured();
    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(featured.length).toBeLessThanOrEqual(6);
  });

  it("列表包含精選以外的作品", async () => {
    const all = await inMemoryPortfolioRepository.listPublished({
      category: "all",
      projectType: "all",
    });
    const featured = await inMemoryPortfolioRepository.listFeatured();
    expect(all.length).toBeGreaterThan(featured.length);
  });

  it("假資料中不得出現 client —— Demo 不冒充客戶案例（Spec §8.2 / §29）", async () => {
    const all = await inMemoryPortfolioRepository.listPublished({
      category: "all",
      projectType: "all",
    });
    expect(all.some((item) => item.projectType === "client")).toBe(false);
  });

  it("每件作品的分類都在既有分類清單內", async () => {
    // 掛著一個不存在的分類的話，那件作品在篩選器上永遠找不到
    const categories = await inMemoryPortfolioRepository.listCategories();
    const all = await inMemoryPortfolioRepository.listPublished({
      category: "all",
      projectType: "all",
    });

    for (const item of all) {
      for (const category of item.categories) {
        expect(parseCategoryFilter(category, categories), `未知分類：${category}`).toBe(category);
      }
    }
  });
});
