import "server-only";

import { unstable_cache } from "next/cache";

import { getSupabasePublicClient, hasSupabaseConfig } from "@/lib/supabase/client";

import { CMS_DOCUMENTS, type CmsKey } from "./registry";

/**
 * 讀 CMS 文件（CR-004 / Phase B BH）
 *
 * ── 快取，而不是每次請求都查 ──────────────────────────────────
 *
 * 文案進了資料庫，首頁就從「純算」變成「要查一次資料庫」。
 * 首頁的載入速度是這個網站的賣點之一，而且有一支效能稽核在盯——
 * 所以走 `unstable_cache` + tag：平常是快取命中，
 * 後台按存檔時打掉那一個 tag。
 *
 * ⚠️ tag 用 key 分開（`cms:faq.list`），不是一個全域的 `cms`。
 * 共用一個 tag 的話，改一句 FAQ 會連價格的快取一起清掉——
 * 那不是錯誤，但它讓「為什麼首頁突然慢了一下」變得無法追。
 *
 * ── 讀出來一定要再驗一次 ──────────────────────────────────────
 *
 * 欄位是 jsonb，它保證的只有「這是合法 JSON」。中間隔了一次序列化、
 * 一個資料庫，以及一個可能比現在的 schema 舊的版本。
 * 驗不過就退回程式碼裡的那份——**壞掉的內容不該讓首頁空白**。
 */

export function cmsTag(key: CmsKey): string {
  return `cms:${key}`;
}

type CmsContent<K extends CmsKey> = (typeof CMS_DOCUMENTS)[K]["fallback"];

async function fetchDocument(key: CmsKey): Promise<unknown> {
  const { data } = await getSupabasePublicClient()
    .from("cms_documents")
    .select("content")
    .eq("key", key)
    .maybeSingle();

  return data?.content ?? null;
}

export async function readCmsDocument<K extends CmsKey>(key: K): Promise<CmsContent<K>> {
  const definition = CMS_DOCUMENTS[key];

  /*
   * 沒有設定 Supabase 就直接回預設值，**而且不碰快取 API**。
   *
   * ⚠️ 早退這一步一定要在 `unstable_cache` 之前。
   *
   * 那支函式需要 Next 的請求脈絡，而單元測試裡沒有——
   * 走進去之後拿到的不是「fallback」，是一個爛掉的 Promise，
   * 而呼叫端看到的是 `Cannot read properties of undefined`。
   * （search_faq 的測試就是這樣紅的。）
   *
   * 這與 portfolio 的 in-memory 實作同一個判斷：
   * 開發環境不必為了看一眼首頁而先接資料庫。
   */
  if (!hasSupabaseConfig()) return definition.fallback as CmsContent<K>;

  const load = unstable_cache(() => fetchDocument(key), ["cms", key], {
    tags: [cmsTag(key)],
    // tag 失效是主要機制；時間只是保險，避免某次 revalidate 沒打到
    revalidate: 3600,
  });

  const raw = await load();
  if (raw === null) return definition.fallback as CmsContent<K>;

  const parsed = definition.schema.safeParse(raw);
  if (!parsed.success) {
    /*
     * 驗不過就退回預設值，而且**要留下痕跡**。
     *
     * 安靜地退回的話，後台存了一份壞掉的內容之後，網站看起來完全正常，
     * 而編輯的人以為自己的修改生效了。
     */
    console.error(`[cms] ${key} 的內容不符合 schema，已退回程式碼裡的預設值`, parsed.error.issues);
    return definition.fallback as CmsContent<K>;
  }

  return parsed.data as CmsContent<K>;
}
