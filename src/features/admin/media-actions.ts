"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { extensionMatchesMime, findMediaKind, formatBytes, sanitizeFilename } from "@/config/media";
import {
  buildObjectKey,
  createUploadUrl,
  deleteObject,
  keyFromPublicUrl,
  publicUrlFor,
} from "@/lib/storage/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getAdminIdentity } from "./auth";

/**
 * 媒體上傳（Spec §8.9、§36 / CR-001）
 *
 * 流程：
 *   1. 前端要求簽名網址（附檔名、MIME、大小）
 *   2. **後端先驗證身分**，再驗證 MIME / 副檔名 / 大小，最後才簽發
 *   3. 前端把檔案直接 PUT 到 R2（不經過我們的伺服器）
 *   4. 前端回報成功，後端寫入 portfolio_media
 *
 * ⚠️ 第 2 步的順序是重點：**先驗證身分再簽發**。
 * 一個不檢查身分的 presign endpoint 等於開放公開寫入——
 * R2 沒有 RLS，這裡放行就真的放行了。
 */

async function requireStaff() {
  const identity = await getAdminIdentity();
  if (!identity) throw new Error("Not found");
  return identity;
}

const requestSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive(),
});

export type PresignResult =
  | { ok: true; uploadUrl: string; publicUrl: string; mediaType: "image" | "video" | "pdf" }
  | { ok: false; message: string };

export async function createMediaUploadUrl(input: unknown): Promise<PresignResult> {
  await requireStaff();

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "上傳參數不正確" };

  const { projectId, filename, contentType, size } = parsed.data;

  // 白名單比對。不在名單上的一律拒絕，不嘗試「猜」它是什麼
  const kind = findMediaKind(contentType);
  if (!kind) return { ok: false, message: `不支援的檔案類型：${contentType}` };

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
  const key = buildObjectKey(projectId, extension);
  const uploadUrl = await createUploadUrl({ key, contentType, contentLength: size });

  return { ok: true, uploadUrl, publicUrl: publicUrlFor(key), mediaType: kind.type };
}

const saveSchema = z.object({
  projectId: z.string().uuid(),
  url: z.string().url(),
  type: z.enum(["image", "video", "pdf"]),
  alt: z.string().trim().max(300),
  role: z.enum(["cover", "gallery", "mobile", "desktop", "before", "after", "document"]),
  filename: z.string().max(255).optional(),
});

export type SimpleResult = { ok: true } | { ok: false; message: string };

export async function saveMediaRecord(input: unknown): Promise<SimpleResult> {
  await requireStaff();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "媒體資料不正確" };

  const { projectId, url, type, alt, role, filename } = parsed.data;

  // 只接受指向我們自己 bucket 的網址。否則有人可以把任意外部網址
  // 寫進資料庫，讓公開頁面去載入它。
  if (!keyFromPublicUrl(url)) {
    return { ok: false, message: "媒體網址不屬於本站的儲存空間" };
  }

  // Spec §35：圖片必須有替代文字。資料庫也有 image_requires_alt 約束，
  // 但在這裡先擋能給出可讀的訊息，而不是丟一個資料庫錯誤給使用者。
  if (type === "image" && alt.length === 0) {
    return { ok: false, message: "圖片必須填寫替代文字（螢幕閱讀器與 SEO 都需要）" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("portfolio_media")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_media").insert({
    project_id: projectId,
    type,
    url,
    alt: alt || null,
    caption: filename ? sanitizeFilename(filename) : null,
    role,
    sort_order: (existing?.sort_order ?? -1) + 1,
  });

  if (error) {
    // 一件作品至多一張封面（migration 0001 的唯一索引）
    if (error.code === "23505") return { ok: false, message: "這件作品已經有封面了" };
    return { ok: false, message: `儲存失敗：${error.message}` };
  }

  revalidatePath("/work");
  return { ok: true };
}

export async function deleteMedia(mediaId: string): Promise<SimpleResult> {
  await requireStaff();

  if (!z.string().uuid().safeParse(mediaId).success) {
    return { ok: false, message: "參數不正確" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: media } = await supabase
    .from("portfolio_media")
    .select("url")
    .eq("id", mediaId)
    .maybeSingle();

  if (!media) return { ok: false, message: "找不到這筆媒體" };

  // 先刪資料庫再刪物件。順序刻意如此：
  // 若先刪物件而資料庫刪除失敗，頁面上會留下指向已消失檔案的破圖；
  // 反過來則最多留下一個沒人參照的孤兒物件，代價低得多。
  const { error } = await supabase.from("portfolio_media").delete().eq("id", mediaId);
  if (error) return { ok: false, message: `刪除失敗：${error.message}` };

  const key = keyFromPublicUrl(media.url);
  if (key) {
    try {
      await deleteObject(key);
    } catch {
      // 物件刪不掉不該讓整個操作失敗——資料庫那筆已經沒了，畫面是正確的
    }
  }

  revalidatePath("/work");
  return { ok: true };
}

/** 拖曳排序（Spec §8.9） */
export async function reorderMedia(mediaIds: string[]): Promise<SimpleResult> {
  await requireStaff();

  const parsed = z.array(z.string().uuid()).max(100).safeParse(mediaIds);
  if (!parsed.success) return { ok: false, message: "排序參數不正確" };

  const supabase = await createSupabaseServerClient();

  const results = await Promise.all(
    parsed.data.map((id, index) =>
      supabase.from("portfolio_media").update({ sort_order: index }).eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return { ok: false, message: `排序失敗：${failed.error.message}` };

  revalidatePath("/work");
  return { ok: true };
}
