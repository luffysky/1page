"use server";

import { z } from "zod";

import { extensionMatchesMime, findMediaKind, formatBytes } from "@/config/media";
import { getMemberIdentity } from "@/features/account/auth";
import { buildSiteObjectKey, createUploadUrl, hasR2Config, publicUrlFor } from "@/lib/storage/r2";

/**
 * 編輯器的媒體上傳（CR-003-4，CR-004 / BJ 起也收影片）
 *
 * ── 這條路徑為什麼一定要登入 ──────────────────────────────────
 *
 * 編輯器本身不需要登入（定價 B：免費編輯）。上傳是例外，而且理由與
 * 收費無關：**一個不檢查身分的 presign 端點等於開放公開寫入**。
 * R2 沒有 RLS，這裡放行就真的放行了——任何人都能拿我們的 bucket
 * 當免費圖床，而帳單是我們的。
 *
 * 檔案也因此綁在 owner 的路徑下（`sites/<userId>/…`），
 * 之後要清理或計配額時才有得算。
 *
 * ⚠️ 順序與後台那條一樣：**先驗身分，再驗檔案，最後才簽發**。
 */

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive(),
});

export type SiteImageUploadResult =
  { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; message: string };

export async function createSiteImageUploadUrl(input: unknown): Promise<SiteImageUploadResult> {
  const identity = await getMemberIdentity();
  if (!identity) {
    return { ok: false, message: "要先登入才能上傳檔案。編輯本身不用登入。" };
  }

  if (!hasR2Config()) {
    // 「還沒接上」與「壞掉了」是兩件事，訊息要說得出是哪一種
    return { ok: false, message: "這個環境還沒設定圖片儲存空間。" };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "上傳參數不正確" };

  const { filename, contentType, size } = parsed.data;

  const kind = findMediaKind(contentType);
  /*
   * 收圖片與影片，不收 PDF。
   *
   * ⚠️ 這一段原本只收圖片，理由寫得很清楚：
   * 「網站區塊沒有任何地方會播影片——收得進來卻沒有人讀，
   *   那就只是一個 100MB 的上傳孔。」
   *
   * CR-004 / BJ 讓每一塊都可以用影片當背景，所以現在真的有讀取端了
   * （`sections/section-background.tsx`）。條件放寬的同時把理由改掉，
   * 而不是留著一句已經不成立的註解——過期的註解比沒有註解更糟。
   *
   * PDF 仍然不收：那是作品集的東西，走後台那條路徑。
   */
  if (!kind || (kind.type !== "image" && kind.type !== "video")) {
    return { ok: false, message: `只能上傳圖片或影片（${contentType} 不行）` };
  }

  // 副檔名必須與 MIME 相符。只驗其中一項擋不住改副檔名或偽造 MIME
  const extension = extensionMatchesMime(filename, kind);
  if (!extension) {
    return {
      ok: false,
      message: `副檔名與檔案類型不符（${kind.label} 應為 .${kind.extensions.join(" / .")}）`,
    };
  }

  if (size > kind.maxBytes) {
    return { ok: false, message: `${kind.label} 上限為 ${formatBytes(kind.maxBytes)}` };
  }

  // key 由伺服器決定，呼叫端無法指定路徑
  const key = buildSiteObjectKey(identity.userId, extension);
  const uploadUrl = await createUploadUrl({ key, contentType, contentLength: size });

  return { ok: true, uploadUrl, publicUrl: publicUrlFor(key) };
}
