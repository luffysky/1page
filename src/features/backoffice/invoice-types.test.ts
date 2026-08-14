import { describe, expect, it } from "vitest";

import {
  balanceOf,
  invoiceTotals,
  invoiceWarnings,
  isOverdue,
  linesSubtotal,
  paymentsTotal,
  suggestInvoiceNumber,
  type InvoiceLine,
  type Payment,
} from "./invoice-types";

/**
 * 請款的金額計算（CR-004 / Phase B BG）
 *
 * 這幾個函式算錯的表現是「明細加起來與總額差一塊」——
 * 而那種錯誤客戶一定會發現，通常是在最不想被發現的時候。
 */

const lines: InvoiceLine[] = [
  { id: "1", description: "首頁設計", quantity: 1, unitPrice: 30000, sortOrder: 0 },
  { id: "2", description: "內容撰寫", quantity: 3, unitPrice: 0.1, sortOrder: 1 },
];

describe("linesSubtotal / invoiceTotals", () => {
  it("小數不會累積誤差", () => {
    /*
     * ⚠️ 0.1 × 3 用浮點數算是 0.30000000000000004。
     *
     * 直接相加的話，一張有二十個項目的請款單會出現
     * 「明細加起來與總額差一塊」——而那一塊沒有人解釋得了。
     */
    expect(linesSubtotal(lines)).toBe(30000.3);
  });

  it("稅額與總額一起算出來", () => {
    const totals = invoiceTotals(
      [{ id: "1", description: "x", quantity: 1, unitPrice: 1000, sortOrder: 0 }],
      0.05,
    );

    expect(totals).toEqual({ subtotal: 1000, tax: 50, total: 1050 });
  });

  it("沒有稅就是沒有稅，不是 0.00001", () => {
    const totals = invoiceTotals(lines, 0);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(totals.subtotal);
  });

  it("沒有明細時全部是 0", () => {
    expect(invoiceTotals([], 0.05)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe("paymentsTotal / balanceOf", () => {
  const payments: Payment[] = [
    { id: "1", paidOn: "2026-08-01", amount: 10000, method: "匯款", note: null },
    { id: "2", paidOn: "2026-08-15", amount: 5000.5, method: null, note: null },
  ];

  it("分期收款是多筆，加起來", () => {
    expect(paymentsTotal(payments)).toBe(15000.5);
  });

  it("還差多少", () => {
    expect(balanceOf(20000, 15000.5)).toBe(4999.5);
  });

  it("收超過時是負的，不是 0", () => {
    /*
     * ⚠️ 夾到 0 的話，多收的那一筆會安靜地消失，而那是一筆要退還的錢。
     * 「剛好收完」與「多收了」在帳務上是兩件完全不同的事。
     */
    expect(balanceOf(10000, 12000)).toBe(-2000);
  });
});

describe("invoiceWarnings", () => {
  it("標成已收款但還沒收足要說出來", () => {
    const warnings = invoiceWarnings({ status: "paid", total: 10000, paid: 6000 });
    expect(warnings.join("")).toContain("還差");
  });

  it("收足了會提醒可以改狀態，但不會自己改", () => {
    /*
     * 系統不自動翻狀態：什麼時候算收完是人的判斷
     * （可能有匯費、可能談了折讓）。這裡只把不一致指出來。
     */
    const warnings = invoiceWarnings({ status: "sent", total: 10000, paid: 10000 });
    expect(warnings.join("")).toContain("可以改成");
  });

  it("作廢了卻有收款紀錄要說出來", () => {
    const warnings = invoiceWarnings({ status: "void", total: 10000, paid: 3000 });
    expect(warnings.join("")).toContain("作廢");
  });

  it("收超過要說出來", () => {
    expect(invoiceWarnings({ status: "sent", total: 10000, paid: 12000 }).join("")).toContain(
      "收超過",
    );
  });

  it("一切正常就不要囉唆", () => {
    expect(invoiceWarnings({ status: "sent", total: 10000, paid: 4000 })).toEqual([]);
    expect(invoiceWarnings({ status: "paid", total: 10000, paid: 10000 })).toEqual([]);
    expect(invoiceWarnings({ status: "draft", total: 0, paid: 0 })).toEqual([]);
  });
});

describe("isOverdue", () => {
  const base = { status: "sent" as const, dueOn: "2026-08-01", total: 10000, paid: 0 };

  it("過了到期日又沒收完就是逾期", () => {
    expect(isOverdue(base, "2026-08-15")).toBe(true);
  });

  it("收完了就不算逾期，就算日期過了", () => {
    expect(isOverdue({ ...base, paid: 10000 }, "2026-08-15")).toBe(false);
  });

  it("作廢與已收款都不算", () => {
    expect(isOverdue({ ...base, status: "void" }, "2026-08-15")).toBe(false);
    expect(isOverdue({ ...base, status: "paid" }, "2026-08-15")).toBe(false);
  });

  it("沒有到期日就不算——不要對沒約定的事情催款", () => {
    expect(isOverdue({ ...base, dueOn: null }, "2026-08-15")).toBe(false);
  });
});

describe("suggestInvoiceNumber", () => {
  it("接著上一個號碼", () => {
    expect(suggestInvoiceNumber(["INV-2026-0001", "INV-2026-0007"], 2026)).toBe("INV-2026-0008");
  });

  it("換年份就重新開始", () => {
    expect(suggestInvoiceNumber(["INV-2025-0042"], 2026)).toBe("INV-2026-0001");
  });

  it("看不懂的編號不會讓它爆掉", () => {
    /*
     * 手動開過的單可能長成任何樣子。忽略它們就好——
     * 這只是一個建議值，真正的唯一性由資料庫的 unique constraint 擋。
     */
    expect(suggestInvoiceNumber(["自己寫的編號", "INV-2026-0003"], 2026)).toBe("INV-2026-0004");
  });

  it("第一張是 0001", () => {
    expect(suggestInvoiceNumber([], 2026)).toBe("INV-2026-0001");
  });
});
