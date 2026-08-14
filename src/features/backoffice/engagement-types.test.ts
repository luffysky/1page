import { describe, expect, it } from "vitest";

import { formatMinutes, parseDuration, totalMinutes } from "./engagement-types";

/**
 * 工時的兩個換算（CR-004 / Phase B BF）
 *
 * 這兩個函式是純的，所以可以在單元測試層驗到底——
 * 而它們算錯的表現是「請款金額少了一小時」，畫面上不會有任何異狀。
 */

describe("parseDuration", () => {
  it("收得下人真的會打出來的幾種寫法", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("90m")).toBe(90);
    expect(parseDuration("90 分")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("1.5 小時")).toBe(90);
  });

  it("全形冒號也要收", () => {
    /*
     * 中文輸入法下打冒號，出來的預設是「：」不是「:」。
     * 不收的話使用者會看到「看不懂的長度」而完全不知道差在哪——
     * 那兩個字元長得幾乎一樣。
     */
    expect(parseDuration("2：15")).toBe(135);
  });

  it("看不懂的就說看不懂，不要猜", () => {
    /*
     * ⚠️ 這裡回 null 而不是 0 或 NaN 是關鍵。
     *
     * 猜一個值的話，打錯字的那一次會安靜地記下一個錯的工時，
     * 而那筆資料事後沒有人能發現——它看起來跟正常的一模一樣。
     */
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("一小時半")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("1:75"), "分鐘超過 59 是打錯了").toBeNull();
  });
});

describe("formatMinutes", () => {
  it("不用小數表示小時", () => {
    /*
     * 「3.33 小時」會被讀成 3 小時 33 分。資料庫存分鐘就是為了避開
     * 這個誤會，顯示時換回小數等於把它請回來。
     */
    expect(formatMinutes(200)).toBe("3 小時 20 分");
    expect(formatMinutes(120)).toBe("2 小時");
    expect(formatMinutes(45)).toBe("45 分");
  });
});

describe("totalMinutes", () => {
  it("加起來", () => {
    const entries = [
      { id: "1", workedOn: "2026-08-01", minutes: 90, note: null },
      { id: "2", workedOn: "2026-08-02", minutes: 45, note: null },
    ];
    expect(totalMinutes(entries)).toBe(135);
  });

  it("沒有紀錄就是 0", () => {
    expect(totalMinutes([])).toBe(0);
  });
});
