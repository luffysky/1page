import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { hasContactChannel, type Lead } from "./schema";

/**
 * Lead 的持久化（Spec §19 / §38）
 *
 * ⚠️ 用一般的 server client（anon key + 訪客 session），**不是 service role**。
 *
 * 理由是這條路徑的權限邊界必須是 RLS 本身，不是「我們的程式碼記得不要亂寫」。
 * service role 繞過所有 policy——用它的話，leads 的 RLS 就從一道真的牆
 * 變成一份好看的文件。
 *
 * 對應的 policy：任何人（含未登入）都能 insert，只有員工與本人能 select。
 */

export interface LeadRecord {
  id: string;
}

export async function createLead(lead: Lead): Promise<LeadRecord | null> {
  // 沒有聯絡方式的 lead 是一段無法回覆的獨白。
  // 這一層再擋一次，即使呼叫端已經檢查過——
  // 進了資料庫的東西沒有第二次機會。
  if (!hasContactChannel(lead)) return null;

  const supabase = await createSupabaseServerClient();

  // 登入的話把 lead 綁到帳號（CR-002），匿名則為 null。
  // 不因為沒登入就不能留下需求（Spec §37：匿名是預設）。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * ⚠️ id 由這裡產生，插入時**不要求資料庫把它回傳**。
   *
   * 原本寫的是 `.insert(...).select("id").single()`，結果匿名訪客一律失敗：
   * 要回傳剛插入的那一列，PostgREST 需要 SELECT 權限，
   * 而 leads 的 select policy 只開給員工與本人——匿名兩者都不是。
   * 更誤導的是 PostgreSQL 把它報成
   * 「new row violates row-level security policy」，
   * 看起來像是**插入**被擋，實際上被擋的是讀回來那一步。
   *
   * 那個寫法會讓程式告訴模型「沒存成功」。所幸 PostgREST 在同一個交易裡
   * 做完整件事，所以失敗時會回滾、不會留下幽靈資料——
   * 但「明明能寫卻說寫不進去」本身就已經是錯的。
   *
   * 自己給 id 就不需要 RETURNING，RLS 也不必為此放寬。
   */
  const id = crypto.randomUUID();

  const { error } = await supabase.from("leads").insert({
    id,
    profile_id: user?.id ?? null,
    contact_name: lead.contact?.name ?? null,
    contact_email: lead.contact?.email ?? null,
    contact_phone: lead.contact?.phone ?? null,
    business_name: lead.business?.name ?? null,
    business_industry: lead.business?.industry ?? null,
    business_description: lead.business?.description ?? null,
    requirement: lead.requirement ?? {},
    assets: lead.assets ?? {},
    website: lead.website ?? {},
    qualification: lead.qualification ?? {},
    source: "agent",
  });

  // 寫不進去就回 null。呼叫端會告訴模型「沒存成功」，
  // 模型再請對方直接用信箱聯絡——比假裝成功糟糕的只有假裝成功。
  if (error) return null;

  return { id };
}
