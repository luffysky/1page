"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMemberIdentity } from "@/features/account/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 會員中心的操作（Phase M）
 *
 * 全部走 Server Action。這些動作要改的是資料庫，而 RLS 認的是
 * 登入者的 token——放在 client 呼叫並不會比較安全，只會多一個
 * 要自己驗身分的地方。
 */

/** 顯示名稱的長度上限。與 profiles.display_name 的用途一致，不是無限自由欄位 */
const MAX_DISPLAY_NAME = 40;

export async function updateDisplayName(formData: FormData): Promise<void> {
  const identity = await getMemberIdentity();

  /*
   * ⚠️ Server Action 是一個**公開端點**，不是「只有那個頁面會呼叫的函式」。
   * 任何人都能對它送出請求，所以身分要在這裡再驗一次，
   * 不能倚賴「頁面已經擋過了」。
   */
  if (!identity) redirect("/login?next=%2Faccount");

  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim().slice(0, MAX_DISPLAY_NAME) : "";

  const supabase = await createSupabaseServerClient();

  /*
   * upsert 而不是 update：比 CR-002 的 trigger 更早建立的帳號沒有 profile 列
   * （站長自己就是），update 會靜靜地改到 0 列然後回報成功。
   */
  await supabase.from("profiles").upsert(
    {
      id: identity.userId,
      email: identity.email,
      display_name: displayName || null,
    },
    { onConflict: "id" },
  );

  revalidatePath("/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
