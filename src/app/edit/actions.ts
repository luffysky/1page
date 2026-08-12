"use server";

import { revalidatePath } from "next/cache";

import { getMemberIdentity } from "@/features/account/auth";
import { deleteSavedSite, saveSite } from "@/features/website-engine/saved-sites";

/**
 * 編輯器的存檔動作（CR-003-4 / 定價 B）
 *
 * ⚠️ Server Action 是**公開端點**，不是「只有那個頁面會呼叫的函式」。
 * 身分要在這裡驗，不能倚賴「按鈕只顯示給登入者」。
 */

export async function saveCurrentSite(
  _previous: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const identity = await getMemberIdentity();
  if (!identity) {
    return { ok: false, message: "要先登入才能存檔。編輯本身不用登入，存下來才要。" };
  }

  const name = String(formData.get("name") ?? "");
  const raw = String(formData.get("config") ?? "");

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    return { ok: false, message: "這份設定讀不出來，請重新整理再試一次。" };
  }

  const result = await saveSite(name, config);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/account");
  return { ok: true, message: "存好了。可以在會員中心找到它。" };
}

export async function removeSavedSite(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS 保證只刪得掉自己的，所以這裡不必再查一次擁有者
  await deleteSavedSite(id);
  revalidatePath("/account");
}
