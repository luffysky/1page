import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { InvoiceLine, InvoiceRow, InvoiceStatus, Payment } from "./invoice-types";

/**
 * 請款與收款（CR-004 / Phase B BG）
 *
 * ⚠️ 型別與金額計算在 `invoice-types.ts`——這個檔案匯入 `server-only`。
 */
export * from "./invoice-types";

const INVOICE_COLUMNS =
  "id, client_id, engagement_id, number, status, issued_on, due_on, subtotal, tax, total, clients ( name )";

type InvoiceQueryRow = {
  id: string;
  client_id: string;
  engagement_id: string | null;
  number: string;
  status: InvoiceStatus;
  issued_on: string | null;
  due_on: string | null;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  clients: { name: string } | null;
};

/**
 * numeric 從 PostgREST 回來是**字串**。
 *
 * ⚠️ 直接拿去算會變成字串串接：`"1000" + 500` 是 `"1000500"`。
 * 這在請款金額上的表現是一個離譜到看得出來的數字——但在加總裡
 * 它會變成一個只是「有點不對」的數字，而那個不會被發現。
 */
function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInvoice(row: InvoiceQueryRow, paid: number): InvoiceRow {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "（客戶已刪除）",
    engagementId: row.engagement_id,
    number: row.number,
    status: row.status,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    subtotal: toNumber(row.subtotal),
    tax: toNumber(row.tax),
    total: toNumber(row.total),
    paid,
  };
}

/**
 * 每張單收了多少。
 *
 * ⚠️ 一次把所有收款撈回來自己分組，不是每張單各查一次。
 *
 * 每張單各查一次是 N+1：二十張單就是二十一次往返，
 * 而這一頁本來就是「一次看完全部」的頁面。
 */
async function paidByInvoice(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  invoiceIds: string[],
): Promise<Map<string, number>> {
  const paid = new Map<string, number>();
  if (invoiceIds.length === 0) return paid;

  const { data } = await supabase
    .from("payments")
    .select("invoice_id, amount")
    .in("invoice_id", invoiceIds);

  for (const row of data ?? []) {
    const cents = Math.round(toNumber(row.amount) * 100);
    paid.set(row.invoice_id, Math.round((paid.get(row.invoice_id) ?? 0) * 100 + cents) / 100);
  }

  return paid;
}

export async function listInvoices(status?: InvoiceStatus): Promise<InvoiceRow[]> {
  const supabase = await createSupabaseServerClient();

  // `.returns<T>()` 要放最後——它回的 TransformBuilder 上沒有 `.eq()`
  const base = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .order("issued_on", { ascending: false, nullsFirst: false });

  const { data, error } = await (status ? base.eq("status", status) : base).returns<
    InvoiceQueryRow[]
  >();
  if (error) throw new Error(`請款單列表讀取失敗：${error.message}`);

  const rows = data ?? [];
  const paid = await paidByInvoice(
    supabase,
    rows.map((row) => row.id),
  );

  return rows.map((row) => toInvoice(row, paid.get(row.id) ?? 0));
}

export async function listInvoicesForClient(clientId: string): Promise<InvoiceRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("client_id", clientId)
    .order("issued_on", { ascending: false, nullsFirst: false })
    .returns<InvoiceQueryRow[]>();

  const rows = data ?? [];
  const paid = await paidByInvoice(
    supabase,
    rows.map((row) => row.id),
  );

  return rows.map((row) => toInvoice(row, paid.get(row.id) ?? 0));
}

export async function getInvoice(id: string): Promise<{
  invoice: InvoiceRow;
  lines: InvoiceLine[];
  payments: Payment[];
} | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", id)
    .maybeSingle<InvoiceQueryRow>();

  if (!row) return null;

  const [lines, payments] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select("id, description, quantity, unit_price, sort_order")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("payments")
      .select("id, paid_on, amount, method, note")
      .eq("invoice_id", id)
      .order("paid_on", { ascending: false }),
  ]);

  const paidTotal =
    (payments.data ?? []).reduce(
      (total, payment) => total + Math.round(toNumber(payment.amount) * 100),
      0,
    ) / 100;

  return {
    invoice: toInvoice(row, paidTotal),
    lines: (lines.data ?? []).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unit_price),
      sortOrder: line.sort_order,
    })),
    payments: (payments.data ?? []).map((payment) => ({
      id: payment.id,
      paidOn: payment.paid_on,
      amount: toNumber(payment.amount),
      method: payment.method,
      note: payment.note,
    })),
  };
}

/** 已經用過的編號。給 `suggestInvoiceNumber` 算下一個 */
export async function existingInvoiceNumbers(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("invoices").select("number");
  return (data ?? []).map((row) => row.number as string);
}

/**
 * 上面那一排數字。
 *
 * 「開出去多少、收回來多少、還差多少」是這一頁真正要回答的問題——
 * 只顯示筆數的話，五張小單與五張大單看起來一樣。
 */
export async function getInvoiceSummary(): Promise<{
  counts: Record<InvoiceStatus | "all", number>;
  openTotal: number;
  openPaid: number;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase.from("invoices").select("id, status, total");

  const counts = { all: 0, draft: 0, sent: 0, paid: 0, void: 0 };
  let openTotalCents = 0;
  const openIds: string[] = [];

  for (const row of rows ?? []) {
    const status = row.status as InvoiceStatus;
    counts.all += 1;
    counts[status] += 1;

    // 作廢與已收款都不算「還在等的錢」
    if (status === "draft" || status === "sent") {
      openTotalCents += Math.round(toNumber(row.total) * 100);
      openIds.push(row.id);
    }
  }

  const paid = await paidByInvoice(supabase, openIds);
  const openPaidCents = [...paid.values()].reduce(
    (total, amount) => total + Math.round(amount * 100),
    0,
  );

  return {
    counts,
    openTotal: openTotalCents / 100,
    openPaid: openPaidCents / 100,
  };
}
