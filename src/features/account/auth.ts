import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 會員身分（Spec V1.3 §47 CR-002 / Phase M）
 *
 * ── 這裡跟 features/admin/auth.ts 是兩件事 ────────────────────
 *
 * CR-002 定義得很清楚：
 *
 *   > 會員 = 有 auth.users 列、但不在 admin_users 裡的人。
 *
 * 所以「誰是會員」與「誰是管理員」是兩個獨立的問題，由兩個模組回答。
 * 合併成一個 `role` 欄位（ai_island_v3 的做法）會讓處理會員資料的程式碼
 * 與決定管理權限的程式碼碰到同一列，profile 的 bug 就有機會升級成管理權限。
 *
 * ⚠️ 但**會員中心本身對管理員也開放**。管理員同樣是一個有帳號的人，
 * 他也有 email 與顯示名稱要看。「不是會員」指的是身分判定，
 * 不是「不准用會員頁面」——把管理員擋在自己的帳號頁外面沒有任何好處。
 *
 * 兩個入口在選單上是分開的兩顆按鈕，因為它們是兩個不同的後台：
 * 會員中心是「我的帳號」，後台是「這個網站的管理」。
 */

export interface MemberIdentity {
  userId: string;
  email: string | null;
  displayName: string | null;
}

/**
 * 取得目前登入者。沒登入回傳 null。
 *
 * 用 `getUser()` 而非 `getSession()`：前者會向 Supabase 驗證 token，
 * 後者只讀 cookie，而 cookie 可以被偽造。
 * 這一點與後台那支的理由相同，兩邊都不能只信 cookie。
 */
export async function getMemberIdentity(): Promise<MemberIdentity | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  /*
   * profiles 由 MA 的 trigger 在使用者建立時自動插入。
   * 但這裡仍然容許它不存在——trigger 是在 CR-002 之後才加的，
   * 比它早建立的帳號（例如站長自己）沒有那一列。
   * 沒有 profile 不該讓人進不了自己的帳號頁。
   */
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: (profile?.display_name as string | null) ?? null,
  };
}

/** 會員頁面的守衛。未登入導向登入頁，並記住原本要去哪裡 */
export async function requireMember(next: string): Promise<MemberIdentity> {
  const identity = await getMemberIdentity();
  if (identity) return identity;

  redirect(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * 供公開版面判斷選單要顯示「登入」還是「會員中心」。
 *
 * ⚠️ 與 getAdminEntry 不同，這個**不需要保密**——
 * `/account` 是一條公開存在的路徑，登入頁也是。
 * 要藏的只有後台密路徑那一條。
 */
export async function getAccountEntry(): Promise<{ email: string | null } | null> {
  const identity = await getMemberIdentity();
  return identity ? { email: identity.email } : null;
}
