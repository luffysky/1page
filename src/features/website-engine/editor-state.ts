import { z } from "zod";

import { siteSectionSchema } from "./schema";
import { ACCENT_IDS, THEME_IDS } from "./templates";

/**
 * 編輯器狀態的可攜形狀（CR-003-4）
 *
 * ── 為什麼這份 schema 要單獨拿出來 ────────────────────────────
 *
 * 同一份東西現在有兩個保存的地方：
 *
 *   sessionStorage   免費的那一半，不用登入（Spec §8.15）
 *   saved_sites      「存到我的帳號」的那一半（定價 B）
 *
 * 一開始這兩邊存的**不是同一種東西**：sessionStorage 存訪客的輸入，
 * 資料庫存 `buildSiteConfig()` 算出來的成品。兩份都對，但它們不能互換——
 * 結果就是存得進資料庫、卻載不回編輯器：成品裡沒有「你當初選的是哪一套模板」，
 * 那個資訊在算出成品的那一刻就被丟掉了。
 *
 * 現在兩邊存同一份文件，而這份 schema 是它唯一的定義。
 *
 * ── 存輸入，不存衍生物 ────────────────────────────────────────
 *
 * 見 preview-context 的 PreviewState 說明。主題／字型／顏色都是 draft 的函數，
 * 存成品等於存一份會與程式碼分歧的快照——模板文案改版之後，
 * 載回來的草稿還是舊文案，而且沒有任何跡象。
 *
 * 例外只有 `sections`：使用者把「常見問題」搬到「團隊」前面之後，
 * 沒有任何一組純量算得出那個順序。它是輸入。
 *
 * ⚠️ 兩個來源都是**不可信輸入**。sessionStorage 使用者自己改得動；
 * jsonb 欄位保證的只有「這是合法 JSON」，不保證「這是合法的編輯器狀態」，
 * 而且中間還隔了一個可能比現在的 schema 舊的版本。所以兩邊都過這裡。
 */
export const editorStateSchema = z.object({
  templateId: z.string().min(1).max(64),
  themeId: z.enum(THEME_IDS),
  accentId: z.enum(ACCENT_IDS),
  brandName: z.string().max(200),
  industry: z.string().max(200),
  edited: z.object({ brandName: z.boolean(), industry: z.boolean() }),
  /**
   * `null` 代表「還是模板原本那組」。
   *
   * 不存的話，Spec §8.15 的「訪客累積的設定不會在跳轉時消失」
   * 對整個編輯器都不成立——他排了十分鐘，點一下作品頁就全沒了。
   */
  sections: z.array(siteSectionSchema).max(30).nullable().default(null),
});

export type EditorState = z.infer<typeof editorStateSchema>;

/**
 * sessionStorage 版本：多一個「我正在編輯哪一份存檔」。
 *
 * 這個欄位**不進資料庫**——那一列自己的 id 就是答案，
 * 在 row 裡再存一次自己的 id 是第二份真相。
 *
 * 它要跟著保存是因為：載入草稿 A、改一改、跑去看作品頁再回來，
 * 回來時如果忘了自己在編輯 A，按存檔就會多出一份重複的 A。
 */
export const storedEditorStateSchema = editorStateSchema.extend({
  savedSiteId: z.uuid().nullable().default(null),
});

export type StoredEditorState = z.infer<typeof storedEditorStateSchema>;
