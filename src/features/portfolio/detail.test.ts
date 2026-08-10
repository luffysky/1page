import { describe, expect, it } from "vitest";

import { presentCaseStudySections } from "./detail";
import { ALL_DETAILS } from "./in-memory-detail";
import { inMemoryPortfolioRepository } from "./in-memory-repository";

/**
 * Spec §8.10：
 * > 如果沒有完整 Case Study 資料，只顯示存在的區塊。不要顯示空 Section。
 */

describe("presentCaseStudySections", () => {
  it("只回傳有內容的區塊，並保持 Spec §8.10 的順序", () => {
    const sections = presentCaseStudySections({
      goal: "目標",
      problem: "問題",
      result: "結果",
    });

    expect(sections.map((section) => section.key)).toEqual(["problem", "goal", "result"]);
  });

  it("空字串與純空白視為沒有內容", () => {
    expect(presentCaseStudySections({ problem: "", goal: "   " })).toEqual([]);
  });

  it("完全沒有 Case Study 時回傳空陣列，由頁面整段不渲染", () => {
    expect(presentCaseStudySections({})).toEqual([]);
  });
});

describe("詳細頁種子資料", () => {
  it("刻意包含一筆完全沒有 Case Study 的作品", () => {
    // 全部填滿的種子驗證不了「不顯示空 Section」這條規則，
    // 就像 RLS 的 seed 必須放一筆 draft 才驗得了草稿讀不到。
    const bare = ALL_DETAILS.filter(
      (detail) => presentCaseStudySections(detail.caseStudy).length === 0,
    );
    expect(bare.length).toBeGreaterThan(0);
  });

  it("也包含一筆只有部分區塊的作品", () => {
    const partial = ALL_DETAILS.filter((detail) => {
      const count = presentCaseStudySections(detail.caseStudy).length;
      return count > 0 && count < 5;
    });
    expect(partial.length).toBeGreaterThan(0);
  });

  it("沒有任何一筆是 client（Spec §8.2 / §29）", () => {
    expect(ALL_DETAILS.some((detail) => detail.projectType === "client")).toBe(false);
  });

  it("所有 services 都對應到既有產品線", async () => {
    const { SERVICE_LINES } = await import("@/config/services");
    const ids = new Set(SERVICE_LINES.map((line) => line.id));
    for (const detail of ALL_DETAILS) {
      for (const service of detail.services) {
        expect(ids.has(service), `未知服務：${service}`).toBe(true);
      }
    }
  });
});

describe("repository detail 方法", () => {
  it("getBySlug 找不到時回傳 null，不拋錯", async () => {
    await expect(inMemoryPortfolioRepository.getBySlug("does-not-exist")).resolves.toBeNull();
  });

  it("getBySlug 取得對應作品", async () => {
    const project = await inMemoryPortfolioRepository.getBySlug("interior-studio");
    expect(project?.title).toBe("山序設計 / Interior Studio");
  });

  it("listRelated 不含自己", async () => {
    const related = await inMemoryPortfolioRepository.listRelated("interior-studio", 3);
    expect(related.some((item) => item.id === "interior-studio")).toBe(false);
  });

  it("listRelated 尊重 limit 且同分類優先", async () => {
    const related = await inMemoryPortfolioRepository.listRelated("interior-studio", 2);
    expect(related).toHaveLength(2);
    // interior-studio 屬 web / ui-ux，同屬 web 的 yipage-identity 應排在前
    expect(related[0]?.id).toBe("yipage-identity");
  });

  it("listRelated 對未知 slug 回傳空陣列", async () => {
    await expect(inMemoryPortfolioRepository.listRelated("nope", 3)).resolves.toEqual([]);
  });
});
