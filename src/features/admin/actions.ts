"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toAdminUrl } from "@/config/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getAdminIdentity } from "./auth";

/**
 * 後台的寫入操作（Spec §8.8）。
 *
 * ── 三件事每個 action 都必須做 ──────────────────────────────
 *   1. 驗證身分（不能假設呼叫端已經驗過——Server Action 的網址是公開的）
 *   2. 驗證輸入（Zod，Spec §36）
 *   3. 讓 RLS 當最後一道關（用帶 cookie 的 anon client，不是 service role）
 *
 * ⚠️ Server Action 會被編譯成一個可從瀏覽器直接呼叫的端點。
 * 「這個按鈕只有 admin 看得到」完全不構成保護——任何人都能自己組出請求。
 * 因此每一支都獨立驗證，而不是倚賴頁面層的 requireAdmin()。
 */

async function requireStaff() {
  const identity = await getAdminIdentity();
  if (!identity) {
    // 不說明原因：對方若不是後台人員，連「這裡有後台」都不該確認
    throw new Error("Not found");
  }
  return identity;
}

const slugSchema = z
  .string()
  .trim()
  .min(1, "網址代稱不可空白")
  .max(80, "網址代稱過長")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "只能使用小寫英數與連字號，且不可連續或前後有連字號");

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().trim().min(1, "標題不可空白").max(200),
  kicker: z.string().trim().max(120).optional().or(z.literal("")),
  summary: z.string().trim().max(500).optional().or(z.literal("")),
  project_type: z.enum(["client", "concept", "demo", "internal"]),
  featured: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export type ActionResult = { ok: true } | { ok: false; message: string };

function readForm(formData: FormData) {
  return projectSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    kicker: formData.get("kicker") ?? "",
    summary: formData.get("summary") ?? "",
    project_type: formData.get("project_type"),
    featured: formData.get("featured") === "on",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
}

function revalidateAll(slug?: string) {
  // 公開頁面全部是動態渲染，但 revalidate 仍會清掉 Next 的 Router Cache，
  // 讓管理者存檔後立刻在前台看到結果，而不是等快取自然過期
  revalidatePath("/");
  revalidatePath("/work");
  if (slug) revalidatePath(`/work/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function saveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const { id, kicker, summary, ...rest } = parsed.data;
  const payload = {
    ...rest,
    kicker: kicker || null,
    summary: summary || null,
  };

  const supabase = await createSupabaseServerClient();

  const { error } = id
    ? await supabase.from("portfolio_projects").update(payload).eq("id", id)
    : await supabase.from("portfolio_projects").insert({ ...payload, status: "draft" });

  if (error) {
    // 唯一鍵衝突給出可讀訊息，而不是把資料庫錯誤原文丟給使用者
    if (error.code === "23505") return { ok: false, message: "這個網址代稱已經有人用了" };
    return { ok: false, message: `儲存失敗：${error.message}` };
  }

  revalidateAll(payload.slug);
  return { ok: true };
}

/**
 * 發布 / 下架。
 *
 * `published_at` 由此處一併設定：資料庫有 `published_has_timestamp` 約束
 * （已發布必有時間、未發布必無），漏設會被資料庫擋下來。
 */
export async function setProjectStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, message: `狀態更新失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}

export async function setProjectFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .update({ featured })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, message: `更新失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}

/**
 * 刪除。
 *
 * 刻意不提供「一鍵刪除」的快捷入口——Spec §8.8 雖然列了 Delete，
 * 但作品是累積型資產（Spec §44 的飛輪），誤刪的代價遠高於封存。
 * 因此後台列表只提供封存，刪除需進到編輯頁並明確確認。
 */
export async function deleteProject(id: string): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
  if (error) return { ok: false, message: `刪除失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}

/** 供表單存檔後導回列表 */
export async function adminListUrl(): Promise<string> {
  return toAdminUrl("/admin/portfolio");
}
