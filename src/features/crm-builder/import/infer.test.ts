import { describe, expect, it } from "vitest";

import { crmFieldSchema, recordSchemaFor, type CrmEntity } from "../schema";

import { toSheet } from "./csv";
import { inferColumn, inferSheet, normaliseValue, optionsForColumn } from "./infer";

/**
 * 型別猜測（CR-003-5 匯入）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 猜錯型別不會報錯。表現是「匯進來之後有一欄怪怪的」——
 * 電話少了開頭的 0、日期整欄匯不進去、一個有兩百個選項的下拉。
 * 三種都要實際看資料才發現得了。
 *
 * 最後一組（來回一趟）是這裡最重要的：猜出來的東西**一定要真的
 * 存得進去**。猜得再漂亮，過不了 `recordSchemaFor` 就是壞的。
 */

describe("猜得出來的", () => {
  it("整欄年月日 → 日期", () => {
    expect(inferColumn("最後聯絡", ["2026-08-18", "2026-07-01"]).type).toBe("date");
  });

  it("Excel 常見的斜線日期也算", () => {
    // 台灣的 Excel 存出來多半是這種
    expect(inferColumn("日期", ["2026/8/18", "2026/12/1"]).type).toBe("date");
  });

  it("是／否 → 勾選", () => {
    expect(inferColumn("已付款", ["是", "否", "是"]).type).toBe("checkbox");
  });

  it("帶貨幣符號與千分位的還是數字", () => {
    // 「NT$ 1,200」在真實的表裡到處都是
    const column = inferColumn("金額", ["NT$ 1,200", "3,500", "80"]);
    expect(column.type).toBe("number");
  });

  it("反覆出現的少數幾個值 → 下拉，選項就是那幾個", () => {
    const column = inferColumn("狀態", ["還在談", "已成交", "還在談", "沒有下文", "已成交"]);
    expect(column.type).toBe("select");
    expect(column.options.sort()).toEqual(["已成交", "沒有下文", "還在談"]);
  });

  it("很長的內容 → 多行文字", () => {
    expect(inferColumn("備註", ["a".repeat(120), "短的"]).type).toBe("textarea");
  });
});

describe("不能猜錯的", () => {
  it("⚠️ 電話不是數字", () => {
    /*
     * 存成 number 之後 0912345678 會變成 912345678，
     * 而它**看起來完全正常**——這是這整個功能裡最難發現的一種錯。
     */
    const column = inferColumn("電話", ["0912345678", "0223456789"]);
    expect(column.type, "電話被猜成數字了，開頭的 0 會不見").toBe("text");
    expect(column.reason).toContain("0");
  });

  it("⚠️ 一整欄都不重複的值不是下拉", () => {
    // 不擋的話會產生一個有幾百個選項的下拉，比文字框還難用
    const names = ["阿明", "小華", "老王", "阿美", "阿強", "小李"];
    expect(inferColumn("名字", names).type).toBe("text");
  });

  it("⚠️ 選項太多的也不是下拉", () => {
    // 上限是 optionsPerField(20)，超過的存不進去
    const values = Array.from({ length: 30 }, (_, i) => `值${i}`).flatMap((v) => [v, v]);
    expect(inferColumn("雜項", values).type).not.toBe("select");
  });

  it("空欄位當文字，而且說得出是因為空的", () => {
    const column = inferColumn("還沒填", ["", "  ", ""]);
    expect(column.type).toBe("text");
    expect(column.filled).toBe(0);
    // 空欄位沒有東西可以弄丟，所以不必特別叫人來看
    expect(column.needsReview).toBe(false);
  });

  it("⚠️ 只有 0 與 1 的欄位要叫人來看", () => {
    // 猜錯的代價是真的：那可能是數量，變成是／否就沒了
    const column = inferColumn("旗標", ["1", "0", "1", "1"]);
    expect(column.needsReview).toBe(true);
    expect(column.reason).toContain("數字");
  });

  it("⚠️ 「請看一下」不能到處都是", () => {
    /*
     * 第一版標的是「不確定」，結果六欄裡有三欄掛著提醒——
     * 而一個永遠亮著的警告等於沒有警告，使用者會一路按到底，
     * 真正該看的那一欄就跟著漏掉。
     *
     * 這一條釘住：安全的猜測（文字、空欄位）不標。
     */
    expect(inferColumn("名字", ["阿明", "小華", "老王"]).needsReview).toBe(false);
    expect(inferColumn("備註", ["隨便打的", "一句話"]).needsReview).toBe(false);
    expect(inferColumn("空的", ["", ""]).needsReview).toBe(false);
    expect(inferColumn("金額", ["1200", "800"]).needsReview).toBe(false);
    expect(inferColumn("日期", ["2026-08-18"]).needsReview).toBe(false);
  });

  it("樣本太少的下拉要叫人來看", () => {
    // 選項是白名單，之後出現一個沒在名單上的值會被擋下來
    expect(inferColumn("狀態", ["A", "B", "A"]).needsReview).toBe(true);
    expect(
      inferColumn("狀態", ["A", "B", "A", "B", "A", "B"]).needsReview,
      "樣本夠紮實就不必再叫人看",
    ).toBe(false);
  });
});

