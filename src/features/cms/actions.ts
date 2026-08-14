"use server";

import { revalidatePath, updateTag } from "next/cache";

import { getAdminIdentity } from "@/features/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { cmsTag } from "./read";
import { CMS_DOCUMENTS, isCmsKey } from "./registry";

/**
 * 存 CMS 文件（CR-004 / Phase B BH）
 *
 * ⚠️ Server Action 是**公開端點**。身分要在這裡驗，
 * 不能倚賴「這個表單只有後台看得到」。
 */

export type CmsSaveResult = { ok: true; message: string } | { ok: false; message: string };

export async function saveCmsDocument(
  _previous: unknown,
  formData: FormData,
): Promise<CmsSaveResult> {
  const identity = await getAdminIdentity();
  // 不說明原因：對方若不是後台人員，連「這裡有後台」都不該確認
  if (!identity) return { ok: false, message: "找不到這個頁面。" };

  const key = String(formData.get("key") ?? "");
  if (!isCmsKey(key)) return { ok: false, message: "不認得這份文件。" };

  const raw = String(formData.get("content") ?? "");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, message: "這份內容不是合法的 JSON——括號或引號可能少了一個。" };
  }

  /*
   * 存進去之前先驗。
   *
   * 讀取端驗不過會退回預設值，也就是「編輯的人以為改了、實際上沒有」。
   * 在這裡擋下來才說得出**哪一個欄位**不對。
   */
  const validated = CMS_DOCUMENTS[key].schema.safeParse(parsedJson);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    const path = issue?.path.join(".") || "內容";
    return { ok: false, message: `${path}：${issue?.message ?? "格式不正確"}` };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("cms_documents").upsert(
    {
      key,
      content: validated.data,
      updated_by: identity.userId,
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, message: `儲存失敗：${error.message}` };

  /*
   * 留一版。
   *
   * ⚠️ 存的是**這一版**，不是上一版。回復時直接把某一版寫回去即可，
   * 不必倒推。存上一版的話，第一次存檔會留下一份「還沒被改過的」，
   * 而最新那一版反而沒有紀錄。
   */
  await supabase.from("cms_revisions").insert({
    document_key: key,
    content: validated.data,
    saved_by: identity.userId,
  });

  /*
   * 打掉這一個 key 的快取。
   *
   * 沒有這一行的話，後台顯示「已儲存」而前台還是舊的——
   * 而那是最難查的一種：兩邊都沒有錯誤訊息。
   *
   * ⚠️ 用 `updateTag` 而不是 `revalidateTag`。
   *
   * Next 16 把兩者分開了：`revalidateTag(tag, "max")` 是「標記為過期，
   * 下次有人造訪時才重抓」，而這裡要的是 read-your-own-writes——
   * 存完立刻看到自己改的東西。文件明說 Server Action 的即時更新
   * 要用 `updateTag`。
   *
   * （單參數的 `revalidateTag(tag)` 已標記為 deprecated。）
   */
  updateTag(cmsTag(key));

  // 公開頁面是動態渲染，但 revalidatePath 會清掉 Router Cache，
  // 讓管理者存檔後立刻在前台看到結果
  revalidatePath("/");

  return { ok: true, message: "存好了，前台立刻生效。" };
}

/** 把某一個歷史版本寫回去。改壞了要回得去 */
export async function restoreCmsRevision(formData: FormData): Promise<void> {
  const identity = await getAdminIdentity();
  if (!identity) return;

  const key = String(formData.get("key") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");
  if (!isCmsKey(key) || !revisionId) return;

  const supabase = await createSupabaseServerClient();

  const { data: revision } = await supabase
    .from("cms_revisions")
    .select("content")
    .eq("id", revisionId)
    .eq("document_key", key)
    .maybeSingle();

  if (!revision) return;

  /*
   * 還原也要再驗一次。
   *
   * 舊版本可能是在 schema 改變之前存的——直接寫回去會讓讀取端
   * 從此退回預設值，而畫面上看起來像「還原沒有生效」。
   */
  const validated = CMS_DOCUMENTS[key].schema.safeParse(revision.content);
  if (!validated.success) return;

  await supabase
    .from("cms_documents")
    .upsert({ key, content: validated.data, updated_by: identity.userId }, { onConflict: "key" });

  // 還原本身也是一次修改，所以一樣留一版
  await supabase.from("cms_revisions").insert({
    document_key: key,
    content: validated.data,
    saved_by: identity.userId,
  });

  updateTag(cmsTag(key));
  revalidatePath("/");

  /*
   * 後台那一頁也要重新渲染。
   *
   * 少了這一行，還原之後編輯器裡還是舊文字——而使用者接著按儲存，
   * 就把自己剛還原掉的東西又存回去了。
   */
  revalidatePath(`/admin/cms/${key}`);
}
