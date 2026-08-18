import {
  CRM_LIMITS,
  type CrmDefinition,
  type CrmEntity,
  type CrmField,
  recordSchemaFor,
} from "../schema";

import type { Sheet } from "./csv";
import { type ColumnInference, normaliseValue } from "./infer";

/**
 * 把一份表變成「一類 + 幾筆記錄」（CR-003-5 匯入）
 *
 * ── 這一層在做的事 ────────────────────────────────────────────
 *
 * csv/xlsx 負責「切成格子」，infer 負責「猜型別」，這裡負責
 * **把猜出來的東西變成合法的 CrmEntity，並且把每一列轉成記錄**。
 *
 * ── 一列壞掉不能拖垮整份 ──────────────────────────────────────
 *
 * 三百列裡有兩列的日期打錯，正確的做法不是「整份退回」，
 * 也不是「安靜跳過那兩列」——是**匯入其餘的，並且指名那兩列哪裡不對**。
 *
 * 整份退回的話，使用者要在 Excel 裡大海撈針；安靜跳過的話，
 * 他根本不知道少了兩筆，而那兩筆是他的資料。
 */

/** 從欄名產欄位 id。與 ops 的 makeId 一樣一律加流水號 */
function fieldId(index: number): string {
  return `col-${index + 1}`;
}

export interface ImportPlan {
  entity: CrmEntity;
  /**
   * 第幾欄對到哪個欄位 id。null＝這一欄不匯入。
   *
   * 用陣列而不是 Record，因為**欄名可能重複**（真實的表裡「備註」
   * 出現兩次一點都不奇怪），而重複的 key 會安靜地互相蓋掉。
   */
  mapping: (string | null)[];
  /** 超過上限被丟掉的欄名。一定要說出來，不能安靜地少幾欄 */
  droppedColumns: string[];
}

/**
 * 依猜測結果組出一類。
 *
 * ⚠️ 每一個欄位都是 `required: false`。
 *
 * 從資料反推必填是猜不得的：一份剛好每一列都有填的表，
 * 不代表以後每一筆都會有。猜成必填的話，使用者之後手動新增
 * 一筆缺那一格的記錄會被擋下來，而他完全不知道為什麼——
 * 那條規則是匯入時替他決定的。
 */
export function planFromSheet(
  entityName: string,
  columns: readonly ColumnInference[],
  existing: readonly { id: string; name: string }[] = [],
): ImportPlan {
  const kept = columns.slice(0, CRM_LIMITS.fieldsPerEntity);
  const droppedColumns = columns.slice(CRM_LIMITS.fieldsPerEntity).map((column) => column.header);

  const fields: CrmField[] = kept.map((column, index) => ({
    id: fieldId(index),
    label: column.header.slice(0, 60),
    type: column.type,
    required: false,
    options: column.type === "select" ? column.options.slice(0, CRM_LIMITS.optionsPerField) : [],
    hint: "",
  }));

  let id = "imported-1";
  let n = 1;
  while (existing.some((entity) => entity.id === id)) {
    n += 1;
    id = `imported-${n}`;
  }

  /*
   * ⚠️ 名字也要避開既有的。
   *
   * id 不撞就存得進去——但畫面上的類別是一排按鈕，兩個都寫著「客戶」的話
   * 使用者分不出哪個是哪個，而且沒有任何錯誤訊息。
   * （預設的設計本來就有一類叫「客戶」，而匯入時的預設名字是檔名，
   * 所以「客戶.csv」會直接撞上——這是很容易發生的一種，不是特例。）
   */
  const wanted = entityName.trim().slice(0, 60) || "匯入的資料";
  let name = wanted;
  let suffix = 1;
  while (existing.some((entity) => entity.name === name)) {
    suffix += 1;
    name = `${wanted} ${suffix}`.slice(0, 60);
  }

  return {
    entity: { id, name, fields },
    mapping: columns.map((_, index) => (index < kept.length ? fieldId(index) : null)),
    droppedColumns,
  };
}

/**
 * 把一份計畫接到既有的定義上。
 *
 * ⚠️ 走 `addEntity` 之外的路，是因為這裡要的是「連欄位一起加進去」，
 * 而 addEntity 只加一個空的類別。結果一樣要再過一次 schema——
 * 型別對不代表合法（例如加到第 9 類）。
 */
export function attachEntity(
  definition: CrmDefinition,
  entity: CrmEntity,
): { ok: true; definition: CrmDefinition } | { ok: false; error: string } {
  if (definition.entities.length >= CRM_LIMITS.entities) {
    return { ok: false, error: `最多只能有 ${CRM_LIMITS.entities} 類，請先刪掉一類再匯入。` };
  }
  return { ok: true, definition: { ...definition, entities: [...definition.entities, entity] } };
}

export interface ConvertedRow {
  /** 第幾列（含標題列，與使用者在 Excel 裡看到的列號一致） */
  line: number;
  values: Record<string, unknown>;
}

export interface RowProblem {
  line: number;
  /** 已經是給人看的一句話：哪一欄、哪裡不對 */
  message: string;
}

export interface ConvertResult {
  rows: ConvertedRow[];
  problems: RowProblem[];
}

/**
 * 把每一列轉成一筆記錄，並且逐列驗證。
 *
 * ⚠️ 驗證用的是 `recordSchemaFor(entity)` ——與手動新增**同一套**。
 * 匯入自己寫一套驗證的話，兩邊遲早會分岔，而分岔的表現是
 * 「用匯入進得去、用表單填不進去」這種沒有人解釋得了的狀況。
 */
export function convertRows(
  entity: CrmEntity,
  sheet: Sheet,
  mapping: readonly (string | null)[],
): ConvertResult {
  const schema = recordSchemaFor(entity);
  const byId = new Map(entity.fields.map((field) => [field.id, field]));

  const rows: ConvertedRow[] = [];
  const problems: RowProblem[] = [];

  sheet.rows.forEach((cells, index) => {
    // +2：標題列算第 1 列，而使用者在 Excel 裡看到的就是那個列號
    const line = index + 2;

    const values: Record<string, unknown> = {};
    mapping.forEach((targetId, columnIndex) => {
      if (!targetId) return;
      const field = byId.get(targetId);
      if (!field) return;
      values[targetId] = normaliseValue(field.type, cells[columnIndex] ?? "");
    });

    const parsed = schema.safeParse(values);
    if (parsed.success) {
      rows.push({ line, values: parsed.data });
      return;
    }

    const issue = parsed.error.issues[0];
    const label = byId.get(String(issue?.path[0] ?? ""))?.label;
    problems.push({
      line,
      message: label ? `「${label}」${issue?.message ?? "格式不對"}` : "這一列的格式不對",
    });
  });

  return { rows, problems };
}
