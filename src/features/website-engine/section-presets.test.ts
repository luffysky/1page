import { describe, expect, it } from "vitest";

import { implementedSectionTypes, resolveSection } from "./registry";
import { siteSectionSchema } from "./schema";
import { addableSectionTypes, newSection, SECTION_LABELS } from "./section-presets";

/**
 * 新增區塊的預設內容（CR-003-4 第二段）
 *
 * ── 這裡守的是「加出來是一塊空白」 ────────────────────────────
 *
 * 少一個 preset 不會報錯、不會讓測試紅、build 也照過——
 * 使用者按了「新增團隊」，畫面多了一段沒有任何字的東西，
 * 他會以為功能壞了。
 *
 * 又是同一種毛病：一個宣告了但沒有內容的東西。
 * 所以這裡不逐一列「team 要有 preset」，而是反過來問
 * **每一個加得出來的型別，加出來之後是不是真的有東西**。
 */

describe("newSection", () => {
  it("每個可新增的型別都產得出合法且非空的區塊", () => {
    for (const type of addableSectionTypes()) {
      const section = newSection(type, []);

      // 合法：schema 是渲染前唯一的把關點
      const parsed = siteSectionSchema.safeParse(section);
      expect(parsed.success, `${type} 產出的區塊不合法：${parsed.error?.message}`).toBe(true);

      // 非空：加出來要看得出是什麼
      expect(Object.keys(section.content).length, `${type} 加出來是一塊空白`).toBeGreaterThan(0);
    }
  });

  it("每個可新增的型別都找得到元件，而且不是降級來的", () => {
    /*
     * variant 打錯字的話 resolveSection 會退到該型別的預設 variant，
     * 畫面看起來正常，但使用者拿到的不是他選的排版——
     * 而且沒有任何地方會說。
     */
    for (const type of addableSectionTypes()) {
      const resolved = resolveSection(newSection(type, []));

      expect(resolved, `${type} 找不到元件`).not.toBeNull();
      expect(resolved!.fallback, `${type} 的 preset variant 不存在，被降級了`).toBe("none");
    }
  });

  it("每個可新增的型別都有中文名", () => {
    // 工具列與新增選單共用這份。少一個的話按鈕上會出現英文的 type 名稱
    for (const type of addableSectionTypes()) {
      expect(SECTION_LABELS[type], `${type} 沒有中文名`).toBeTruthy();
    }
  });

  it("id 不會與現有的撞號", () => {
    // 撞號會讓 addSection 直接拒絕，而使用者只看到「按了沒反應」
    const first = newSection("faq", []);
    const second = newSection("faq", [first.id]);
    const third = newSection("faq", [first.id, second.id]);

    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    for (const section of [first, second, third]) {
      expect(section.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("可新增的清單就是有元件的那些", () => {
    // 列出一個沒有元件的型別，使用者會加到一塊「這個區塊還在準備中」
    expect(addableSectionTypes()).toEqual(implementedSectionTypes());
  });
});
