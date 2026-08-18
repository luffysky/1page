import { describe, expect, it } from "vitest";

import { startingDefinition } from "../ops";
import { CRM_LIMITS, crmEntitySchema, validateCrmDefinition } from "../schema";

import { toSheet } from "./csv";
import { attachEntity, convertRows, planFromSheet } from "./build";
import { inferSheet } from "./infer";

/**
 * 匯入計畫（CR-003-5）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 一件事：**匯進來的東西一定要是合法的**，而且合法與否由
 * 正式的 schema 說了算，不是由這裡自己判斷。
 *
 * 還有一件容易做錯的：一列壞掉不能拖垮整份，但也不能安靜地少一列。
 */

const sheetOf = (csv: string) => toSheet(csv)!;

const SAMPLE = [
  "名字,電話,金額,狀態,最後聯絡",
  "阿明,0912345678,1200,還在談,2026/8/18",
  "小華,0223456789,800,已成交,2026-07-01",
  "老王,0987654321,1500,還在談,2026/12/1",
].join("\n");

describe("planFromSheet", () => {
  it("⚠️ 產出來的那一類過得了 crmEntitySchema", () => {
    // 這一條釘的是不會過期的事實：合法與否由正式的 schema 決定
    const sheet = sheetOf(SAMPLE);
    const plan = planFromSheet("客戶", inferSheet(sheet));
    const parsed = crmEntitySchema.safeParse(plan.entity);
    expect(parsed.success, parsed.error?.issues[0]?.message).toBe(true);
  });

  it("欄名變成欄位名字，順序不變", () => {
    const plan = planFromSheet("客戶", inferSheet(sheetOf(SAMPLE)));
    expect(plan.entity.fields.map((field) => field.label)).toEqual([
      "名字",
      "電話",
      "金額",
      "狀態",
      "最後聯絡",
    ]);
  });

  it("⚠️ 每一個欄位都不是必填", () => {
    /*
     * 從資料反推必填是猜不得的。一份剛好每一列都有填的表，
     * 不代表以後每一筆都會有——猜成必填的話，使用者之後手動新增
     * 一筆缺那一格的會被擋下來，而他不知道那條規則是匯入時定的。
     */
    const plan = planFromSheet("客戶", inferSheet(sheetOf(SAMPLE)));
    expect(plan.entity.fields.every((field) => !field.required)).toBe(true);
  });

  it("⚠️ 超過欄位上限的要說出來，不能安靜地少幾欄", () => {
    const many = CRM_LIMITS.fieldsPerEntity + 3;
    const headers = Array.from({ length: many }, (_, index) => `欄${index + 1}`);
    const plan = planFromSheet("多", inferSheet(sheetOf(headers.join(","))));

    expect(plan.entity.fields).toHaveLength(CRM_LIMITS.fieldsPerEntity);
    expect(plan.droppedColumns).toEqual(["欄21", "欄22", "欄23"]);
    // 丟掉的那幾欄在對應表裡是 null，不是指到一個不存在的欄位
    expect(plan.mapping.slice(CRM_LIMITS.fieldsPerEntity).every((id) => id === null)).toBe(true);
  });

  it("類別 id 不會與既有的撞在一起", () => {
    const first = planFromSheet("A", inferSheet(sheetOf("x")), []);
    const second = planFromSheet("B", inferSheet(sheetOf("x")), [first.entity]);
    expect(second.entity.id).not.toBe(first.entity.id);
  });

  it("⚠️ 名字也不會與既有的撞在一起", () => {
    /*
     * 預設的設計本來就有一類叫「客戶」，而匯入時的預設名字是檔名——
     * 「客戶.csv」會直接撞上。id 不撞就存得進去，但畫面上會有兩個
     * 一模一樣的按鈕，而使用者分不出哪個是哪個。
     */
    const plan = planFromSheet("客戶", inferSheet(sheetOf("x")), [
      { id: "contact-1", name: "客戶" },
    ]);
    expect(plan.entity.name).toBe("客戶 2");
  });

  it("沒給名字時給一個看得懂的預設，不是空字串", () => {
    // 空的名字在類別列上是一個按不到的按鈕
    expect(planFromSheet("   ", inferSheet(sheetOf("x"))).entity.name).toBe("匯入的資料");
  });
});

