import "server-only";

/**
 * 存檔失敗時，要留下足以診斷的痕跡（0818）
 *
 * ── 這支東西是被一個真實事故逼出來的 ─────────────────────────
 *
 * 0818：使用者按「存到我的帳號」，畫面上只有一句「存檔失敗。」。
 * 真正的原因是 `crm_definitions.owner_id` 的外鍵撞了——那個帳號
 * 建立於 `profiles` 的 trigger 之前，所以沒有 profile 列
 * （`20260818000016_profiles_backfill.sql`）。
 *
 * 資料庫回的訊息其實把問題講得一清二楚：
 *
 * ```text
 * insert or update on table "crm_definitions" violates foreign key
 * constraint "crm_definitions_owner_id_fkey"
 * DETAIL: Key (owner_id)=(…) is not present in table "profiles".
 * ```
 *
 * 而應用層把它整個丟掉了。結果是**沒有任何人有辦法查**——
 * 使用者看到四個字，伺服器的紀錄裡什麼都沒有。
 *
 * ── 兩件事要分開 ──────────────────────────────────────────────
 *
 * 給使用者看的：一句人話，不含資料表名、欄位名、約束名。
 *   那些字對他沒有意義，而且會洩漏 schema。
 *
 * 留在伺服器的：**原封不動的原始錯誤**。
 *   摘要過的日誌等於沒有日誌——真正需要它的那一次，
 *   被摘掉的往往正是關鍵的那一段。
 */

export interface SaveErrorLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * 已知的失敗，以及要對使用者說什麼。
 *
 * ⚠️ 只列**使用者自己能處理**的。其餘一律回 null，走那句籠統的話——
 * 因為對它們來說，能做的事只有「回報給我們」。
 */
function knownMessage(error: SaveErrorLike): string | null {
  // 上限由資料庫 trigger 擋，訊息本身就是寫給人看的
  if (/\d+\s*(份|筆)/.test(error.message)) return error.message;

  switch (error.code) {
    case "23505":
      return "這個名稱或編號已經有人用過了，換一個。";
    case "23514":
      return "有欄位不符合規則，請檢查一下再存一次。";
    default:
      return null;
  }
}

/**
 * 記錄原始錯誤，回傳要給使用者看的那一句。
 *
 * @param where 出事的地方，例如 `saveCrmDesign`。日誌要看得出是哪一條路徑
 */
export function describeSaveError(where: string, error: SaveErrorLike, fallback: string): string {
  /*
   * ⚠️ 一定要記，而且記完整的。
   *
   * 這一行就是 0818 那次事故裡唯一缺少的東西：資料庫已經說清楚了，
   * 而沒有人聽得到。
   */
  console.error(`[save] ${where} 失敗`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return knownMessage(error) ?? fallback;
}
