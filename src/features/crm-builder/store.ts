import "server-only";

import { getMemberIdentity } from "@/features/account/auth";
import { describeSaveError } from "@/lib/supabase/save-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  CRM_LIMITS,
  type CrmDefinition,
  type CrmEntity,
  recordSchemaFor,
  validateCrmDefinition,
} from "./schema";

/**
 * 存下來的 CRM 設計與記錄（CR-003-5）
 *
 * ── 定價與網站編輯器一致 ──────────────────────────────────────
 *
 * 設計免費、不用登入（狀態在 sessionStorage）；**存下來**才要帳號。
 * 訪客排了十分鐘之後，「要留下來」才是掏錢的理由。
 *
 * ── 讀出來一定要再驗一次 ──────────────────────────────────────
 *
 * `definition` 是 jsonb，它保證的只有「這是合法 JSON」。
 * 中間隔了一次序列化、一個資料庫，以及一個可能比現在的 schema 舊的版本。
 */

export interface CrmSummary {
  id: string;
  name: string;
  updatedAt: string;
  /** 這份設計底下有幾筆記錄 */
  records: number;
}

export async function listCrmDesigns(): Promise<CrmSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("crm_definitions")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });

  const designs = data ?? [];
  if (designs.length === 0) return [];

  /*
   * 筆數一次查完，不是一份一份查。
   *
   * ⚠️ 每一份各查一次是 N+1：十份設計就是十一次往返，
   * 而這一頁的價值正是「一眼看出哪一份有東西」。
   *
   * 只取 id 欄位（`head` 不行——要拿到 definition_id 才分得出是哪一份），
   * 在記憶體數。上限是 10 份 × 500 筆，最壞情況 5000 個 uuid，
   * 比十一次往返便宜得多。
   */
  const { data: rows } = await supabase
    .from("crm_records")
    .select("definition_id")
    .in(
      "definition_id",
      designs.map((row) => row.id as string),
    );

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = row.definition_id as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return designs.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    updatedAt: row.updated_at as string,
    records: counts.get(row.id as string) ?? 0,
  }));
}

export async function loadCrmDesign(
  id: string,
): Promise<{ ok: true; definition: CrmDefinition } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("crm_definitions")
    .select("definition")
    .eq("id", id)
    .maybeSingle();

  // RLS 已經擋掉別人的設計，所以「找不到」與「不是你的」在這裡是同一件事。
  // 刻意不區分：區分等於告訴對方「這個 id 存在，只是不給你看」。
  if (!data) return { ok: false, error: "找不到這份設計，或它不是你的。" };

  const validated = validateCrmDefinition(data.definition);
  if (!validated.ok) {
    return { ok: false, error: "這份設計的格式已經不支援了，可能是舊版本存的。" };
  }

  return { ok: true, definition: validated.definition };
}

/** `id` 有給就是更新那一份，沒給就是新增 */
export async function saveCrmDesign(
  input: unknown,
  id?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const identity = await getMemberIdentity();
  if (!identity) return { ok: false, error: "要先登入才能存檔。" };

  /*
   * 存進去之前先驗。
   *
   * 這份東西從瀏覽器來，而瀏覽器來的東西是不可信輸入——即使產生它的
   * 是我們自己的設計器。存一份壞掉的進去，壞掉的時間點會延後到
   * 某個人下次打開它，那時完全查不出是什麼時候壞的。
   */
  const validated = validateCrmDefinition(input);
  if (!validated.ok) {
    return { ok: false, error: `這份設計有問題：${validated.errors[0]?.message ?? "格式不正確"}` };
  }

  const definition = validated.definition;
  const supabase = await createSupabaseServerClient();

  if (id) {
    const { error, count } = await supabase
      .from("crm_definitions")
      .update({ name: definition.name, definition }, { count: "exact" })
      .eq("id", id)
      .eq("owner_id", identity.userId);

    if (error) {
      return { ok: false, error: describeSaveError("saveCrmDesign（更新）", error, "存檔失敗。") };
    }
    // 0 列被更新＝那一份不存在或不是你的。當作新增比較危險（會偷偷多一份）
    if (count === 0) return { ok: false, error: "找不到要更新的那一份設計。" };

    return { ok: true, id };
  }

  const newId = crypto.randomUUID();

  const { error } = await supabase.from("crm_definitions").insert({
    id: newId,
    owner_id: identity.userId,
    name: definition.name,
    definition,
  });

  if (error) {
    // 上限訊息（每人 10 份）與已知的約束錯誤由 describeSaveError 轉成人話，
    // 其餘一律記下原始錯誤再回這句籠統的
    return { ok: false, error: describeSaveError("saveCrmDesign（新增）", error, "存檔失敗。") };
  }

  return { ok: true, id: newId };
}

