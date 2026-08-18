import { type CrmDefinition, validateCrmDefinition } from "./schema";

/**
 * 設計到一半的東西存在瀏覽器裡（CR-003-5 / 定價一致）
 *
 * 「免費設計、存檔才要帳號」，所以未登入的人也必須能離開再回來。
 * 用 sessionStorage 而不是 localStorage：這是**這一次**的工作，
 * 關掉分頁就結束。localStorage 會讓半年前隨手玩的東西在下次來訪時
 * 突然跳出來，而使用者早就不記得那是什麼。
 *
 * ⚠️ 讀出來一定要驗。sessionStorage 是使用者可以直接改的地方，
 * 而且上一次存的可能是舊版本的形狀。
 */

const KEY = "1page:crm-draft";

export interface StoredCrmDraft {
  definition: CrmDefinition;
  /** 已經存到帳號的話記著是哪一份，下一次存檔才是更新而不是再新增一份 */
  savedId: string | null;
}

export function readCrmDraft(): StoredCrmDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { definition?: unknown; savedId?: unknown };
    const validated = validateCrmDefinition(parsed.definition);
    if (!validated.ok) return null;

    return {
      definition: validated.definition,
      savedId: typeof parsed.savedId === "string" ? parsed.savedId : null,
    };
  } catch {
    // 存取 sessionStorage 在無痕模式與某些隱私設定下會直接丟錯。
    // 那不該讓整個設計器打不開——最多是「這一次沒有記住」
    return null;
  }
}

export function writeCrmDraft(draft: StoredCrmDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 同上。而且配額滿了的時候，能繼續編比能記住更重要
  }
}

export function clearCrmDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
