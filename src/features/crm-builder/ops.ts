import { moveInOrder } from "@/lib/reorder";

import {
  CRM_LIMITS,
  type CrmDefinition,
  type CrmEntity,
  type CrmField,
  type CrmFieldType,
  validateCrmDefinition,
} from "./schema";

/**
 * CRM 定義的操作（CR-003-5）
 *
 * ── 與 section-ops 同一條規則：失敗不留下半毀的定義 ──────────
 *
 * 每個操作都是純函式：吃一份定義，回傳一份新的，或者回傳失敗。
 * 沒有任何一個會就地修改傳進來的那份。
 *
 * 結果一律再過一次 schema。純函式寫對了不代表結果合法——
 * 例如加到第 9 類，型別上完全正確，schema 上超過上限。
 */

export type CrmOpResult = { ok: true; definition: CrmDefinition } | { ok: false; error: string };

function finalize(candidate: CrmDefinition): CrmOpResult {
  const validated = validateCrmDefinition(candidate);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.map((issue) => issue.message).join("；") };
  }
  return { ok: true, definition: validated.definition };
}

/**
 * 從使用者打的名字產一個 id。
 *
 * ⚠️ 中文名字產不出合法 id（規則只收小寫英數），這是預期內的——
 * 所以一律**加上流水號後綴**，而不是「產不出來才加」。
 * 只在衝突時加的話，「客戶」與「客戶資料」會一個有後綴一個沒有，
 * 而那種不一致沒有人解釋得了。
 */
