import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 後台收件匣（CR-004 / Phase B BC，Phase M 的 MD）
 *
 * ── 與會員那支分開，因為它們問的不是同一件事 ──────────────────
 *
 * `features/account/inquiries.ts` 問的是「我留了什麼」；
 * 這一支問的是「有誰在等我們回覆」。同一張表、不同的需求：
 * 這裡要看得到聯絡方式與完整需求，還要能排序與翻頁。
 *
 * ⚠️ 一樣用帶 cookie 的 anon client，**不是** service role。
 * 後台之所以讀得到全部的 lead，是因為登入者的 uid 在 `admin_users`
 * 名單上，RLS 的 `leads_select_staff` 因此放行——不是因為換了一把
 * 繞過所有規則的鑰匙。即使這裡寫錯，非後台人員也拿不到任何一筆。
 */

export interface AdminLead {
  id: string;
  createdAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessName: string | null;
  businessIndustry: string | null;
  businessDescription: string | null;
  source: string;
  /** 有沒有綁到帳號。綁了的話對方看得到自己的紀錄 */
  hasAccount: boolean;
  /** 已經轉成哪一個客戶。null 表示還沒轉——那顆按鈕才按得下去 */
  clientId: string | null;
}

const SELECT = `
  id, created_at, contact_name, contact_email, contact_phone,
  business_name, business_industry, business_description, source, profile_id, client_id
`;

export async function listLeads(limit = 100): Promise<AdminLead[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("leads")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`收件匣讀取失敗：${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    businessName: row.business_name,
    businessIndustry: row.business_industry,
    businessDescription: row.business_description,
    source: row.source,
    hasAccount: row.profile_id !== null,
    clientId: row.client_id,
  }));
}

/**
 * 收件匣的計數。
 *
 * ⚠️ 用 `head: true` 只取數量，不把整份資料撈回來——
 * 總覽頁只需要一個數字，撈回一百筆需求只為了 `.length` 是浪費，
 * 而且那些是個人資料，沒有必要就不要經過我們的行程。
 */
export async function countLeads(): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}