export async function deleteCrmDesign(id: string): Promise<void> {
  // RLS 保證只刪得掉自己的
  const supabase = await createSupabaseServerClient();
  await supabase.from("crm_definitions").delete().eq("id", id);
}

/* ------------------------------------------------------------------ */
/* 記錄                                                                */
/* ------------------------------------------------------------------ */

export interface CrmRecord {
  id: string;
  entity: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export async function listCrmRecords(definitionId: string, entity: string): Promise<CrmRecord[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("crm_records")
    .select("id, entity, data, created_at")
    .eq("definition_id", definitionId)
    .eq("entity", entity)
    .order("created_at", { ascending: false })
    .limit(500);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    entity: row.entity as string,
    data: (row.data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }));
}

/**
 * 這份設計底下的**全部**記錄（不分類別）。
 *
 * Dashboard 用。一次撈回來在記憶體算，而不是每個類別、每個欄位各查一次：
 * 每份設計最多 500 筆（資料庫的 trigger 擋著），一次查完最省，
 * 而且各項統計之間保證看到同一份資料——分次查的話，
 * 中間有人新增一筆，畫面上的數字就會互相對不起來。
 */
export async function listAllCrmRecords(definitionId: string): Promise<CrmRecord[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("crm_records")
    .select("id, entity, data, created_at")
    .eq("definition_id", definitionId)
    .order("created_at", { ascending: false })
    .limit(CRM_LIMITS.recordsPerDefinition);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    entity: row.entity as string,
    data: (row.data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }));
}

/**
 * 新增一筆記錄。
 *
 * ⚠️ **驗證用的 schema 由使用者的定義算出來**，不是一份固定的 schema。
 * 那正是這整個功能的重點，也是為什麼記錄不能拆成關聯表。
 *
 * ⚠️ 定義從資料庫讀，**不從表單來**。表單帶定義的話，
 * 任何人都能送一份「所有欄位都不必填、select 什麼都收」的定義過來，
 * 驗證就等於沒有。
 */
export async function addCrmRecord(
  definitionId: string,
  entityId: string,
  values: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const identity = await getMemberIdentity();
  if (!identity) return { ok: false, error: "要先登入才能存記錄。" };

  const design = await loadCrmDesign(definitionId);
  if (!design.ok) return { ok: false, error: design.error };

  const entity: CrmEntity | undefined = design.definition.entities.find(
    (item) => item.id === entityId,
  );
  if (!entity) return { ok: false, error: "這份設計裡沒有這一類。" };

  const parsed = recordSchemaFor(entity).safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const label = entity.fields.find((field) => field.id === issue?.path[0])?.label;
    return { ok: false, error: label ? `「${label}」${issue?.message}` : "這筆資料有問題。" };
  }

  const supabase = await createSupabaseServerClient();

  /*
   * owner_id 刻意不送。
   *
   * 它由資料庫的 trigger 從 definition 抄過來——送一個值過去的話，
   * 這裡就多了一條「可能填錯」的路徑，而填錯的後果是一筆
   * 寫進別人 CRM 的資料。
   */
  const { error } = await supabase.from("crm_records").insert({
    definition_id: definitionId,
    entity: entityId,
    data: parsed.data,
  });

  if (error) {
    return { ok: false, error: describeSaveError("addCrmRecord", error, "存記錄失敗。") };
  }

  return { ok: true };
}

