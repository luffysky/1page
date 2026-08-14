import { describe, expect, it } from "vitest";

import { appendAt, blankLike, getAt, removeAt, setAt } from "./edit-value";

/**
 * 巢狀編輯（CR-004 / Phase B BI）
 *
 * 這幾個函式是整個內容編輯器裡唯一會**默默出錯**的地方：
 * 少複製一層的話，改 A 會連 B 一起改，而畫面上看起來完全正常。
 */

const SAMPLE = {
  section: { kicker: "01 / Goals", title: "你今天想完成什麼？", lead: "" },
  items: [
    { id: "website", label: "我要一個網站", description: "品牌頁。" },
    { id: "brand", label: "我要建立品牌", description: "品牌識別。" },
  ],
};

describe("setAt", () => {
  it("改得到巢狀的欄位", () => {
    const next = setAt(SAMPLE, ["items", 1, "label"], "改過了");
    expect(next.items[1]!.label).toBe("改過了");
  });

  it("不動到原本那份", () => {
    /*
     * ⚠️ 這一條是重點。
     *
     * 直接改原物件的話，React 比對前後參照會發現「沒變」，
     * 於是畫面不更新——使用者打字，字沒有出現在框裡。
     */
    const before = JSON.stringify(SAMPLE);
    setAt(SAMPLE, ["items", 0, "label"], "改過了");
    expect(JSON.stringify(SAMPLE), "原本那份被改到了").toBe(before);
  });

  it("沿路每一層都是新的參照", () => {
    // 只複製最外層的話，裡面那幾層仍然共用——改一份會動到兩份
    const next = setAt(SAMPLE, ["items", 0, "label"], "改過了");

    expect(next).not.toBe(SAMPLE);
    expect(next.items).not.toBe(SAMPLE.items);
    expect(next.items[0]).not.toBe(SAMPLE.items[0]);

    // 沒被碰到的那一項可以共用，複製它只是浪費
    expect(next.items[1]).toBe(SAMPLE.items[1]);
  });
});

describe("getAt", () => {
  it("走得到", () => {
    expect(getAt(SAMPLE, ["section", "title"])).toBe("你今天想完成什麼？");
    expect(getAt(SAMPLE, ["items", 1, "id"])).toBe("brand");
  });

  it("走不到就回 undefined，不要炸掉", () => {
    expect(getAt(SAMPLE, ["section", "title", "nope"])).toBeUndefined();
    expect(getAt(SAMPLE, ["items", 99, "id"])).toBeUndefined();
  });
});

describe("appendAt / removeAt", () => {
  it("加一項", () => {
    const next = appendAt(SAMPLE, ["items"], { id: "x", label: "", description: "" });
    expect(next.items).toHaveLength(3);
    expect(SAMPLE.items, "原本那份不該變長").toHaveLength(2);
  });

  it("刪掉指定的那一項，不是最後一項", () => {
    /*
     * 刪錯項是這種編輯器最容易犯的錯，而且畫面上不會報錯——
     * 使用者按了第一項的刪除，第二項不見了。
     */
    const next = removeAt(SAMPLE, ["items"], 0);
    expect(next.items.map((item) => item.id)).toEqual(["brand"]);
  });

  it("路徑不是陣列時原樣回傳", () => {
    expect(appendAt(SAMPLE, ["section"], "x")).toBe(SAMPLE);
  });
});

describe("blankLike", () => {
  it("照著形狀做一份空的，而不是複製內容", () => {
    /*
     * 複製內容的話，新增出來的是一份一模一樣的東西，
     * 使用者很容易只改了一半就存檔——網站上就出現兩筆幾乎一樣的內容。
     */
    expect(blankLike(SAMPLE.items[0])).toEqual({ id: "", label: "", description: "" });
  });

  it("形狀要留著，不然存檔時 schema 會擋在一個使用者沒看過的欄位上", () => {
    const blank = blankLike({ name: "x", featured: true, count: 3, tags: ["a"] });
    expect(blank).toEqual({ name: "", featured: false, count: 0, tags: [] });
  });
});
