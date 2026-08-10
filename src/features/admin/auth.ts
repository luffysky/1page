import "server-only";

import { redirect } from "next/navigation";

import { adminBasePath, type AdminRole, isAdminEnabled } from "@/config/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 後台身分與權限（Spec §41）
 *
 * > 不要只靠前端隱藏按鈕。
 *
 * 三層防線，缺一不可：
 *   1. 密路徑     擋掉自動掃描（防掃描，不是安全邊界）
 *   2. 本模組     server 端驗證身分與角色，未授權一律 404
 *   3. RLS        即使繞過前兩層直接打 API，資料庫也不給
 *
 * 第 3 層才是真正的邊界。前兩層是為了讓攻擊者連嘗試的機會都少一點。
 */

export interface AdminIdentity {
  userId: string;
  email: string | null;
  role: AdminRole;
}

/**
 * 取得目前使用者的後台身分。不是後台人員則回傳 null。
 *
 * 用 `getUser()` 而非 `getSession()`：前者會向 Supabase 驗證 token，
 * 後者只讀 cookie。cookie 可以被偽造，驗證過的 token 不行。
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!isAdminEnabled()) return null;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: staff } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: staff.role as AdminRole,
  };
}

/**
 * 後台頁面的入口守衛。非後台人員一律導向登入頁。
 *
 * ⚠️ 未登入與「已登入但不是後台人員」的處理刻意不同：
 *   未登入            → 導向登入頁（他可能只是還沒登入）
 *   已登入但無權限     → 導回首頁，不說明原因
 * 後者不告訴對方「這裡有個你進不去的後台」，避免確認密路徑的存在。
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(adminBasePath())}`);
  }

  const identity = await getAdminIdentity();
  if (!identity) redirect("/");

  return identity;
}

/**
 * 供公開版面判斷「要不要在選單顯示後台入口」。
 *
 * 回傳 null 時，後台路徑完全不會出現在送給瀏覽器的 HTML 裡——
 * 這是密路徑保密的關鍵：入口只渲染給真的有權限的人，
 * 而不是渲染給所有人再用 CSS 藏起來。
 */
export async function getAdminEntry(): Promise<{ href: string; role: AdminRole } | null> {
  const identity = await getAdminIdentity();
  if (!identity) return null;

  return { href: adminBasePath(), role: identity.role };
}
