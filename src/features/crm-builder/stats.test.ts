import { describe, expect, it } from "vitest";

import { startingDefinition } from "./ops";
import { type CrmEntity } from "./schema";
import {
  headlineStats,
  MIN_RECORDS_FOR_CHARTS,
  recentActivity,
  summariseEntity,
  summariseField,
} from "./stats";

/**
 * CRM Dashboard 的統計（CR-003-5）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * Dashboard 最糟的失敗不是壞掉，是**看起來很專業但說錯話**：
 *   - 「沒有人選過這個狀態」被藏起來
 *   - 空白被算成一個值
 *   - 一個從來沒填過的數字欄位顯示平均 0
 *
 * 三件事都不會有任何錯誤訊息，而看的人會拿它做決定。
 */

const entity: CrmEntity = {
  id: "thing-1",
  name: "東西",
  fields: [
    { id: "name", label: "名字", type: "text", required: true, options: [], hint: "" },
    { id: "price", label: "金額", type: "number", required: false, options: [], hint: "" },
    { id: "due", label: "日期", type: "date", required: false, options: [], hint: "" },
    {
      id: "status",
      label: "狀態",
      type: "select",
      required: false,
      options: ["還在談", "已成交", "沒有下文"],
      hint: "",
    },
    { id: "vip", label: "重要", type: "checkbox", required: false, options: [], hint: "" },
  ],
};

const field = (id: string) => entity.fields.find((item) => item.id === id)!;

describe("下拉選單的分布", () => {
  it("⚠️ 定義裡的每一個選項都要出現，即使是 0 筆", () => {
    /*
     * 只列出現過的值的話，「沒有人選過這個」會變成看不見——
     * 而那往往正是最有用的資訊。
     */
    const summary = summariseField(field("status"), [{ status: "還在談" }, { status: "還在談" }]);

    expect(summary.buckets.map((bucket) => bucket.label)).toEqual(["還在談", "已成交", "沒有下文"]);
    expect(summary.buckets.find((bucket) => bucket.label === "已成交")?.count).toBe(0);
  });

  it("定義改過之後留下的舊選項照樣算進去", () => {
    // 不算的話，總數會對不上筆數，而畫面上看不出少了哪些
    const summary = summariseField(field("status"), [{ status: "已經被刪掉的選項" }]);
    const sum = summary.buckets.reduce((acc, bucket) => acc + bucket.count, 0);

    expect(sum).toBe(1);
  });
});

describe("填寫率", () => {
  it("空字串與空白不算填了", () => {
    const summary = summariseField(field("name"), [
      { name: "阿明" },
      { name: "" },
      { name: "   " },
      {},
    ]);

    expect(summary.total).toBe(4);
    expect(summary.filled).toBe(1);
  });

  it("⚠️ checkbox 沒勾也是一個答案，不算沒填", () => {
    /*
     * 算成「沒填」的話，一份大家都沒勾的資料會顯示「填寫率 0%」，
     * 而實際上每一筆都回答了——答案是「否」。
     */
    const summary = summariseField(field("vip"), [{ vip: false }, { vip: true }, {}]);

    expect(summary.filled).toBe(3);
    expect(summary.buckets).toEqual([
      { label: "是", count: 1 },
      { label: "否", count: 2 },
    ]);
  });
});

describe("數字與日期", () => {
  it("總計與平均只算真的有數字的那幾筆", () => {
    // 把沒填的當 0 的話，平均會被拉低，而那個數字看起來完全正常
    const summary = summariseField(field("price"), [{ price: 100 }, { price: 200 }, {}]);

    expect(summary.numeric).toEqual({ sum: 300, average: 150 });
  });

  it("一筆都沒填時不給平均，而不是給 0", () => {
    // 「平均 0」與「還沒有資料」是兩件完全不同的事
    expect(summariseField(field("price"), [{}, {}]).numeric).toBeUndefined();
  });

  it("日期給最早與最晚", () => {
    const summary = summariseField(field("due"), [
      { due: "2026-08-18" },
      { due: "2026-01-02" },
      { due: "" },
    ]);

    expect(summary.range).toEqual({ earliest: "2026-01-02", latest: "2026-08-18" });
  });
});

