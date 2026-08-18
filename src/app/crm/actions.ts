"use server";

import { revalidatePath } from "next/cache";

import { getMemberIdentity } from "@/features/account/auth";
import {
  addCrmRecord,
  deleteCrmDesign,
  deleteCrmRecord,
  saveCrmDesign,
} from "@/features/crm-builder/store";

/**
 * CRM 設計器的動作（CR-003-5）
 *
 * ⚠️ Server Action 是**公開端點**，不是「只有那個頁面會呼叫的函式」。
 * 身分要在這裡驗，不能倚賴「按鈕只顯示給登入者」。
 */

export interface CrmSaveResult {
  ok: boolean;
  message: string;
  /** 存好之後這份是哪一列。設計器記下來，下一次存檔才是更新而不是再新增 */
  savedId?: string;
}

export async function saveCrmDesignAction(
  _previous: unknown,
  formData: FormData,
): Promise<CrmSaveResult> {
  const identity = await getMemberIdentity();
  if (!identity) {
    return { ok: false, message: "要先登入才能存檔。設計本身不用登入，存下來才要。" };
  }

  /*
   * 「另存新的一份」用一個獨立的欄位，而不是「id 是空字串就當新增」。
   *
   * 兩者在 FormData 裡長得一樣（都是字串），而它們的後果差很多——
   * 一個覆蓋既有的那份，一個多出一份。分不清楚的東西不要讓它靠慣例決定。
   */
  const saveAsNew = formData.get("saveAsNew") === "1";
  const id = saveAsNew ? null : String(formData.get("savedId") ?? "") || null;

  let definition: unknown;
  try {
    definition = JSON.parse(String(formData.get("definition") ?? ""));
  } catch {
    return { ok: false, message: "這份設計讀不出來，請重新整理再試一次。" };
  }

  const result = await saveCrmDesign(definition, id);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/account/crm");

  // 三種結果講三句不一樣的話——使用者按完之後唯一看得到的回饋就是這一句
  const message = id ? "更新好了。" : saveAsNew ? "另存了一份新的。" : "存好了。";

  return { ok: true, message, savedId: result.id };
}

export interface CrmRecordResult {
  ok: boolean;
  message: string;
}

/**
 * 新增一筆記錄。
 *
 * ⚠️ 表單只送**值**，定義由伺服器從資料庫讀。
 * 讓表單帶定義的話，任何人都能送一份「所有欄位都不必填、select 什麼都收」
 * 的定義過來，驗證就等於沒有。
 */
export async function addCrmRecordAction(
  _previous: unknown,
  formData: FormData,
): Promise<CrmRecordResult> {
  const definitionId = String(formData.get("definitionId") ?? "");
  const entityId = String(formData.get("entity") ?? "");

  if (!definitionId || !entityId) return { ok: false, message: "參數不正確。" };

  /*
   * 欄位值以 `field:<id>` 前綴帶過來。
   *
   * 用前綴而不是直接用欄位 id 當 name：表單裡還有 definitionId 與 entity
   * 這些我們自己的欄位，而使用者的欄位 id 是他自己取的——
   * 沒有前綴的話，一個叫 `entity` 的欄位會把真正的 entity 蓋掉。
   */
  const values: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("field:")) continue;
    const fieldId = key.slice("field:".length);

    /*
     * 值原封不動地傳下去，**不在這裡猜型別**。
     *
     * 這裡看到的全都是字串（FormData 就是這樣），而「on」到底是
     * 勾起來的 checkbox 還是某人在文字欄裡真的打了 on，只有定義知道。
     * 依型別轉換的地方是 `recordSchemaFor`，而它是照使用者的定義長出來的。
     */
    values[fieldId] = value;
  }

  const result = await addCrmRecord(definitionId, entityId, values);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath(`/account/crm/${definitionId}`);
  return { ok: true, message: "記下來了。" };
}

export async function removeCrmDesignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteCrmDesign(id);
  revalidatePath("/account/crm");
}

export async function removeCrmRecordAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const definitionId = String(formData.get("definitionId") ?? "");
  if (!id) return;

  await deleteCrmRecord(id);
  revalidatePath(`/account/crm/${definitionId}`);
}
