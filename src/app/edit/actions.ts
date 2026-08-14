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

export interface SaveResult {
  ok: boolean;
  message: string;
  /** 存好之後這份是哪一列。編輯器記下來，下一次存檔才是更新而不是再新增一份 */
  savedSiteId?: string;
}

export async function saveCurrentSite(_previous: unknown, formData: FormData): Promise<SaveResult> {
  const identity = await getMemberIdentity();
  if (!identity) {
    return { ok: false, message: "要先登入才能存檔。編輯本身不用登入，存下來才要。" };
  }

  const name = String(formData.get("name") ?? "");
  const raw = String(formData.get("draft") ?? "");

  /*
   * 「另存新的一份」就是不要帶 id。
   *
   * 用一個獨立的欄位而不是「id 是空字串就當新增」：兩者在 FormData 裡
   * 長得一樣（都是字串），而它們的後果差很多——一個覆蓋既有的那份，
   * 一個多出一份。分不清楚的東西不要讓它靠慣例決定。
   */
  const saveAsNew = formData.get("saveAsNew") === "1";
  const id = saveAsNew ? null : String(formData.get("savedSiteId") ?? "") || null;

  let draft: unknown;
  try {
    draft = JSON.parse(raw);
  } catch {
    return { ok: false, message: "這份設定讀不出來，請重新整理再試一次。" };
  }

  const result = await saveSite(name, draft, id);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/account");

  /*
   * 三種結果講三句不一樣的話。
   *
   * 「更新」與「另存新的一份」的差別是帳號裡多不多一份東西，
   * 而使用者按完之後唯一看得到的回饋就是這一句。都寫「存好了」的話，
   * 他要到下次打開會員中心才會發現多了五份幾乎一樣的草稿。
   */
  const message = id
    ? "更新好了。"
    : saveAsNew
      ? "另存了一份新的。"
      : "存好了。可以在會員中心找到它。";

  return { ok: true, message, savedSiteId: result.id };
}

export async function removeSavedSite(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS 保證只刪得掉自己的，所以這裡不必再查一次擁有者
  await deleteSavedSite(id);
  revalidatePath("/account");
}
