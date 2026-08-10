import { describe, expect, it } from "vitest";

import { supabasePortfolioRepository as repo } from "@/features/portfolio/supabase-repository";

/**
 * Supabase repository 對真實資料庫的整合測試（2D）。
 *
 * 與 `tests/db/rls.test.ts` 分工不同：
 *   rls.test.ts   驗證資料庫的授權邊界（繞過我們的程式碼）
 *   本檔           驗證映射層正確——欄位、關聯、jsonb 解析、排序
 *
 * 需要跑起來的資料庫，因此在 `pnpm test:db` 而非 `pnpm test`。
 */

describe("listFeatured", () => {
  it("回傳精選作品，數量符合 Spec §8.11 的 3～6 件", async () => {
    const featured = await repo.listFeatured();
    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(featured.length).toBeLessThanOrEqual(6);
  });

  it("每筆都有 kicker 與分類——映射沒有漏欄位", async () => {
    for (const item of await repo.listFeatured()) {
      expect(item.kicker, `${item.id} 缺 kicker`).not.toBe("");
      expect(item.categories.length, `${item.id} 缺分類`).toBeGreaterThan(0);
      expect(item.href).toBe(`/work/${item.id}`);
    }
  });

  it("依 sort_order 排序", async () => {
    const featured = await repo.listFeatured();
    expect(featured[0]?.id).toBe("interior-studio");
  });
});

describe("listPublished", () => {
  it("不含草稿——RLS 在資料庫層就擋掉了", async () => {
    const all = await repo.listPublished({ category: "all", projectType: "all" });
    expect(all.some((item) => item.id === "unpublished-draft")).toBe(false);
  });

  it("分類篩選生效，且回傳的分類清單保持完整", async () => {
    const web = await repo.listPublished({ category: "web", projectType: "all" });
    expect(web.length).toBeGreaterThan(0);
    for (const item of web) expect(item.categories).toContain("web");

    // 若用 PostgREST 的 inner join 做篩選，回傳的關聯會只剩符合條件的分類，
    // 卡片上就會少顯示分類。這裡確認沒有發生。
    const interior = web.find((item) => item.id === "interior-studio");
    expect(interior?.categories).toEqual(expect.arrayContaining(["web", "ui-ux"]));
  });

  it("來源類型篩選生效", async () => {
    const demos = await repo.listPublished({ category: "all", projectType: "demo" });
    expect(demos.length).toBeGreaterThan(0);
    for (const item of demos) expect(item.projectType).toBe("demo");
  });

  it("兩個條件同時生效（AND）", async () => {
    const result = await repo.listPublished({ category: "web", projectType: "internal" });
    for (const item of result) {
      expect(item.categories).toContain("web");
      expect(item.projectType).toBe("internal");
    }
  });

  it("沒有任何一筆是 client（Spec §8.2 / §29）", async () => {
    const all = await repo.listPublished({ category: "all", projectType: "all" });
    expect(all.some((item) => item.projectType === "client")).toBe(false);
  });
});

describe("getBySlug", () => {
  it("完整解析 jsonb 的 Case Study", async () => {
    const project = await repo.getBySlug("interior-studio");
    expect(project).not.toBeNull();
    expect(project?.caseStudy.problem).toContain("Instagram");
    expect(project?.caseStudy.result).toContain("概念示範");
  });

  it("解析 services、tags、industry、year", async () => {
    const project = await repo.getBySlug("interior-studio");
    expect(project?.services).toEqual(expect.arrayContaining(["web", "brand-design"]));
    expect(project?.tags).toEqual(expect.arrayContaining(["Landing Page", "Luxury"]));
    expect(project?.industry).toBe("室內設計");
    expect(project?.year).toBe(2026);
  });

  it("解析 AI 揭露", async () => {
    const project = await repo.getBySlug("interior-studio");
    expect(project?.aiDisclosure?.used).toBe(true);
    expect(project?.aiDisclosure?.description).toContain("人工");
  });

  it("空的 jsonb 不會變成假的區塊（Spec §8.10）", async () => {
    const project = await repo.getBySlug("ai-website-workshop");
    expect(project).not.toBeNull();
    expect(project?.caseStudy.problem).toBeUndefined();
    expect(project?.caseStudy.solution).toBeUndefined();
    expect(project?.aiDisclosure).toBeUndefined();
    expect(project?.links).toEqual({
      live: undefined,
      demo: undefined,
      figma: undefined,
      github: undefined,
    });
  });

  it("媒體一律帶有替代文字（Spec §35）", async () => {
    // 種子不含媒體（見 supabase/seed.sql 的說明），此處驗證的是
    // 「若有媒體，一定有替代文字」這條不變量。
    // 完整的上傳→呈現鏈路由 tests/db/media-pipeline.test.ts 端到端驗證。
    const project = await repo.getBySlug("interior-studio");
    for (const media of project?.media ?? []) {
      expect(media.alt.length).toBeGreaterThan(0);
    }
  });

  it("草稿回傳 null，與不存在無法區分", async () => {
    await expect(repo.getBySlug("unpublished-draft")).resolves.toBeNull();
    await expect(repo.getBySlug("does-not-exist-at-all")).resolves.toBeNull();
  });
});

describe("listRelated", () => {
  it("不含自己且尊重 limit", async () => {
    const related = await repo.listRelated("interior-studio", 3);
    expect(related).toHaveLength(3);
    expect(related.some((item) => item.id === "interior-studio")).toBe(false);
  });

  it("同分類優先", async () => {
    const related = await repo.listRelated("interior-studio", 2);
    // interior-studio 屬 web / ui-ux，同屬 web 的應排在前
    expect(related[0]?.categories.some((c) => ["web", "ui-ux"].includes(c))).toBe(true);
  });

  it("未知 slug 回空陣列", async () => {
    await expect(repo.listRelated("nope", 3)).resolves.toEqual([]);
  });
});

describe("listByGoal", () => {
  it("unsure 不篩選", async () => {
    const all = await repo.listByGoal("unsure");
    const featured = await repo.listFeatured();
    expect(all).toHaveLength(featured.length);
  });

  it("ai 只留 ai / automation 分類", async () => {
    const items = await repo.listByGoal("ai");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.categories.some((c) => ["ai", "automation"].includes(c))).toBe(true);
    }
  });
});