describe("整個類別", () => {
  it("只算屬於這一類的記錄", () => {
    // 混進別類的話，數字會比使用者在清單上看到的多——
    // 而他不會知道多的是什麼
    const stats = summariseEntity(entity, [
      { entity: "thing-1", data: { name: "a" } },
      { entity: "別的類", data: { name: "b" } },
    ]);

    expect(stats.total).toBe(1);
  });

  it("預設那一份 CRM 的每個欄位都摘要得出來", () => {
    // 反過來問：有沒有哪一種欄位型別會讓摘要炸掉
    const first = startingDefinition().entities[0]!;
    const stats = summariseEntity(first, []);

    expect(stats.fields).toHaveLength(first.fields.length);
    for (const summary of stats.fields) {
      expect(summary.total).toBe(0);
      expect(summary.filled).toBe(0);
    }
  });
});

describe("最近的活動", () => {
  const today = new Date("2026-08-18T10:00:00Z");

  it("每一天都有一格，沒有資料的那天是 0", () => {
    // 少了 0 的那幾天，圖表會把「那天沒動」畫成「那天不存在」
    const days = recentActivity([{ createdAt: "2026-08-18T01:00:00Z" }], today, 3);

    expect(days).toEqual([
      { date: "2026-08-16", count: 0 },
      { date: "2026-08-17", count: 0 },
      { date: "2026-08-18", count: 1 },
    ]);
  });

  it("範圍外的記錄不會變成沒有標籤的柱子", () => {
    const days = recentActivity([{ createdAt: "2020-01-01T00:00:00Z" }], today, 3);

    expect(days).toHaveLength(3);
    expect(days.every((day) => day.count === 0)).toBe(true);
  });
});

describe("頂部的三個數字", () => {
  const today = new Date("2026-08-18T10:00:00Z");

  const records = [
    { entity: "thing-1", createdAt: "2026-08-18T00:00:00Z", data: { status: "還在談" } },
    { entity: "thing-1", createdAt: "2026-08-17T00:00:00Z", data: { status: "還在談" } },
    { entity: "thing-1", createdAt: "2026-01-01T00:00:00Z", data: { status: "已成交" } },
    { entity: "別的類", createdAt: "2026-08-18T00:00:00Z", data: { status: "還在談" } },
  ];

  it("本週只算七天內、而且是這一類的", () => {
    // 混進別類的話，數字會比清單上看到的多——而他不會知道多的是什麼
    const headline = headlineStats(summariseEntity(entity, records), records, today);

    expect(headline.total).toBe(3);
    expect(headline.thisWeek).toBe(2);
  });

  it("最常見的那個從 select 算出來", () => {
    const headline = headlineStats(summariseEntity(entity, records), records, today);

    expect(headline.top).toEqual({ fieldLabel: "狀態", label: "還在談", count: 2 });
  });

  it("⚠️ 沒有 select 欄位時不給「最常見的」，而不是拿文字欄位湊", () => {
    /*
     * 文字欄位的「最多」幾乎一定是 1，那不是洞察是雜訊。
     * 硬湊一個出來，畫面上會出現「最常見的名字：阿明（1）」——
     * 看起來像分析，實際上什麼都沒說。
     */
    const noSelect: CrmEntity = {
      ...entity,
      fields: entity.fields.filter((f) => f.type !== "select"),
    };
    const rows = [{ entity: "thing-1", createdAt: "2026-08-18T00:00:00Z", data: { name: "阿明" } }];

    expect(headlineStats(summariseEntity(noSelect, rows), rows, today).top).toBeUndefined();
  });

  it("有 select 但沒有人選過時也不給", () => {
    const rows = [{ entity: "thing-1", createdAt: "2026-08-18T00:00:00Z", data: { name: "阿明" } }];
    expect(headlineStats(summariseEntity(entity, rows), rows, today).top).toBeUndefined();
  });

  it("門檻是 3——兩筆只能是 50/50 或 100/0，看不出比例", () => {
    expect(MIN_RECORDS_FOR_CHARTS).toBe(3);
  });
});
