import "server-only";

import { getMemberIdentity } from "@/features/account/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type SiteConfig, validateSiteConfig } from "./schema";

/**
 * 存下來的網站草稿（CR-003-4 / 定價 B）
 *
 * ── 讀出來一定要再驗一次 ──────────────────────────────────────
 *
 * 欄位是 jsonb，它保證的只有「這是合法 JSON」，不保證
 * 「這是合法的 SiteConfig」。而中間隔了一次序列化、一個資料庫，
 * 以及一個可能比現在的 schema 舊的版本。
 *
 * SiteRenderer 本身也會再驗一次（Spec §36），所以就算漏了也不會白畫面，
 * 但在這裡驗才講得出「這份草稿是舊版格式」而不是「這份設定有問題」。
 */

export interface SavedSiteSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export async function listSavedSites(): Promise<SavedSiteSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("saved_sites")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function loadSavedSite(
  id: string,
): Promise<{ ok: true; name: string; config: SiteConfig } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("saved_sites")
    .select("name, config")
    .eq("id", id)
    .maybeSingle();

  // RLS 已經擋掉別人的草稿，所以「找不到」與「不是你的」在這裡是同一件事。
  // 刻意不區分：區分等於告訴對方「這個 id 存在，只是不給你看」。
  if (!data) return { ok: false, error: "找不到這份草稿。" };

  const validated = validateSiteConfig(data.config);
  if (!validated.ok) {
    return { ok: false, error: "這份草稿的格式已經不支援了，可能是舊版本存的。" };
  }

  return { ok: true, name: data.name as string, config: validated.config };
}

export async function saveSite(
  name: string,
  config: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const identity = await getMemberIdentity();
  if (!identity) return { ok: false, error: "要先登入才能存檔。" };

  /*
   * 存進去之前先驗。
   *
   * config 從瀏覽器來，而瀏覽器來的東西是不可信輸入——即使產生它的是
   * 我們自己的編輯器。存一份壞掉的進去，壞掉的時間點會延後到某個人
   * 下次打開它，那時完全查不出是什麼時候壞的。
   */
  const validated = validateSiteConfig(config);
  if (!validated.ok) {
    return { ok: false, error: `這份設定有問題：${validated.errors[0]?.message ?? "格式不正確"}` };
  }

  const supabase = await createSupabaseServerClient();

  const trimmed = name.trim().slice(0, 80) || validated.config.brand.name || "未命名的網站";

  /*
   * 產生 id 並且不要求 RETURNING。
   *
   * Phase 5 的 leads 踩過一次：insert 成功但 `.select()` 被 RLS 擋下，
   * 看起來像「新增失敗（違反 RLS）」，實際上是**讀回**沒有權限。
   * saved_sites 的 select policy 允許本人讀，所以這裡其實回得來，
   * 但仍然自己產 id——少一次來回，也少一個依賴 policy 細節的地方。
   */
  const id = crypto.randomUUID();

  const { error } = await supabase.from("saved_sites").insert({
    id,
    owner_id: identity.userId,
    name: trimmed,
    config: validated.config,
  });

  if (error) {
    // 每人 20 份的上限由資料庫 trigger 擋，訊息直接轉給使用者
    return { ok: false, error: error.message.includes("20 份") ? error.message : "存檔失敗。" };
  }

  return { ok: true, id };
}

export async function deleteSavedSite(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("saved_sites").delete().eq("id", id);
}
