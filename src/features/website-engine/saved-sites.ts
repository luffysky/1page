import "server-only";

import { getMemberIdentity } from "@/features/account/auth";
import { describeSaveError } from "@/lib/supabase/save-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type EditorState, editorStateSchema } from "./editor-state";
import { validateSiteConfig } from "./schema";
import { buildSiteConfig, getTemplate } from "./templates";

/**
 * 存下來的網站草稿（CR-003-4 / 定價 B）
 *
 * ── 存的是輸入，不是成品 ──────────────────────────────────────
 *
 * 見 `20260814000009_saved_sites_draft.sql`。這張表原本存整份 SiteConfig，
 * 結果是存得進去、載不回編輯器——成品裡沒有「當初選的是哪一套模板」。
 *
 * 現在存的是編輯器狀態本身，與 sessionStorage 同一份 schema。
 *
 * ── 讀出來一定要再驗一次 ──────────────────────────────────────
 *
 * 欄位是 jsonb，它保證的只有「這是合法 JSON」，不保證
 * 「這是合法的編輯器狀態」。而中間隔了一次序列化、一個資料庫，
 * 以及一個可能比現在的 schema 舊的版本。
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
): Promise<{ ok: true; name: string; draft: EditorState } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("saved_sites")
    .select("name, draft")
    .eq("id", id)
    .maybeSingle();

  // RLS 已經擋掉別人的草稿，所以「找不到」與「不是你的」在這裡是同一件事。
  // 刻意不區分：區分等於告訴對方「這個 id 存在，只是不給你看」。
  if (!data) return { ok: false, error: "找不到這份草稿，或它不是你的。" };

  const validated = editorStateSchema.safeParse(data.draft);
  if (!validated.success) {
    return { ok: false, error: "這份草稿的格式已經不支援了，可能是舊版本存的。" };
  }

  /*
   * 模板可能在存檔之後被移除。
   *
   * 不擋的話，編輯器會退回第一套模板繼續跑，畫面上完全看不出換過——
   * 使用者以為自己存的東西被改掉了。
   */
  if (!getTemplate(validated.data.templateId)) {
    return { ok: false, error: "這份草稿用的版型已經下架了。" };
  }

  return { ok: true, name: data.name as string, draft: validated.data };
}

/**
 * 存檔。`id` 有給就是更新那一份，沒給就是新增。
 *
 * ⚠️ 沒有「更新」這條路的話，載入草稿改一個字再存就會多出一份幾乎一樣的東西，
 * 二十份的上限會被自己的修改記錄塞滿。
 */
export async function saveSite(
  name: string,
  draft: unknown,
  id?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const identity = await getMemberIdentity();
  if (!identity) return { ok: false, error: "要先登入才能存檔。" };

  /*
   * 存進去之前先驗。
   *
   * draft 從瀏覽器來，而瀏覽器來的東西是不可信輸入——即使產生它的是
   * 我們自己的編輯器。存一份壞掉的進去，壞掉的時間點會延後到某個人
   * 下次打開它，那時完全查不出是什麼時候壞的。
   */
  const validated = editorStateSchema.safeParse(draft);
  if (!validated.success) {
    return {
      ok: false,
      error: `這份設定有問題：${validated.error.issues[0]?.message ?? "格式不正確"}`,
    };
  }

  const template = getTemplate(validated.data.templateId);
  if (!template) return { ok: false, error: "這份設定指向一套不存在的版型。" };

  /*
   * 再確認它真的算得出一份合法的 SiteConfig。
   *
   * schema 過了只代表「每個欄位的型別對」，不代表「組起來畫得出來」。
   * 這一步存的結果不會用到，要的是**現在**就知道，而不是等使用者
   * 下次打開它才發現打不開——那時已經查不出是哪一次存壞的。
   */
  const state = validated.data;
  const base = buildSiteConfig({
    templateId: state.templateId,
    themeId: state.themeId,
    accentId: state.accentId,
    brandName: state.brandName,
    industry: state.industry,
  });
  const renderable = validateSiteConfig(
    state.sections ? { ...base, sections: state.sections } : base,
  );
  if (!renderable.ok) {
    return { ok: false, error: "這份設定目前畫不出來，請先把畫面上顯示錯誤的區塊修好。" };
  }

  const supabase = await createSupabaseServerClient();
  const trimmed = name.trim().slice(0, 80) || state.brandName || "未命名的網站";

  if (id) {
    /*
     * 更新。owner_id 條件刻意留著，雖然 RLS 已經擋掉別人的列——
     * 兩層之中任何一層失效，另一層仍然成立。
     */
    const { error, count } = await supabase
      .from("saved_sites")
      .update({ name: trimmed, draft: state }, { count: "exact" })
      .eq("id", id)
      .eq("owner_id", identity.userId);

    if (error) {
      return { ok: false, error: describeSaveError("saveSite（更新）", error, "存檔失敗。") };
    }
    // 0 列被更新＝那一份不存在或不是你的。當作新增比較危險（會偷偷多一份），
    // 直接說找不到。
    if (count === 0) return { ok: false, error: "找不到要更新的那一份草稿。" };

    return { ok: true, id };
  }

  /*
   * 產生 id 並且不要求 RETURNING。
   *
   * Phase 5 的 leads 踩過一次：insert 成功但 `.select()` 被 RLS 擋下，
   * 看起來像「新增失敗（違反 RLS）」，實際上是**讀回**沒有權限。
   * saved_sites 的 select policy 允許本人讀，所以這裡其實回得來，
   * 但仍然自己產 id——少一次來回，也少一個依賴 policy 細節的地方。
   */
  const newId = crypto.randomUUID();

  const { error } = await supabase.from("saved_sites").insert({
    id: newId,
    owner_id: identity.userId,
    name: trimmed,
    draft: state,
  });

  if (error) {
    // 見 saveCrmDesign 的同一段：上限與已知約束轉人話，其餘記下原始錯誤
    return { ok: false, error: describeSaveError("saveSite（新增）", error, "存檔失敗。") };
  }

  return { ok: true, id: newId };
}

export async function deleteSavedSite(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("saved_sites").delete().eq("id", id);
}
