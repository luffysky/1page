import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DealItem, DealRow, DealStage } from "./deal-types";

/**
 * 報價與成交（CR-004 / Phase B BE）
 *
 * ⚠️ 型別與標籤在 `deal-types.ts`——這個檔案匯入 `server-only`。
 */
export * from "./deal-types";

const DEAL_COLUMNS =
  "id, client_id, title, stage, amount, currency, expected_close, lost_reason, updated_at, clients ( name )";

type DealQueryRow = {
  id: string;
  client_id: string;
  title: string;
  stage: DealStage;
  amount: string | number | null;
  currency: string;
  expected_close: string | null;
  lost_reason: string | null;
  updated_at: string;
  clients: { name: string } | null;
};

/**
 * numeric 從 PostgREST 回來是**字串**。
 *
 * ⚠️ 直接拿去算會變成字串串接：`"1000" + 500` 是 `"1000500"`。
 * numeric 之所以回字串，是因為它的精度超過 JavaScript 的 number——
 * 轉回 number 在這個金額規模下是安全的，但一定要明確轉。
 */
function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDeal(row: DealQueryRow): DealRow {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "（客戶已刪除）",
    title: row.title,
    stage: row.stage,
    amount: toNumber(row.amount),
    currency: row.currency,
    expectedClose: row.expected_close,
    lostReason: row.lost_reason,
    updatedAt: row.updated_at,
  };
}

export async function listDeals(stage?: DealStage): Promise<DealRow[]> {
  const supabase = await createSupabaseServerClient();

  /*
   * `.returns<T>()` 要放在最後。
   *
   * 它回傳的是 TransformBuilder，上面已經沒有 `.eq()` 了——
   * 先呼叫的話 TypeScript 會直接紅，而那正是型別想擋的事：
   * 「已經定型的查詢不該再加條件」。
   */
  const base = supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .order("updated_at", { ascending: false });

  const { data, error } = await (stage ? base.eq("stage", stage) : base).returns<DealQueryRow[]>();
  if (error) throw new Error(`報價列表讀取失敗：${error.message}`);

  return (data ?? []).map(toDeal);
}

export async function listDealsForClient(clientId: string): Promise<DealRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .returns<DealQueryRow[]>();

  return (data ?? []).map(toDeal);
}

export async function getDeal(id: string): Promise<{
  deal: DealRow;
  items: DealItem[];
  notes: { id: string; body: string; createdAt: string }[];
  activities: { id: string; kind: string; detail: Record<string, unknown>; createdAt: string }[];
} | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("id", id)
    .maybeSingle<DealQueryRow>();

  if (!row) return null;

  const [items, notes, activities] = await Promise.all([
    supabase
      .from("deal_items")
      .select("id, service_id, description, quantity, unit_price, sort_order")
      .eq("deal_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("subject_type", "deal")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("activities")
      .select("id, kind, detail, created_at")
      .eq("subject_type", "deal")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    deal: toDeal(row),
    items: (items.data ?? []).map((item) => ({
      id: item.id,
      serviceId: item.service_id,
      description: item.description,
      quantity: toNumber(item.quantity) ?? 1,
      unitPrice: toNumber(item.unit_price) ?? 0,
      sortOrder: item.sort_order,
    })),
    notes: (notes.data ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
    })),
    activities: (activities.data ?? []).map((activity) => ({
      id: activity.id,
      kind: activity.kind,
      detail: (activity.detail ?? {}) as Record<string, unknown>,
      createdAt: activity.created_at,
    })),
  };
}

/**
 * 各階段的數量與金額。
 *
 * 「還沒成交的加起來有多少」是這一頁真正要回答的問題——
 * 只顯示筆數的話，五筆小案與五筆大案看起來一樣。
 */
export async function getDealSummary(): Promise<
  Record<DealStage, { count: number; amount: number }>
> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("deals").select("stage, amount");

  const empty = {
    inquiry: { count: 0, amount: 0 },
    quoted: { count: 0, amount: 0 },
    negotiating: { count: 0, amount: 0 },
    won: { count: 0, amount: 0 },
    lost: { count: 0, amount: 0 },
  } satisfies Record<DealStage, { count: number; amount: number }>;

  for (const row of data ?? []) {
    const stage = row.stage as DealStage;
    empty[stage].count += 1;
    empty[stage].amount += toNumber(row.amount) ?? 0;
  }

  return empty;
}
