"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 登出。
 *
 * 用 Server Action 而非瀏覽器端的 `supabase.auth.signOut()`：
 * session cookie 是 httpOnly，由 server 寫入也該由 server 清除。
 * 瀏覽器端呼叫會留下 server 那側還認得的 cookie 殘影，
 * 表現是「按了登出、重新整理又登入了」。
 *
 * `scope: "local"` 只登出這個瀏覽器，不影響其他裝置——
 * 一般人按登出的意思是「離開這台電腦」，不是「把手機也踢掉」。
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