function makeId(prefix: string, existing: readonly string[]): string {
  const base =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "item";

  let n = 1;
  while (existing.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * 每個型別加出來長什麼樣子。
 *
 * ⚠️ select 一定要帶一個預設選項。
 * 沒有的話 schema 會擋（「下拉選單至少要有一個選項」），
 * 表現是「按了新增欄位，畫面上什麼都沒發生」——
 * 這與 section-presets 那條「每個可新增的型別都要有預設內容」是同一件事。
 */
export function defaultFieldFor(type: CrmFieldType, existingIds: readonly string[]): CrmField {
  return {
    id: makeId(type, existingIds),
    label: "新欄位",
    type,
    required: false,
    options: type === "select" ? ["選項一"] : [],
    hint: "",
  };
}

export function emptyEntity(name: string, existingIds: readonly string[]): CrmEntity {
  return {
    id: makeId(name, existingIds),
    name,
    // 一個新類別至少給一個欄位。零欄位的類別存得進去，但畫面上是一片空白，
    // 而使用者第一個反應會是「壞了嗎」
    fields: [defaultFieldFor("text", [])],
  };
}

/** 全新的一份。名字用「我的 CRM」，不是空字串——空的名字在列表上是一條看不見的列 */
export function startingDefinition(): CrmDefinition {
  return {
    name: "我的 CRM",
    entities: [
      {
        id: "contact-1",
        name: "客戶",
        fields: [
          { id: "text-1", label: "名字", type: "text", required: true, options: [], hint: "" },
          {
            id: "text-2",
            label: "聯絡方式",
            type: "text",
            required: false,
            options: [],
            hint: "電話或 Email",
          },
          {
            id: "select-1",
            label: "狀態",
            type: "select",
            required: false,
            options: ["還在談", "已成交", "沒有下文"],
            hint: "",
          },
          { id: "date-1", label: "最後聯絡", type: "date", required: false, options: [], hint: "" },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* 類別                                                                */
/* ------------------------------------------------------------------ */

export function addEntity(definition: CrmDefinition, name: string): CrmOpResult {
  if (definition.entities.length >= CRM_LIMITS.entities) {
    return { ok: false, error: `最多 ${CRM_LIMITS.entities} 類` };
  }

  const entity = emptyEntity(
    name.trim() || "新類別",
    definition.entities.map((item) => item.id),
  );

  return finalize({ ...definition, entities: [...definition.entities, entity] });
}

export function removeEntity(definition: CrmDefinition, entityId: string): CrmOpResult {
  const remaining = definition.entities.filter((entity) => entity.id !== entityId);

  if (remaining.length === definition.entities.length) {
    return { ok: false, error: "找不到這一類" };
  }

  /*
   * 刪到剩零類就停手。
   *
   * 這與編輯器「刪到剩一項停手」是同一個理由的另一面：
   * 一份沒有任何類別的 CRM 打開來是一片空白，而使用者要從
   * 那片空白裡想出「原來要先按新增」——不如不給他刪到那裡。
   */
  if (remaining.length === 0) return { ok: false, error: "至少要留一類" };

  return finalize({ ...definition, entities: remaining });
}

export function renameEntity(
  definition: CrmDefinition,
  entityId: string,
  name: string,
): CrmOpResult {
  return finalize({
    ...definition,
    entities: definition.entities.map((entity) =>
      entity.id === entityId ? { ...entity, name } : entity,
    ),
  });
}

export function moveEntity(
  definition: CrmDefinition,
  entityId: string,
  direction: "up" | "down",
): CrmOpResult {
  const order = moveInOrder(
    definition.entities.map((entity) => entity.id),
    entityId,
    direction,
  );
  if (!order) return { ok: false, error: "已經在最前面或最後面了" };

  const byId = new Map(definition.entities.map((entity) => [entity.id, entity]));
  return finalize({ ...definition, entities: order.map((id) => byId.get(id)!) });
}

/* ------------------------------------------------------------------ */
/* 欄位                                                                */
/* ------------------------------------------------------------------ */

function mapEntity(
  definition: CrmDefinition,
  entityId: string,
  update: (entity: CrmEntity) => CrmEntity,
): CrmDefinition {
  return {
    ...definition,
    entities: definition.entities.map((entity) =>
      entity.id === entityId ? update(entity) : entity,
    ),
  };
}

export function addField(
  definition: CrmDefinition,
  entityId: string,
  type: CrmFieldType,
): CrmOpResult {
  const entity = definition.entities.find((item) => item.id === entityId);
  if (!entity) return { ok: false, error: "找不到這一類" };

  if (entity.fields.length >= CRM_LIMITS.fieldsPerEntity) {
    return { ok: false, error: `一類最多 ${CRM_LIMITS.fieldsPerEntity} 個欄位` };
  }

  const field = defaultFieldFor(
    type,
    entity.fields.map((item) => item.id),
  );

  return finalize(
    mapEntity(definition, entityId, (item) => ({ ...item, fields: [...item.fields, field] })),
  );
}

export function removeField(
  definition: CrmDefinition,
  entityId: string,
  fieldId: string,
): CrmOpResult {
  const entity = definition.entities.find((item) => item.id === entityId);
  if (!entity) return { ok: false, error: "找不到這一類" };

  // 同上：零欄位的類別畫面上是一片空白
  if (entity.fields.length <= 1) return { ok: false, error: "至少要留一個欄位" };

  return finalize(
    mapEntity(definition, entityId, (item) => ({
      ...item,
      fields: item.fields.filter((field) => field.id !== fieldId),
    })),
  );
}

export function updateField(
  definition: CrmDefinition,
  entityId: string,
  fieldId: string,
  patch: Partial<Omit<CrmField, "id">>,
): CrmOpResult {
  return finalize(
    mapEntity(definition, entityId, (entity) => ({
      ...entity,
      fields: entity.fields.map((field) => {
        if (field.id !== fieldId) return field;

        const next = { ...field, ...patch };

        /*
         * 換離 select 就把選項清掉。
         *
         * 留著的話它們會安靜地跟著這個欄位一輩子：畫面上看不到，
         * 但存進 jsonb、佔在每一次讀寫裡，而且哪天再換回 select
         * 會突然冒出一組使用者早就忘了的選項。
         */
        if (next.type !== "select") next.options = [];

        // 換成 select 但還沒有選項時給一個，否則 schema 會擋下來，
        // 而使用者看到的是「換了型別，畫面沒動」
        if (next.type === "select" && next.options.length === 0) next.options = ["選項一"];

        return next;
      }),
    })),
  );
}

export function moveField(
  definition: CrmDefinition,
  entityId: string,
  fieldId: string,
  direction: "up" | "down",
): CrmOpResult {
  const entity = definition.entities.find((item) => item.id === entityId);
  if (!entity) return { ok: false, error: "找不到這一類" };

  const order = moveInOrder(
    entity.fields.map((field) => field.id),
    fieldId,
    direction,
  );
  if (!order) return { ok: false, error: "已經在最前面或最後面了" };

  const byId = new Map(entity.fields.map((field) => [field.id, field]));

  return finalize(
    mapEntity(definition, entityId, (item) => ({
      ...item,
      fields: order.map((id) => byId.get(id)!),
    })),
  );
}

/**
 * 拖曳用：把某個欄位放到另一個欄位的位置。
 *
 * ⚠️ 一步一步呼叫 `moveField` 走過去，而不是另外寫一條「移到第 N 位」。
 * 兩條改順序的路徑遲早會在邊界條件上不一致（最常見的是往下拖時
 * 索引要不要減一），而不一致的表現是拖曳與鍵盤結果不同——
 * 那正是 WCAG 2.1 §2.5.7 要避免的事。
 */
export function dropFieldOn(
  definition: CrmDefinition,
  entityId: string,
  fieldId: string,
  targetId: string,
): CrmOpResult {
  if (fieldId === targetId) return { ok: true, definition };

  const entity = definition.entities.find((item) => item.id === entityId);
  if (!entity) return { ok: false, error: "找不到這一類" };

  const from = entity.fields.findIndex((field) => field.id === fieldId);
  const to = entity.fields.findIndex((field) => field.id === targetId);
  if (from === -1 || to === -1) return { ok: false, error: "找不到這個欄位" };

  const direction = from < to ? "down" : "up";
  let current: CrmDefinition = definition;

  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const moved = moveField(current, entityId, fieldId, direction);
    if (!moved.ok) return moved;
    current = moved.definition;
  }

  return { ok: true, definition: current };
}

export function renameDefinition(definition: CrmDefinition, name: string): CrmOpResult {
  return finalize({ ...definition, name });
}
