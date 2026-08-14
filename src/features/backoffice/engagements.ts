import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { EngagementRow, EngagementStatus, Milestone, TimeEntry } from "./engagement-types";

/**
 * 接案專案與工時（CR-004 / Phase B BF）
 *
 * ⚠️ 這裡的「專案」是 `engagements`，不是 `portfolio_projects`。
 * 前者是對內的接案，後者是對外的作品集——見 migration 的檔頭。
 */
export * from "./engagement-types";

const ENGAGEMENT_COLUMNS =
  "id, client_id, deal_id, title, status, started_on, due_on, delivered_on, portfolio_project_id, updated_at, clients ( name )";

type EngagementQueryRow = {
  id: string;
  client_id: string;
  deal_id: string | null;
  title: string;
  status: EngagementStatus;
  started_on: string | null;
  due_on: string | null;
  delivered_on: string | null;
  portfolio_project_id: string | null;
  updated_at: string;
  clients: { name: string } | null;
};

function toEngagement(row: EngagementQueryRow): EngagementRow {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "（客戶已刪除）",
    dealId: row.deal_id,
    title: row.title,
    status: row.status,
    startedOn: row.started_on,
    dueOn: row.due_on,
    deliveredOn: row.delivered_on,
    portfolioProjectId: row.portfolio_project_id,
    updatedAt: row.updated_at,
  };
}

export async function listEngagements(status?: EngagementStatus): Promise<EngagementRow[]> {
  const supabase = await createSupabaseServerClient();

  // `.returns<T>()` 要放最後——它回的 TransformBuilder 上沒有 `.eq()`
  const base = supabase
    .from("engagements")
    .select(ENGAGEMENT_COLUMNS)
    .order("updated_at", { ascending: false });

  const { data, error } = await (status ? base.eq("status", status) : base).returns<
    EngagementQueryRow[]
  >();
  if (error) throw new Error(`專案列表讀取失敗：${error.message}`);

  return (data ?? []).map(toEngagement);
}

export async function listEngagementsForClient(clientId: string): Promise<EngagementRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("engagements")
    .select(ENGAGEMENT_COLUMNS)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .returns<EngagementQueryRow[]>();

  return (data ?? []).map(toEngagement);
}

/**
 * 這筆報價開過案了嗎。
 *
 * 報價詳細頁上的「開成專案」按鈕要知道——不然按第二次會多一個
 * 一模一樣的專案，而兩個都會出現在列表上。
 */
export async function getEngagementForDeal(
  dealId: string,
): Promise<{ id: string; title: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("engagements")
    .select("id, title")
    .eq("deal_id", dealId)
    .maybeSingle();

  return data ?? null;
}

export async function getEngagement(id: string): Promise<{
  engagement: EngagementRow;
  milestones: Milestone[];
  timeEntries: TimeEntry[];
  activities: { id: string; kind: string; detail: Record<string, unknown>; createdAt: string }[];
} | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("engagements")
    .select(ENGAGEMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle<EngagementQueryRow>();

  if (!row) return null;

  const [milestones, entries, activities] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, title, due_on, done_on, payment_ratio, sort_order")
      .eq("engagement_id", id)
      .order("sort_order", { ascending: true }),
    /*
     * 工時只撈最近 200 筆。
     *
     * 合計不在這裡算——一個跑了半年的案子有上千筆，
     * 撈回來只為了加總是浪費。合計走下面的 `getTimeTotals()`。
     */
    supabase
      .from("time_entries")
      .select("id, worked_on, minutes, note")
      .eq("engagement_id", id)
      .order("worked_on", { ascending: false })
      .limit(200),
    supabase
      .from("activities")
      .select("id, kind, detail, created_at")
      .eq("subject_type", "engagement")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    engagement: toEngagement(row),
    milestones: (milestones.data ?? []).map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      dueOn: milestone.due_on,
      doneOn: milestone.done_on,
      paymentRatio: milestone.payment_ratio === null ? null : Number(milestone.payment_ratio),
      sortOrder: milestone.sort_order,
    })),
    timeEntries: (entries.data ?? []).map((entry) => ({
      id: entry.id,
      workedOn: entry.worked_on,
      minutes: entry.minutes,
      note: entry.note,
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
 * 這個案子總共花了多少時間。
 *
 * ⚠️ 從資料庫加，不是把 200 筆撈回來加——後者在紀錄變多之後
 * 會安靜地少算，而畫面上看不出來（少的是被 limit 切掉的那些）。
 */
export async function getEngagementMinutes(id: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("time_entries").select("minutes").eq("engagement_id", id);

  return (data ?? []).reduce((total, row) => total + row.minutes, 0);
}

export async function getEngagementCounts(): Promise<Record<EngagementStatus | "all", number>> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("engagements").select("status");

  const counts = {
    all: 0,
    planning: 0,
    active: 0,
    paused: 0,
    delivered: 0,
    closed: 0,
  };

  for (const row of data ?? []) {
    counts.all += 1;
    counts[row.status as EngagementStatus] += 1;
  }

  return counts;
}
