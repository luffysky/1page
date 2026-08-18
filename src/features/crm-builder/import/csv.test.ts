import { describe, expect, it } from "vitest";

import { detectDelimiter, parseDelimited, toSheet } from "./csv";

/**
 * CSV 解析（CR-003-5 匯入）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * `split(",")` 會在三件事上安靜地出錯：引號裡的分隔符、引號裡的換行、
 * Excel 的 BOM。錯的樣子不是報錯，是**一列變兩列、一格變兩格**——
 * 使用者只會覺得「資料有點怪」，而查不出原因。
 *
 * 所以每一條都釘一個具體的、真實檔案裡會出現的形狀。
 */

describe("引號", () => {
  it("引號裡的逗號不切開", () => {
    // 地址是最常見的例子：「台北市, 大安區」
    expect(parseDelimited('a,"台北市, 大安區",c')).toEqual([["a", "台北市, 大安區", "c"]]);
  });

  it("引號裡的換行不算換列", () => {
    // 備註欄很常有多行內容
    const rows = parseDelimited('名字,備註\n阿明,"第一行\n第二行"');
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]).toBe("第一行\n第二行");
  });

  it("兩個連續引號是一個字面上的引號", () => {
    expect(parseDelimited('a,"他說""好"",然後走了"')).toEqual([["a", '他說"好",然後走了']]);
  });
});

describe("Excel 存出來的那些細節", () => {
  it("⚠️ BOM 要去掉", () => {
    /*
     * Excel 存 UTF-8 CSV 一定加 BOM。不去掉的話第一個欄名會多一個
     * 看不見的字元——畫面上與「客戶」一模一樣，比對起來卻不相等。
     * 那是最難查的一種。
     *
     * ⚠️ 釘在 parseDelimited，不是 toSheet。
     *
     * 第一版驗的是 toSheet，而它永遠會綠——U+FEFF 在 ECMAScript 裡算空白
     * 字元，toSheet 的 `.trim()` 本來就會吃掉它。把 csv.ts 裡處理 BOM 的
     * 那一整段拿掉，測試照樣十五條全過。驗錯層次了。
     */
    expect(parseDelimited("﻿名字,狀態")).toEqual([["名字", "狀態"]]);
  });

  it("CRLF 換行不會在每一格尾巴留下 \\r", () => {
    const sheet = toSheet("名字,狀態\r\n阿明,還在談\r\n");
    expect(sheet?.rows).toEqual([["阿明", "還在談"]]);
  });

  it("結尾沒有換行也讀得到最後一列", () => {
    expect(parseDelimited("a,b\nc,d")).toHaveLength(2);
  });
});

describe("分隔符", () => {
  it("Tab 分隔（從 Excel 直接複製貼上就是這種）", () => {
    expect(detectDelimiter("名字\t狀態\t金額")).toBe("\t");
  });

  it("分號分隔（歐洲版 Excel 的預設）", () => {
    expect(detectDelimiter("名字;狀態;金額")).toBe(";");
  });

  it("⚠️ 引號裡的分隔符不算票", () => {
    // 不排除的話，「台北市, 大安區」會讓逗號在一份分號檔裡勝出，
    // 整份檔案會被切成錯的格子
    expect(detectDelimiter("名字;地址;備註")).toBe(";");
    expect(detectDelimiter('"a, b, c, d";x')).toBe(";");
  });

  it("只有一欄時退回逗號，不會亂猜", () => {
    expect(detectDelimiter("只有一個欄位")).toBe(",");
  });
});

describe("整理成表", () => {
  it("空白的欄名補成「第 N 欄」", () => {
    // 留空的話，對應介面上會出現一個沒有名字的選項
    const sheet = toSheet("名字,,狀態\n阿明,x,還在談");
    expect(sheet?.headers).toEqual(["名字", "第 2 欄", "狀態"]);
  });

  it("每一列補齊到欄數", () => {
    /*
     * 不補齊的話，後面每一處都要防 undefined——而那種防禦遲早漏一個，
     * 漏掉的那一次會是執行期的 crash。
     */
    const sheet = toSheet("a,b,c\n1\n1,2,3");
    expect(sheet?.rows).toEqual([
      ["1", "", ""],
      ["1", "2", "3"],
    ]);
  });

  it("整列皆空的丟掉，只填一格的留著", () => {
    // 後者是使用者真的有一列只填了一格，那是他的資料
    const sheet = toSheet("a,b\n,\nx,");
    expect(sheet?.rows).toEqual([["x", ""]]);
  });

  it("空檔案回 null，而不是一份空表", () => {
    // 回空表的話，畫面上會出現「0 欄 0 列，看起來像匯入成功了」
    expect(toSheet("")).toBeNull();
    expect(toSheet("   \n  ")).toBeNull();
  });

  it("只有標題列時 rows 是空的，但 headers 讀得到", () => {
    // 使用者可能就是想用一份空表來建結構——那是合理的用法
    const sheet = toSheet("名字,狀態,金額");
    expect(sheet?.headers).toEqual(["名字", "狀態", "金額"]);
    expect(sheet?.rows).toEqual([]);
  });
});
