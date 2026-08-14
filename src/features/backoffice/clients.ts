import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ClientActivity,
  ClientContact,
  ClientKind,
  ClientNote,
  ClientRow,
  ClientStatus,
} from "./client-types";

/**
 * 客戶與聯絡記錄（CR-004 / Phase B BD）
 *
 * ── 為什麼叫 backoffice 而不是 crm ────────────────────────────
 *
 * 這個專案接下來會有**兩個** CRM：
 *
 *   backoffice   我們自己在用的（這裡），後台，只有員工讀得到
 *   crm-builder  訪客自己設計的（CR-003-5），前台，只有他自己讀得到
 *
 * 兩邊都叫「CRM」，所以命名從第一天就分開。參考專案兩次踩到
 * 「同一個字兩個意思」，兩次都得回頭寫一段警告解釋
 * 「這裡的 role 跟那裡的 role 沒有關係」。
 *
 * ⚠️ 一律用帶 cookie 的 anon client，**不是** service role。
 * 讀得到是因為登入者在 `admin_users` 名單上、RLS 放行，
 * 不是因為換了一把繞過所有規則的鑰匙。
 */

/*
 * ⚠️ 型別與中文標籤在 `client-types.ts`，不在這裡。
 * 這個檔案匯入 `server-only`，而表單是 client component——
 * 從這裡匯入標籤會讓整份伺服器程式碼被拉進瀏覽器端的相依圖。
 */
export * from "./client-types";

const CLIENT_COLUMNS = "id, name, kind, industry, status, source, note, updated_at";

function toClient(row: Record<string, unknown>): ClientRow {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as ClientKind,
    industry: (row.industry as string | null) ?? null,
    status: row.status as ClientStatus,
    source: (row.source as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export async function listClients(status?: ClientStatus): Promise<ClientRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("clients").select(CLIENT_COLUMNS).order("updated_at", {
    ascending: false,
  });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`客戶列表讀取失敗：${error.message}`);

  return (data ?? []).map(toClient);
}

export async function getClient(id: string): Promise<{
  client: ClientRow;
  contacts: ClientContact[];
  notes: ClientNote[];
  activities: ClientActivity[];
  /** 這個客戶是從哪幾筆詢問轉過來的。原始記錄不可變，所以只是連過去 */
  leads: { id: string; createdAt: string; businessName: string | null }[];
} | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!row) return null;

  const [contacts, notes, activities, leads] = await Promise.all([
    supabase
      .from("client_contacts")
      .select("id, name, email, phone, title, is_primary")
      .eq("client_id", id)
      // 主要聯絡人排最前面：那是實際要寄信的那一位
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("notes")
      .select("id, body, internal, created_at")
      .eq("subject_type", "client")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("activities")
      .select("id, kind, detail, created_at")
      .eq("subject_type", "client")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select("id, created_at, business_name")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    client: toClient(row),
    contacts: (contacts.data ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      isPrimary: contact.is_primary,
    })),
    notes: (notes.data ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      internal: note.internal,
      createdAt: note.created_at,
    })),
    activities: (activities.data ?? []).map((activity) => ({
      id: activity.id,
      kind: activity.kind,
      detail: (activity.detail ?? {}) as Record<string, unknown>,
      createdAt: activity.created_at,
    })),
    leads: (leads.data ?? []).map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      businessName: lead.business_name,
    })),
  };
}

/** 統計卡片用。只算數量，不把整份資料撈回來 */
export async function getClientCounts(): Promise<Record<ClientStatus | "all", number>> {
  const supabase = await createSupabaseServerClient();

  const counts = await Promise.all(
    (["prospect", "active", "past"] as ClientStatus[]).map(async (status) => {
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return [status, count ?? 0] as const;
    }),
  );

  const byStatus = Object.fromEntries(counts) as Record<ClientStatus, number>;

  return {
    ...byStatus,
    all: byStatus.prospect + byStatus.active + byStatus.past,
  };
}
