import { describe, expect, it } from "vitest";

import {
  addEntity,
  addField,
  dropFieldOn,
  moveField,
  removeEntity,
  removeField,
  startingDefinition,
  updateField,
} from "./ops";
import { CRM_FIELD_TYPES, CRM_LIMITS, type CrmDefinition, validateCrmDefinition } from "./schema";

/**
 * CRM 定義的操作（CR-003-5）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 每個操作都是純函式，失敗時回原本那份定義。畫面上的表現是
 * 「沒事發生」，而不是一份改到一半的設計——那正是 section-ops
 * 檔頭那條規則，這裡是同一條。
 */

const base = startingDefinition();
const entityId = base.entities[0]!.id;

describe("預設的那一份本身要是合法的", () => {
  it("startingDefinition 過得了自己的 schema", () => {
    // 過不了的話，任何人打開設計器看到的第一個畫面就是錯誤訊息——
    // 而那是一個在單元測試裡一秒就抓得到的問題
    expect(validateCrmDefinition(base).ok).toBe(true);
  });

  it("每一種欄位型別都加得出一份合法的東西", () => {
    /*
     * ⚠️ 反過來問：**清單裡有沒有哪一個型別加出來是不合法的**。
     *
     * 逐一列「select 要有預設選項」的話，下次新增型別時要記得補；
     * 這樣寫的話它自己會發現下一次。
     * （與 section-presets.test.ts 那條是同一招。）
     */
    for (const type of CRM_FIELD_TYPES) {
      const result = addField(base, entityId, type);
      expect(result.ok, `${type} 加不出合法的欄位`).toBe(true);
    }
  });
});

describe("搬動", () => {
  it("鍵盤與拖曳走到同一個結果", () => {
    /*
     * 兩者呼叫的是同一個 moveField（拖曳一步一步走過去）。
     * 這條測試釘住的是那件事本身——如果哪天有人為了「效能」
     * 幫拖曳另外寫一條「移到第 N 位」，這裡就會紅。
     *
     * 不一致的表現是拖曳與鍵盤結果不同，而那正是 WCAG 2.1 §2.5.7
     * 要避免的事：替代路徑不能只是「有」，還要做同一件事。
     */
    const fields = base.entities[0]!.fields;
    const first = fields[0]!.id;
    const third = fields[2]!.id;

    let keyboard: CrmDefinition = base;
    for (let step = 0; step < 2; step += 1) {
      const moved = moveField(keyboard, entityId, first, "down");
      expect(moved.ok).toBe(true);
      if (moved.ok) keyboard = moved.definition;
    }

    const dragged = dropFieldOn(base, entityId, first, third);
    expect(dragged.ok).toBe(true);
    if (dragged.ok) expect(dragged.definition).toEqual(keyboard);
  });

  it("已經在頭尾時是失敗，不是靜靜地什麼都沒做", () => {
    // 回 ok 的話，那一次會進 undo 歷史——按十次下移要按十次復原才回得去
    const last = base.entities[0]!.fields.at(-1)!.id;
    expect(moveField(base, entityId, last, "down").ok).toBe(false);
  });

  it("原本那份定義不會被改到", () => {
    const before = JSON.stringify(base);
    moveField(base, entityId, base.entities[0]!.fields[0]!.id, "down");
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("刪除有下限", () => {
  it("刪不掉最後一個欄位", () => {
    // 零欄位的類別畫面上是一片空白，使用者的第一個反應是「壞了嗎」
    let single = base;
    const fields = base.entities[0]!.fields;
    for (const field of fields.slice(1)) {
      const removed = removeField(single, entityId, field.id);
      if (removed.ok) single = removed.definition;
    }

    expect(single.entities[0]!.fields).toHaveLength(1);
    expect(removeField(single, entityId, single.entities[0]!.fields[0]!.id).ok).toBe(false);
  });

  it("刪不掉最後一類", () => {
    expect(removeEntity(base, entityId).ok).toBe(false);
  });
});

describe("上限由純函式擋，不是由畫面擋", () => {
  it("超過類別上限就失敗", () => {
    let full: CrmDefinition = base;
    for (let n = 0; n < CRM_LIMITS.entities - 1; n += 1) {
      const added = addEntity(full, `第 ${n}`);
      expect(added.ok).toBe(true);
      if (added.ok) full = added.definition;
    }

    expect(full.entities).toHaveLength(CRM_LIMITS.entities);
    expect(addEntity(full, "再一類").ok).toBe(false);
  });

  it("新增出來的 id 不會撞在一起", () => {
    let grown: CrmDefinition = base;
    for (let n = 0; n < 5; n += 1) {
      const added = addField(grown, entityId, "text");
      expect(added.ok).toBe(true);
      if (added.ok) grown = added.definition;
    }

    const ids = grown.entities[0]!.fields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("換型別時選項的處置", () => {
  it("換離 select 就把選項清掉", () => {
    /*
     * 留著的話它們會安靜地跟著這個欄位一輩子：畫面上看不到，
     * 但存進 jsonb、佔在每一次讀寫裡，而且哪天再換回 select
     * 會突然冒出一組使用者早就忘了的選項。
     */
    const selectField = base.entities[0]!.fields.find((field) => field.type === "select")!;
    expect(selectField.options.length).toBeGreaterThan(0);

    const changed = updateField(base, entityId, selectField.id, { type: "text" });
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      const after = changed.definition.entities[0]!.fields.find(
        (field) => field.id === selectField.id,
      )!;
      expect(after.options).toEqual([]);
    }
  });

  it("換成 select 一定會有一個選項", () => {
    // 沒有的話 schema 會擋，而使用者看到的是「換了型別，畫面沒動」
    const textField = base.entities[0]!.fields.find((field) => field.type === "text")!;
    const changed = updateField(base, entityId, textField.id, { type: "select" });

    expect(changed.ok).toBe(true);
    if (changed.ok) {
      const after = changed.definition.entities[0]!.fields.find(
        (field) => field.id === textField.id,
      )!;
      expect(after.options.length).toBeGreaterThan(0);
    }
  });
});
