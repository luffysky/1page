import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 公開讀取用的 Supabase client（anon key）。
 *
 * ⚠️ 這個 client 受 RLS 約束，這是刻意的：
 * 公開頁面拿不到未發布的作品，即使程式寫錯查詢也一樣——
 * 授權由資料庫把關，不是由查詢條件把關（Spec §41）。
 *
 * **絕不要為了「方便」在公開路徑改用 service role key。**
 * 那會讓 RLS 完全失效，而症狀是靜默的：頁面看起來正常，只是多了草稿。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

export function getSupabasePublicClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY。請參考 .env.example。",
    );
  }

  cached ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

/** 環境變數是否備妥。用於在缺少設定時給出可讀的錯誤，而不是在查詢時才炸開 */
export function hasSupabaseConfig(): boolean {
  return Boolean(url && anonKey);
}
