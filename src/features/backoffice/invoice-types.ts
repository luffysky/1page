/**
 * 請款與收款的型別與金額計算（CR-004 / Phase B BG）
 *
 * ── 先講清楚這一塊**不做**什麼 ────────────────────────────────
 *
 * ⚠️ 這個專案沒有任何金流串接，這一段也不做。
 *
 * `invoices` 與 `payments` 是**記帳**，不是收錢：自己開發票、自己對帳，
 * 系統只把「誰欠多少、收了沒」記下來。
 *
 * 做成看起來會自動收錢的樣子，比沒有更糟——那是 SMTP 那件事的
 * 同一個教訓（做一顆按了會 422 的註冊按鈕，比沒有那顆按鈕更糟）。
 * 所以畫面上不會有「立即付款」，只有「記一筆收款」。
 *
 * ── 錢一律用整數的「分」算 ────────────────────────────────────
 *
 * `0.1 + 0.2 !== 0.3` 在請款單上的表現是「明細加起來與總額差一塊」，
 * 而那種錯誤客戶一定會發現。資料庫那側用 numeric，
 * JavaScript 這側沒有 decimal 型別，所以自己轉成整數算。
 */

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

/** 順序有意義：畫面上照這個排 */
export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "草稿",
  sent: "已寄出",
  paid: "已收款",
  void: "作廢",
};

/** 還在等錢的狀態。「手上還有多少沒收」用這個算 */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent"];

export interface InvoiceRow {
  id: string;
  clientId: string;
  clientName: string;
  engagementId: string | null;
  number: string;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  subtotal: number;
  tax: number;
  total: number;
  /** 已收多少。由 payments 加總而來，不是欄位 */
  paid: number;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

export interface Payment {
  id: string;
  paidOn: string;
  amount: number;
  method: string | null;
  note: string | null;
}

const toCents = (value: number) => Math.round(value * 100);

/** 明細小計。整數的分，最後才除回來 */
export function linesSubtotal(lines: readonly InvoiceLine[]): number {
  const cents = lines.reduce(
    (total, line) => total + Math.round(line.quantity * line.unitPrice * 100),
    0,
  );
  return cents / 100;
}

/**
 * 依稅率算出小計、稅額與總額。
 *
 * ⚠️ 回傳三個值而不是只回總額：**三個都要存進資料庫**。
 *
 * 只存總額的話，之後看到一張舊單只知道「收多少」，
 * 不知道當時的稅率是多少——而那正是對帳時要查的東西。
 */
export function invoiceTotals(
  lines: readonly InvoiceLine[],
  taxRate: number,
): { subtotal: number; tax: number; total: number } {
  const subtotalCents = lines.reduce(
    (total, line) => total + Math.round(line.quantity * line.unitPrice * 100),
    0,
  );

  const taxCents = Math.round(subtotalCents * taxRate);

  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

export function paymentsTotal(payments: readonly Payment[]): number {
  return payments.reduce((total, payment) => total + toCents(payment.amount), 0) / 100;
}

/**
 * 還差多少。
 *
 * ⚠️ 可能是負的——收超過了。
 *
 * 夾到 0 的話，多收的那一筆會安靜地消失，而那是一筆要退還的錢。
 * 帳務上「剛好收完」與「多收了」是兩件完全不同的事。
 */
export function balanceOf(total: number, paid: number): number {
  return (toCents(total) - toCents(paid)) / 100;
}

/**
 * 狀態與收款對不對得起來。
 *
 * ⚠️ 這裡**不會自動改狀態**，只回報看到的事實。
 *
 * 收了一半就把 invoice 改成 paid 的話，帳就對不起來了——
 * 而「還差多少」是這整張表存在的理由。
 * 什麼時候算收完是人的判斷（可能有匯費、可能談了折讓），
 * 系統只負責把不一致指出來。
 */
export function invoiceWarnings(invoice: {
  status: InvoiceStatus;
  total: number;
  paid: number;
}): string[] {
  const warnings: string[] = [];
  const balance = balanceOf(invoice.total, invoice.paid);

  if (invoice.status === "void" && invoice.paid > 0) {
    warnings.push("這張已經作廢，但收款紀錄還在。要退款的話那是另一筆，不要把紀錄刪掉。");
  }

  if (invoice.status === "paid" && balance > 0) {
    warnings.push(`標成已收款，但還差 ${balance.toLocaleString("zh-TW")}。`);
  }

  if (invoice.status !== "paid" && invoice.status !== "void" && balance <= 0 && invoice.paid > 0) {
    warnings.push("收款已經收足了，可以改成「已收款」。");
  }

  if (balance < 0) {
    warnings.push(`收超過了 ${Math.abs(balance).toLocaleString("zh-TW")}，可能要退還。`);
  }

  return warnings;
}

/** 逾期：有到期日、還沒收完、而且已經過了 */
export function isOverdue(
  invoice: { status: InvoiceStatus; dueOn: string | null; total: number; paid: number },
  today: string,
): boolean {
  if (invoice.status === "void" || invoice.status === "paid") return false;
  if (!invoice.dueOn) return false;
  if (balanceOf(invoice.total, invoice.paid) <= 0) return false;
  return invoice.dueOn < today;
}

export function formatMoney(amount: number, currency = "TWD"): string {
  return `${currency} ${amount.toLocaleString("zh-TW", { minimumFractionDigits: 0 })}`;
}

/**
 * 下一個請款單編號。
 *
 * `INV-2026-0007` 這種形式：年份讓它自己分組，流水號補零讓它排得對。
 *
 * ⚠️ 這只是一個**建議值**，不是保證。
 *
 * 真正的唯一性由資料庫的 unique constraint 擋——兩個人同時開單時
 * 這裡算出來的會是同一個號碼，而那時要看到的是一句人話，
 * 不是一個資料庫錯誤。重複的請款單編號是會計事故，不是 UI 問題。
 */
export function suggestInvoiceNumber(existing: readonly string[], year: number): string {
  const prefix = `INV-${year}-`;

  const highest = existing
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
