import { describe, expect, expectTypeOf, it } from "vitest";

import type { PortfolioMediaRole, PortfolioProjectType as DbProjectType } from "@/types/database";

import type { PortfolioMedia } from "./detail";
import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "./project-type";

/**
 * 資料庫 enum 與應用層型別的一致性守衛。
 *
 * `src/types/database.ts` 由 schema 產生（pnpm db:types），
 * `project-type.ts` 是應用層手寫的。兩者若分歧，症狀會很難查：
 * 資料庫多了一個作品類型，程式端不會有任何編譯錯誤，
 * 只會在 UI 上顯示 undefined 標籤——或更糟，整個分支被靜默略過。
 *
 * 這裡讓分歧變成編譯期與測試期的錯誤。
 */

describe("資料庫 enum 與應用層型別一致", () => {
  it("PortfolioProjectType 與資料庫 enum 完全相同", () => {
    expectTypeOf<PortfolioProjectType>().toEqualTypeOf<DbProjectType>();
  });

  it("每個資料庫的作品類型都有對應的顯示名稱（Spec §8.2）", () => {
    // 少一個標籤 = UI 上出現 undefined，或該類型的作品被靜默漏掉
    const labelled = Object.keys(PROJECT_TYPE_LABELS).sort();
    expect(labelled).toEqual(["client", "concept", "demo", "internal"]);
  });

  it("PortfolioMedia.role 與資料庫 enum 完全相同", () => {
    expectTypeOf<PortfolioMedia["role"]>().toEqualTypeOf<PortfolioMediaRole>();
  });
});