/**
 * 一次寫入很多筆（匯入用）。
 *
 * ── 為什麼不是「呼叫 addCrmRecord 三百次」 ────────────────────
 *
 * 三百次來回慢是其次，真正的問題是**中途失敗會留下一半**：
 * 第 180 筆撞到上限的話，前面 179 筆已經進去了，而使用者看到的是
 * 一個失敗訊息——他不會知道要去刪那 179 筆。
 *
 * 一次 insert 是一個交易：要嘛整批進去，要嘛一筆都沒有。
 *
 * ── 上限先算，不要讓 trigger 去擋 ────────────────────────────
 *
 * 資料庫的 trigger 是最後一道，但它的訊息是給我們看的。
 * 這裡先算「還放得下幾筆」，才有辦法說出「只匯得進 120 筆，
 * 剩下的 180 筆要先刪掉一些舊記錄」這種使用者做得到的下一步。
 */
export async function addCrmRecords(
  definitionId: string,
  entityId: string,
  rows: readonly { line: number; values: unknown }[],
): Promise<
  | { ok: true; inserted: number; problems: { line: number; message: string }[] }
  | { ok: false; error: string }
> {
  const identity = await getMemberIdentity();
  if (!identity) return { ok: false, error: "要先登入才能匯入。" };

  if (rows.length === 0) return { ok: false, error: "這個檔案裡沒有可以匯入的資料。" };

  const design = await loadCrmDesign(definitionId);
  if (!design.ok) return { ok: false, error: design.error };

  const entity = design.definition.entities.find((item) => item.id === entityId);
  if (!entity) return { ok: false, error: "這份設計裡沒有這一類。" };

  /*
   * ⚠️ 每一筆都要在伺服器端再驗一次。
   *
   * 瀏覽器那邊已經驗過了，而那**不算數**——這是一個公開端點，
   * 送什麼過來由對方決定。用的是與手動新增同一份 `recordSchemaFor`，
   * 兩條路徑不可能有不同的鬆緊。
   */
  const schema = recordSchemaFor(entity);
  const valid: Record<string, unknown>[] = [];
  const problems: { line: number; message: string }[] = [];

  for (const row of rows) {
    const parsed = schema.safeParse(row.values);
    if (parsed.success) {
      valid.push(parsed.data);
      continue;
    }
    const issue = parsed.error.issues[0];
    const label = entity.fields.find((field) => field.id === issue?.path[0])?.label;
    problems.push({
      line: row.line,
      message: label ? `「${label}」${issue?.message ?? "格式不對"}` : "這一列的格式不對",
    });
  }

  if (valid.length === 0) {
    return { ok: false, error: "每一列都有問題，一筆都匯不進去。" };
  }

  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("crm_records")
    .select("id", { count: "exact", head: true })
    .eq("definition_id", definitionId);

  const room = CRM_LIMITS.recordsPerDefinition - (count ?? 0);
  if (room <= 0) {
    return {
      ok: false,
      error: `這份 CRM 已經有 ${CRM_LIMITS.recordsPerDefinition} 筆記錄了，要先刪掉一些才匯得進去。`,
    };
  }

  if (valid.length > room) {
    return {
      ok: false,
      error: `這份 CRM 只剩 ${room} 個位子，而檔案裡有 ${valid.length} 筆。請先刪掉一些舊記錄，或把檔案拆小一點。`,
    };
  }

  // owner_id 一樣不送——由 trigger 從 definition 抄過來（見 addCrmRecord）
  const { error } = await supabase.from("crm_records").insert(
    valid.map((data) => ({
      definition_id: definitionId,
      entity: entityId,
      data,
    })),
  );

  if (error) {
    return { ok: false, error: describeSaveError("addCrmRecords", error, "匯入失敗。") };
  }

  return { ok: true, inserted: valid.length, problems };
}

export async function deleteCrmRecord(recordId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("crm_records").delete().eq("id", recordId);
}
