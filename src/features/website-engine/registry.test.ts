import { describe, expect, it } from "vitest";

import { SECTION_REGISTRY, implementedSectionTypes, variantsFor } from "./registry";
import { SITE_SECTION_TYPES, type SiteSectionType } from "./schema";

/**
 * Section Registry 的完整性
 *
 * ── 這裡守的是哪一種壞掉 ──────────────────────────────────────
 *
 * 這個專案已經被同一種毛病咬過三次：**宣告了一個東西，卻沒有任何地方用到它**。
 * spacingScale 注入了沒人讀、路由做好了沒有入口、分析事件定義了沒有呼叫點。
 * 三次都不會報錯、測試都是綠的，只有畫面悄悄地不對。
 *
 * `SITE_SECTION_TYPES` 是第四個入口：把一個 type 加進 enum 很容易，
 * 忘記加進 SECTION_REGISTRY 也很容易，而結果是那一塊渲染成
 * 「這個區塊還在準備中」——一個訪客看得到、我們看不到的洞。
 *
 * 所以這裡不是逐一列出「faq 要有元件」，而是反過來問：
 * **enum 裡有沒有哪一個沒人實作？** 新增 type 時這條會自己發現。
 */

/**
 * 刻意還沒實作的 type，必須附理由。
 *
 * 清單留空是目標，不是失敗。放在這裡的東西是「知道它缺、且知道為什麼」，
 * 與「忘了」分得開——後者才是這條測試要抓的。
 */
const DEFERRED: Partial<Record<SiteSectionType, string>> = {
  // CR-003-3 之後這裡空了。空的清單是目標，不是失敗——
  // 它代表 enum 裡沒有任何一個 type 是「宣告了但沒人實作」。
};

describe("SECTION_REGISTRY", () => {
  it("enum 裡的每個 type 都有元件（或列為刻意延後並附理由）", () => {
    const missing = SITE_SECTION_TYPES.filter((type) => !SECTION_REGISTRY[type] && !DEFERRED[type]);

    expect(
      missing,
      `這些 type 進了 SITE_SECTION_TYPES 但沒有元件，會渲染成「這個區塊還在準備中」。` +
        `要嘛補上元件，要嘛加進 DEFERRED 並寫下理由。`,
    ).toEqual([]);
  });

  it("延後清單裡的東西真的還沒實作", () => {
    // 反向守衛：實作完了卻忘了從 DEFERRED 拿掉，
    // 這份清單就會開始說謊，下一個人會以為它還沒做。
    for (const type of Object.keys(DEFERRED) as SiteSectionType[]) {
      expect(SECTION_REGISTRY[type], `${type} 已經有元件了，請從 DEFERRED 移除`).toBeUndefined();
    }
  });

  it("每個實作了的 type 至少有一個 variant", () => {
    // 空物件會通過上面那條（`{}` 是 truthy），但 resolveSection
    // 會在 Object.entries(variants)[0]! 上炸掉——那個 ! 是這條測試撐著的。
    for (const type of implementedSectionTypes()) {
      expect(variantsFor(type).length, `${type} 沒有任何 variant`).toBeGreaterThan(0);
    }
  });

  it("registry 的 key 都是合法的 type", () => {
    // 打錯字的 key（例如 "testimonial" 少了 s）不會被型別擋下來，
    // 因為 Partial<Record<...>> 只管值不管有沒有寫錯——
    // 它會安靜地變成一個永遠不會被查到的項目。
    for (const key of Object.keys(SECTION_REGISTRY)) {
      expect(SITE_SECTION_TYPES, `registry 裡有一個不存在的 type：${key}`).toContain(key);
    }
  });
});
