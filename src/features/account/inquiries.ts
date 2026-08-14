import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 會員自己留過的需求（Phase B BB）
 *
 * ── `leads.profile_id` 終於有讀取端 ───────────────────────────
 *
 * CR-002 讓登入者留下的 lead 綁上帳號，理由寫在 migration 裡：
 * 「之後可以在自己的頁面看到」。那個「之後」一直沒有到——
 * 欄位寫進去了，沒有任何地方讀它。
 *
 * ⚠️ 這裡不加 `.eq("profile_id", …)`。
 *
 * 擋住別人資料的是 RLS：
 *
 *   leads_select_own    using (profile_id = auth.uid())
 *   leads_select_staff  using (is_admin())
 *
 * 在應用層再寫一次條件，看起來更安全，實際上會讓下一個人
 * 以為是這一行在擋——然後在別的地方忘記寫它。
 * （這正是 `portfolio_categories.active` 那次的教訓。）
 *
 * 但它有一個真的副作用要知道：**員工看得到全部的 lead**。
 * 所以這支函式只給會員區用，員工的收件匣要走自己的查詢，
 * 那邊該有分頁與篩選。
 */

export interface MyInquiry {
  id: string;
  createdAt: string;
  businessName: string | null;
  businessIndustry: string | null;
  contactEmail: string | null;
  source: string;
}

export async function listMyInquiries(profileId: string): Promise<MyInquiry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("leads")
    .select("id, created_at, business_name, business_industry, contact_email, source, profile_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];

  /*
   * RLS 對員工是全開的，而員工也會用會員中心（見 features/account/auth.ts：
   * 「會員中心本身對管理員也開放」）。不過濾的話，Luffy 打開自己的
   * 「我的詢問」會看到全站所有人的需求——那不是這一頁在講的事。
   */
  return (data ?? [])
    .filter((row) => row.profile_id === profileId)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      businessName: row.business_name,
      businessIndustry: row.business_industry,
      contactEmail: row.contact_email,
      source: row.source,
    }));
}