describe("attachEntity", () => {
  it("⚠️ 接上去之後整份定義仍然合法", () => {
    const plan = planFromSheet("客戶B", inferSheet(sheetOf(SAMPLE)), [
      { id: "contact-1", name: "客戶" },
    ]);
    const attached = attachEntity(startingDefinition(), plan.entity);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;

    const validated = validateCrmDefinition(attached.definition);
    expect(validated.ok, validated.ok ? "" : validated.errors[0]?.message).toBe(true);
  });

  it("⚠️ 滿了就擋下來，而且說得出為什麼", () => {
    /*
     * 不擋的話，schema 會在存檔那一刻才把整份退回——
     * 使用者已經匯入完、看到畫面上多了一類，然後存不進去。
     */
    const full = {
      name: "滿的",
      entities: Array.from({ length: CRM_LIMITS.entities }, (_, index) => ({
        id: `e-${index}`,
        name: `第${index}類`,
        fields: [
          {
            id: "f-1",
            label: "名字",
            type: "text" as const,
            required: false,
            options: [],
            hint: "",
          },
        ],
      })),
    };
    const plan = planFromSheet("再一類", inferSheet(sheetOf("x")));
    const attached = attachEntity(full, plan.entity);

    expect(attached.ok).toBe(false);
    if (attached.ok) return;
    expect(attached.error).toContain(String(CRM_LIMITS.entities));
  });
});

describe("convertRows", () => {
  it("每一列都轉得進去，日期已經是 ISO", () => {
    const sheet = sheetOf(SAMPLE);
    const plan = planFromSheet("客戶", inferSheet(sheet));
    const { rows, problems } = convertRows(plan.entity, sheet, plan.mapping);

    expect(problems).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.values["col-5"]).toBe("2026-08-18");
    // 電話開頭的 0 還在
    expect(rows[0]!.values["col-2"]).toBe("0912345678");
  });

  it("⚠️ 一列壞掉不會拖垮其餘，而且指得出是第幾列哪一欄", () => {
    /*
     * 整份退回 → 使用者要在 Excel 裡大海撈針。
     * 安靜跳過 → 他不知道少了一筆，而那是他的資料。
     */
    const sheet = sheetOf(
      ["名字,最後聯絡", "阿明,2026-08-18", "小華,去年八月", "老王,2026-07-01"].join("\n"),
    );
    const columns = inferSheet(sheet);
    // 第 2 欄混了一個看不懂的日期，所以猜出來會是文字——這裡強制當日期，
    // 重現「使用者自己把型別改成日期」之後的情況
    columns[1]!.type = "date";
    const plan = planFromSheet("客戶", columns);

    const { rows, problems } = convertRows(plan.entity, sheet, plan.mapping);

    expect(rows).toHaveLength(2);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.line, "列號要對得上 Excel 裡看到的").toBe(3);
    expect(problems[0]!.message).toContain("最後聯絡");
  });

  it("⚠️ 沒對應到的欄位不會被寫進記錄", () => {
    // recordSchemaFor 是 .strip()，但這裡要的是「一開始就不要放進去」——
    // 依賴 strip 的話，之後任何一次把它改成 passthrough 都會安靜地漏資料
    const sheet = sheetOf(["名字,不要的欄", "阿明,垃圾"].join("\n"));
    const plan = planFromSheet("客戶", inferSheet(sheet));
    const mapping = [plan.mapping[0]!, null];

    const { rows } = convertRows(plan.entity, sheet, mapping);
    expect(Object.keys(rows[0]!.values)).toEqual(["col-1"]);
  });

  it("列號從 2 開始（標題列是第 1 列）", () => {
    const sheet = sheetOf(["名字", "阿明", "小華"].join("\n"));
    const plan = planFromSheet("客戶", inferSheet(sheet));
    const { rows } = convertRows(plan.entity, sheet, plan.mapping);
    expect(rows.map((row) => row.line)).toEqual([2, 3]);
  });
});
