import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOME_GOAL,
  getHomeGoal,
  HOME_GOAL_IDS,
  HOME_GOALS,
  isFilteringGoal,
  parseHomeGoal,
} from "./home-goals";

/**
 * Plan §5「非法值與預設」與 §6.1 對應表的契約測試。
 */

describe("parseHomeGoal — URL 參數解析", () => {
  it("合法值原樣通過", () => {
    for (const id of HOME_GOAL_IDS) {
      expect(parseHomeGoal(id)).toBe(id);
    }
  });

  it("無法辨識的值 fallback 為 unsure，不拋錯", () => {
    expect(() => parseHomeGoal("banana")).not.toThrow();
    expect(parseHomeGoal("banana")).toBe("unsure");
  });

  it("缺少參數時為 unsure", () => {
    expect(parseHomeGoal(undefined)).toBe("unsure");
    expect(parseHomeGoal(null)).toBe("unsure");
    expect(parseHomeGoal("")).toBe("unsure");
  });

  it("重複參數（?goal=a&goal=b）取第一個，仍不拋錯", () => {
    expect(parseHomeGoal(["website", "brand"])).toBe("website");
    expect(parseHomeGoal(["banana", "website"])).toBe("unsure");
  });

  it("非字串型別不造成 crash", () => {
    expect(parseHomeGoal(123)).toBe("unsure");
    expect(parseHomeGoal({})).toBe("unsure");
    expect(parseHomeGoal([])).toBe("unsure");
  });
});

describe("Goal 對應表（Plan §6.1）", () => {
  it("六個 goal 全數定義，且無重複 id", () => {
    expect(HOME_GOALS).toHaveLength(6);
    expect(new Set(HOME_GOALS.map((goal) => goal.id)).size).toBe(6);
  });

  it("unsure 不套用任何篩選、不 highlight 服務", () => {
    const unsure = getHomeGoal("unsure");
    expect(unsure.workCategories).toEqual([]);
    expect(unsure.templateCategories).toEqual([]);
    expect(unsure.serviceId).toBeNull();
    expect(isFilteringGoal("unsure")).toBe(false);
  });

  it("unsure 以外的 goal 都會篩選作品並指向一條服務線", () => {
    for (const goal of HOME_GOALS.filter((item) => item.id !== DEFAULT_HOME_GOAL)) {
      expect(goal.workCategories.length).toBeGreaterThan(0);
      expect(goal.serviceId).not.toBeNull();
      expect(isFilteringGoal(goal.id)).toBe(true);
    }
  });

  it("對應關係符合 Plan §6.1 表格", () => {
    expect(getHomeGoal("website").workCategories).toEqual(["web"]);
    expect(getHomeGoal("website").templateCategories).toEqual(["web"]);
    expect(getHomeGoal("marketing").workCategories).toEqual(["content", "social", "advertising"]);
    expect(getHomeGoal("ai").workCategories).toEqual(["ai", "automation"]);
    expect(getHomeGoal("ai").templateCategories).toEqual(["product"]);
    expect(getHomeGoal("unsure").agentInitialIntent).toBe("unclear");
  });

  it("每個 goal 都有 Spec §6 指定的顯示文案", () => {
    const labels = HOME_GOALS.map((goal) => goal.label);
    expect(labels).toEqual([
      "我要一個網站",
      "我要建立品牌",
      "我要開始行銷",
      "我要製作內容",
      "我要導入 AI",
      "我還不知道需要什麼",
    ]);
  });
});
