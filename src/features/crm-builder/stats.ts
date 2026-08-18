import { type CrmEntity, type CrmField } from "./schema";

/**
 * 從使用者自己的定義算出來的統計（CR-003-5）
 *
 * ── 為什麼這件事不能寫死 ──────────────────────────────────────
 *
 * 這個產品的重點是「結構由使用者決定」。所以 dashboard 也必須
 * **照著他的定義長出來**——與記錄表單、與後台的 CMS 編輯器同一招。
 *
 * 寫死「顯示客戶數與成交率」的話，一個拿它記食材庫存的人會看到
 * 兩個永遠是 0 的數字，而那比沒有 dashboard 更糟。
 *
 * ── 每一種欄位能說什麼、不能說什麼 ────────────────────────────
 *
 * ```text
 * 全部       填寫率——有幾筆真的填了這一格
 * select     各選項各幾筆（含 0 筆的選項，見下）
 * checkbox   是 / 否
 * number     總計與平均
 * date       最早與最晚
 * text/textarea  只有填寫率。硬要分組的話會得到一堆各 1 筆的「分類」
 * ```
 *
 * ⚠️ **不編造看起來像分析的東西。** 一份「每個值都出現一次」的長條圖
 * 看起來很專業，實際上什麼都沒說——而看的人要花時間才發現。
 */

export interface FieldSummary {
  field: CrmField;
  /** 有填的筆數 */
  filled: number;
  total: number;
  /** select / checkbox 的分布。其餘型別為空陣列 */
  buckets: { label: string; count: number }[];
  /** number 的總計與平均；其餘為 undefined */
  numeric?: { sum: number; average: number };
  /** date 的最早與最晚（YYYY-MM-DD）；其餘為 undefined */
  range?: { earliest: string; latest: string };
}

export interface EntityStats {
  entity: CrmEntity;
  total: number;
  fields: FieldSummary[];
}

/** 有沒有真的填了東西。`false` 是一個值，不是空白——checkbox 另外處理 */
function hasValue(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string") return raw.trim().length > 0;
  if (typeof raw === "number") return Number.isFinite(raw);
  return true;
}

export function summariseField(
  field: CrmField,
  rows: readonly Record<string, unknown>[],
): FieldSummary {
  const values = rows.map((row) => row[field.id]);
  const total = rows.length;

  /*
   * checkbox 的「填寫率」沒有意義：沒勾也是一個答案。
   * 所以它一律算 100%，分布才是要看的東西。
   */
  const filled =
    field.type === "checkbox" ? total : values.filter((value) => hasValue(value)).length;

  const base: FieldSummary = { field, filled, total, buckets: [] };

  switch (field.type) {
    case "select": {
      /*
       * ⚠️ 定義裡的每一個選項都要出現，**即使是 0 筆**。
       *
       * 只列出現過的值，會讓「沒有人選過這個」變成看不見——
       * 而那往往正是最有用的資訊（例如一個從來沒被選過的狀態）。
       */
      const counts = new Map<string, number>(field.options.map((option) => [option, 0]));

      for (const value of values) {
        if (typeof value !== "string") continue;
        // 定義改過之後，舊記錄可能留著已經被刪掉的選項。算進去但標出來
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      return { ...base, buckets: [...counts].map(([label, count]) => ({ label, count })) };
    }

    case "checkbox": {
      const yes = values.filter((value) => value === true).length;
      return {
        ...base,
        buckets: [
          { label: "是", count: yes },
          { label: "否", count: total - yes },
        ],
      };
    }

    case "number": {
      const numbers = values.filter((value): value is number => typeof value === "number");
      if (numbers.length === 0) return base;

      const sum = numbers.reduce((acc, value) => acc + value, 0);
      return { ...base, numeric: { sum, average: sum / numbers.length } };
    }

    case "date": {
      const dates = values
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      if (dates.length === 0) return base;

      return { ...base, range: { earliest: dates[0]!, latest: dates.at(-1)! } };
    }

    default:
      // text / textarea：只有填寫率。硬要分組會得到一堆各 1 筆的「分類」
      return base;
  }
}

export function summariseEntity(
  entity: CrmEntity,
  records: readonly { entity: string; data: Record<string, unknown> }[],
): EntityStats {
  const rows = records.filter((record) => record.entity === entity.id).map((record) => record.data);

  return {
    entity,
    total: rows.length,
    fields: entity.fields.map((field) => summariseField(field, rows)),
  };
}

/**
 * 最近幾天各有幾筆。
 *
 * ⚠️ 日期用**呼叫端傳進來的今天**，不在這裡叫 `new Date()`。
 * 在這裡叫的話這支函式就不是純的，測試得凍結時間才寫得出來，
 * 而凍結時間的測試很容易變成「在某個時區才會過」。
 */
export function recentActivity(
  records: readonly { createdAt: string }[],
  today: Date,
  days = 14,
): { date: string; count: number }[] {
  const buckets = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }

  for (const record of records) {
    const day = record.createdAt.slice(0, 10);
    // 只算在範圍內的。範圍外的靜靜跳過——不然圖表會多出沒有標籤的柱子
    if (buckets.has(day)) buckets.set(day, buckets.get(day)! + 1);
  }

  return [...buckets].map(([date, count]) => ({ date, count }));
}
