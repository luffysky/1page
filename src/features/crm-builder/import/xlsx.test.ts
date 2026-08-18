import { describe, expect, it } from "vitest";

import { makeXlsx } from "../../../../tests/support/xlsx-writer";

import { inferSheet } from "./infer";
import { readXlsx } from "./xlsx";

/**
 * 讀 .xlsx（CR-003-5 匯入）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 三件事，每一件錯了都是**安靜地錯**：
 *   1. 字串存在 sharedStrings，儲存格裡只有索引。讀錯的話整份表
 *      會變成一堆 0 1 2 3——看起來像一份真的資料。
 *   2. 空的儲存格不會出現在 XML 裡。照出現順序讀的話，中間留白的
 *      那一列會整列往左移。
 *   3. deflate 與直接存兩種都會出現在同一個檔案裡。
 *
 * fixture 是照 ZIP 規格產的（見 tests/support/xlsx-writer.ts），
 * 不是把讀檔那一端的假設抄一遍。
 */

const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe("readXlsx", () => {
  it("讀得出標題與每一列", async () => {
    const file = await makeXlsx([
      ["名字", "金額", "狀態"],
      ["阿明", "1200", "還在談"],
      ["小華", "800", "已成交"],
    ]);

    const sheet = await readXlsx(buffer(file));

    expect(sheet?.headers).toEqual(["名字", "金額", "狀態"]);
    expect(sheet?.rows).toEqual([
      ["阿明", "1200", "還在談"],
      ["小華", "800", "已成交"],
    ]);
  });

  it("⚠️ 中間留白的儲存格不會讓整列往左移", async () => {
    /*
     * Excel 不會為空格子寫 `<c>`。照出現順序讀的話，
     * 「阿明 / (空) / 還在談」會變成「阿明 / 還在談 / (空)」——
     * 狀態跑到金額那一欄，而兩邊都是文字，畫面上看起來完全正常。
     */
    const file = await makeXlsx([
      ["名字", "金額", "狀態"],
      ["阿明", "", "還在談"],
    ]);

    const sheet = await readXlsx(buffer(file));
    expect(sheet?.rows[0]).toEqual(["阿明", "", "還在談"]);
  });

  it("XML 實體還原得回來", async () => {
    // 「A&B 公司」在 XML 裡是 `A&amp;B 公司`
    const file = await makeXlsx([["公司"], ["A&B <測試> 公司"]]);
    const sheet = await readXlsx(buffer(file));
    expect(sheet?.rows[0]?.[0]).toBe("A&B <測試> 公司");
  });

  it("重複的字串共用同一個索引，讀出來還是各自正確", async () => {
    // sharedStrings 的重點就在這裡：索引算錯的話會整片錯位
    const file = await makeXlsx([["狀態"], ["還在談"], ["已成交"], ["還在談"]]);
    const sheet = await readXlsx(buffer(file));
    expect(sheet?.rows.flat()).toEqual(["還在談", "已成交", "還在談"]);
  });

  it("空白的欄名補成「第 N 欄」，與 CSV 那條路一致", async () => {
    const file = await makeXlsx([
      ["名字", "", "狀態"],
      ["阿明", "x", "還在談"],
    ]);
    const sheet = await readXlsx(buffer(file));
    expect(sheet?.headers).toEqual(["名字", "第 2 欄", "狀態"]);
  });

  it("⚠️ 不是 ZIP 的檔案回 null，不假裝讀得了", async () => {
    /*
     * .xls（2007 以前）是完全不同的格式。硬讀的話會回一份空表，
     * 而畫面上會顯示「匯入成功，0 筆」——那比明確的失敗難懂得多。
     */
    const notAZip = new TextEncoder().encode("這不是 xlsx，是純文字");
    expect(await readXlsx(buffer(notAZip))).toBeNull();
  });

  it("空的活頁簿回 null", async () => {
    expect(await readXlsx(buffer(await makeXlsx([])))).toBeNull();
  });

  it("⚠️ 第 27 欄之後（AA、AB）放得對", async () => {
    /*
     * 欄名是 26 進位。算成「相加」的話 AA 會落到索引 1，
     * 直接蓋掉第 2 欄——損壞發生在使用者看得到的前幾欄，而且完全沒有提示。
     */
    const headers = Array.from({ length: 28 }, (_, index) => `欄${index + 1}`);
    const row = Array.from({ length: 28 }, (_, index) => `值${index + 1}`);
    const sheet = await readXlsx(buffer(await makeXlsx([headers, row])));

    expect(sheet?.headers).toHaveLength(28);
    expect(sheet?.headers[26]).toBe("欄27");
    expect(sheet?.rows[0]?.[27]).toBe("值28");
    expect(sheet?.rows[0]?.[1], "第 27 欄蓋掉了第 2 欄").toBe("值2");
  });

  it("⚠️ 一格裡有粗體（rich text）也要讀到完整的字", async () => {
    /*
     * 只要一格裡有一部分是粗體，Excel 就會把它拆成好幾個 `<t>`。
     * 只讀第一個的話，「王小明（重要客戶）」會變成「王」。
     */
    const file = await makeXlsx([["名字"], ["王小明（重要客戶）"]], { richText: true });
    const sheet = await readXlsx(buffer(file));
    expect(sheet?.rows[0]?.[0]).toBe("王小明（重要客戶）");
  });

  it("讀出來的東西接得上型別猜測", async () => {
    // 兩條匯入路徑（CSV / xlsx）之後共用同一套處理，這一條釘住那件事
    const file = await makeXlsx([
      ["電話", "金額", "最後聯絡"],
      ["0912345678", "1200", "2026-08-18"],
      ["0223456789", "800", "2026-07-01"],
    ]);
    const sheet = await readXlsx(buffer(file));
    expect(inferSheet(sheet!).map((column) => column.type)).toEqual(["text", "number", "date"]);
  });
});
