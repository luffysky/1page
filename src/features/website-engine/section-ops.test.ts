import { describe, expect, it } from "vitest";

import { buildSiteConfig, draftFromTemplate, TEMPLATES } from "./templates";
import {
  addSection,
  removeSection,
  reorderSections,
  resetSections,
  setSectionVariant,
  updateSectionContent,
} from "./section-ops";
import type { SiteConfig, SiteSection } from "./schema";

/**
 * 6C 出口條件：
 *   「每個操作都可逆或可重設；**失敗的 tool call 不留下半毀的 SiteConfig**。」
 *
 * 後半句是整組測試的重點。這些操作的呼叫端是模型的 tool call，
 * 而模型會傳出不存在的 id、重複的 id、少一半的順序。
 * 失敗留下改到一半的 config，訪客看到的是一個「少了一塊、沒人知道為什麼」
 * 的網站——而且下一個操作會從那個壞掉的狀態繼續往下改。
 */

const base = (): SiteConfig => buildSiteConfig(draftFromTemplate(TEMPLATES[0]!));

const newSection: SiteSection = {
  id: "extra",
  type: "cta",
  variant: "banner",
  content: { title: "要不要聊聊？" },
};

/** 每個失敗案例都用它：原本那份必須一個位元組都沒動 */
function expectUntouched(config: SiteConfig, before: string) {
  expect(JSON.stringify(config)).toBe(before);
}

describe("addSection", () => {
  it("加在最後，或加在指定位置", () => {
    const config = base();
    const appended = addSection(config, newSection);
    expect(appended.ok && appended.config.sections.at(-1)?.id).toBe("extra");

    const inserted = addSection(config, newSection, 0);
    expect(inserted.ok && inserted.config.sections[0]?.id).toBe("extra");
  });

  it("重複的 id 被拒絕，而且原本那份沒有被動到", () => {
    const config = base();
    const before = JSON.stringify(config);

    const result = addSection(config, { ...newSection, id: config.sections[0]!.id });

    expect(result.ok).toBe(false);
    expectUntouched(config, before);
  });

  it("不存在的區塊型別被拒絕", () => {
    // 未知的 type 在渲染時會降級成佔位，畫面上看起來像少了東西。
    // 那個降級是給既有舊資料的安全網，不是給新增用的。
    const config = base();
    const result = addSection(config, { ...newSection, type: "pricing" });

    expect(result.ok).toBe(false);
  });

  it("超出位置範圍會夾到合法區間，不會產生空洞", () => {
    const config = base();
    const result = addSection(config, newSection, 9_999);

    expect(result.ok && result.config.sections.at(-1)?.id).toBe("extra");
  });
});

describe("removeSection", () => {
  it("移除存在的區塊", () => {
    const config = base();
    const target = config.sections[1]!.id;
    const result = removeSection(config, target);

    expect(result.ok && result.config.sections.some((s) => s.id === target)).toBe(false);
    expect(result.ok && result.config.sections).toHaveLength(config.sections.length - 1);
  });

  it("移除不存在的區塊被拒絕，原本那份沒動", () => {
    const config = base();
    const before = JSON.stringify(config);

    const result = removeSection(config, "根本沒有這個");

    expect(result.ok).toBe(false);
    expectUntouched(config, before);
  });
});

describe("reorderSections", () => {
  it("完整排列才接受", () => {
    const config = base();
    const reversed = [...config.sections].map((s) => s.id).reverse();
    const result = reorderSections(config, reversed);

    expect(result.ok && result.config.sections.map((s) => s.id)).toEqual(reversed);
  });

  it("只給一部分會被拒絕", () => {
    // 剩下的要放哪裡就得由我們猜，而猜錯的表現是
    // 「有一塊莫名其妙跑到最後面」。
    const config = base();
    const before = JSON.stringify(config);

    const result = reorderSections(config, [config.sections[0]!.id]);

    expect(result.ok).toBe(false);
    expectUntouched(config, before);
  });

  it("含重複或不存在的 id 會被拒絕", () => {
    const config = base();
    const ids = config.sections.map((s) => s.id);

    expect(reorderSections(config, [ids[0]!, ...ids]).ok).toBe(false);
    expect(
      reorderSections(
        config,
        ids.map((_, i) => (i === 0 ? "沒有這個" : ids[i]!)),
      ).ok,
    ).toBe(false);
  });
});

describe("updateSectionContent", () => {
  it("合併而非取代，沒給的欄位保留", () => {
    // 模型通常只想改標題。要求它把整段內容重打一次，
    // 就是給它一次把別的欄位弄丟的機會。
    const config = base();
    const target = config.sections.find((s) => s.type === "hero")!;
    const original = target.content;

    const result = updateSectionContent(config, target.id, { title: "新標題" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = result.config.sections.find((s) => s.id === target.id)!;
      expect(updated.content.title).toBe("新標題");
      expect(updated.content.subtitle).toBe(original.subtitle);
    }
  });

  it("內容不合 schema 時整個操作失敗，不會寫進去一半", () => {
    const config = base();
    const before = JSON.stringify(config);

    const result = updateSectionContent(config, config.sections[0]!.id, {
      title: "<script>alert(1)</script>",
    });

    expect(result.ok).toBe(false);
    expectUntouched(config, before);
  });
});

describe("setSectionVariant", () => {
  it("換排版，內容不動", () => {
    const config = base();
    const hero = config.sections.find((s) => s.type === "hero")!;
    const result = setSectionVariant(config, hero.id, "centered");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = result.config.sections.find((s) => s.id === hero.id)!;
      expect(updated.variant).toBe("centered");
      expect(updated.content).toEqual(hero.content);
    }
  });

  it("不存在的排版被拒絕，而且告訴呼叫端有哪些可用", () => {
    // 只說「不對」的話，模型會再猜一個。
    const config = base();
    const hero = config.sections.find((s) => s.type === "hero")!;
    const result = setSectionVariant(config, hero.id, "不存在的排法");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("centered");
  });
});

describe("可逆與可重設", () => {
  it("每個操作都是純函式，原本那份永遠不會被就地修改", () => {
    // 「可逆」在這裡是這個意思：呼叫端只要留著原本那份就能還原。
    const config = base();
    const before = JSON.stringify(config);

    addSection(config, newSection);
    removeSection(config, config.sections[0]!.id);
    reorderSections(config, [...config.sections].map((s) => s.id).reverse());
    updateSectionContent(config, config.sections[0]!.id, { title: "改了" });
    setSectionVariant(config, config.sections[0]!.id, "centered");

    expectUntouched(config, before);
  });

  it("reset 回到原始樣子", () => {
    const original = base();
    const changed = addSection(original, newSection);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    const reset = resetSections(changed.config, original);

    expect(reset.ok && reset.config.sections).toEqual(original.sections);
  });

  it("連續多次操作之後，結果仍然是一份合法的 config", () => {
    let config = base();

    for (const step of [
      () => addSection(config, newSection),
      () => setSectionVariant(config, "hero", "minimal"),
      () => updateSectionContent(config, "hero", { title: "連續改" }),
      () => removeSection(config, "extra"),
    ]) {
      const result = step();
      expect(result.ok).toBe(true);
      if (result.ok) config = result.config;
    }

    expect(config.sections.some((s) => s.id === "extra")).toBe(false);
    expect(config.sections.find((s) => s.id === "hero")?.content.title).toBe("連續改");
  });
});