describe("每一欄都說得出理由", () => {
  it("reason 不是空的，samples 看得到實際的值", () => {
    /*
     * 使用者要靠這兩樣決定要不要改。少了理由的話，畫面上就只是
     * 一個下拉選單擺在那裡，而他沒有任何依據。
     */
    const sheet = toSheet("名字,金額,狀態\n阿明,1200,還在談\n小華,800,已成交")!;
    for (const column of inferSheet(sheet)) {
      expect(column.reason.length, `${column.header} 沒有給理由`).toBeGreaterThan(0);
      expect(column.samples.length, `${column.header} 沒有給例子`).toBeGreaterThan(0);
    }
  });
});

describe("⚠️ 來回一趟：猜出來的東西一定存得進去", () => {
  /*
   * 這一條釘的是不會過期的事實——「inferColumn 的輸出過得了 crmFieldSchema，
   * 而 normaliseValue 的輸出過得了 recordSchemaFor」。
   *
   * 前一版的匯入沒有這一段，結果是日期欄猜對了、每一列都匯入失敗，
   * 因為 `2026/8/18` 過不了 `YYYY-MM-DD`。
   */
  const CSV = [
    "名字,電話,金額,狀態,最後聯絡,已付款",
    '阿明,0912345678,"NT$ 1,200",還在談,2026/8/18,是',
    "小華,0223456789,800,已成交,2026-07-01,否",
    "老王,0987654321,1500,還在談,2026/12/1,是",
  ].join("\n");

  const sheet = toSheet(CSV)!;
  const columns = inferSheet(sheet);

  it("每一欄猜出來的定義都過得了 crmFieldSchema", () => {
    for (const [index, column] of columns.entries()) {
      const parsed = crmFieldSchema.safeParse({
        id: `f-${index}`,
        label: column.header,
        type: column.type,
        required: false,
        options: column.options,
        hint: "",
      });
      expect(parsed.success, `${column.header}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("每一列轉完之後都存得進去", () => {
    const entity: CrmEntity = {
      id: "e-1",
      name: "客戶",
      fields: columns.map((column, index) => ({
        id: `f-${index}`,
        label: column.header,
        type: column.type,
        required: false,
        options: column.options,
        hint: "",
      })),
    };
    const schema = recordSchemaFor(entity);

    for (const row of sheet.rows) {
      const values = Object.fromEntries(
        columns.map((column, index) => [
          `f-${index}`,
          normaliseValue(column.type, row[index] ?? ""),
        ]),
      );
      const parsed = schema.safeParse(values);
      expect(parsed.success, `${row[0]}: ${JSON.stringify(parsed.error?.issues[0])}`).toBe(true);
    }
  });

  it("電話那一欄的 0 還在", () => {
    const phone = columns[1]!;
    expect(normaliseValue(phone.type, "0912345678")).toBe("0912345678");
  });

  it("斜線日期轉成了 ISO", () => {
    expect(normaliseValue("date", "2026/8/18")).toBe("2026-08-18");
  });

  it("轉不動的原樣回傳，交給 schema 去擋", () => {
    // 自己吞掉的話，錯誤會從「第 12 列的日期看不懂」變成「莫名其妙少一列」
    expect(normaliseValue("date", "去年八月")).toBe("去年八月");
    expect(normaliseValue("number", "大概一千")).toBe("大概一千");
  });
});

describe("使用者自己改成下拉選單時", () => {
  it("選項就是這一欄出現過的值，重複的只留一個", () => {
    const result = optionsForColumn(["還在談", "已成交", "還在談"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.options).toEqual(["還在談", "已成交"]);
  });

  it("⚠️ 做不出來的時候說得出為什麼", () => {
    /*
     * 這裡回 false 的三種情況，如果安靜地回一個空陣列，
     * 使用者會看到「改了型別，然後整份匯入按不下去」，
     * 而畫面上沒有任何一句話說是哪一欄的問題。
     */
    const empty = optionsForColumn(["", "  "]);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("沒填");

    const tooMany = optionsForColumn(Array.from({ length: 25 }, (_, i) => `值${i}`));
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.error).toContain("25");

    const tooLong = optionsForColumn(["a".repeat(70)]);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toContain("太長");
  });
});
