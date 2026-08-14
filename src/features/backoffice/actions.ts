"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminIdentity } from "@/features/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 後台 CRM 的寫入操作（CR-004 / Phase B BD）
 *
 * ⚠️ 三件事每個 action 都必須做（與 features/admin/actions.ts 同一套）：
 *   1. 驗證身分——Server Action 的網址是公開的
 *   2. 驗證輸入（zod）
 *   3. 讓 RLS 當最後一道關（帶 cookie 的 anon client，不是 service role）
 */

export type BackofficeResult = { ok: true; id?: string } | { ok: false; message: string };

async function requireStaff() {
  const identity = await getAdminIdentity();
  // 不說明原因：對方若不是後台人員，連「這裡有後台」都不該確認
  if (!identity) throw new Error("Not found");
  return identity;
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

const clientSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "客戶名稱不可空白").max(200),
  kind: z.enum(["company", "individual"]),
  industry: z.string().trim().max(60).optional(),
  status: z.enum(["prospect", "active", "past"]),
  source: z.string().trim().max(60).optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function saveClient(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const parsed = clientSchema.safeParse({
    id: text(formData, "id") || undefined,
    name: formData.get("name"),
    kind: formData.get("kind"),
    industry: text(formData, "industry") || undefined,
    status: formData.get("status"),
    source: text(formData, "source") || undefined,
    note: text(formData, "note") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const { id, ...rest } = parsed.data;
  const payload = {
    ...rest,
    // 空字串與 undefined 都要變成 null，否則清空欄位會留下一個空字串
    industry: rest.industry ?? null,
    source: rest.source ?? null,
    note: rest.note ?? null,
  };

  const supabase = await createSupabaseServerClient();

  const saved = id
    ? await supabase.from("clients").update(payload).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(payload).select("id").single();

  if (saved.error) return { ok: false, message: `儲存失敗：${saved.error.message}` };

  revalidatePath("/admin/clients");
  return { ok: true, id: saved.data.id };
}

const contactSchema = z.object({
  clientId: z.uuid(),
  name: z.string().trim().min(1, "聯絡人姓名不可空白").max(120),
  email: z.union([z.email("Email 格式不正確"), z.literal("")]),
  phone: z.string().trim().max(40),
  title: z.string().trim().max(60),
  isPrimary: z.boolean(),
});

export async function saveContact(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const parsed = contactSchema.safeParse({
    clientId: text(formData, "clientId"),
    name: formData.get("name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    title: text(formData, "title"),
    isPrimary: formData.get("isPrimary") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const supabase = await createSupabaseServerClient();

  /*
   * 設為主要聯絡人時，先把同一個客戶的其他人取消。
   *
   * 資料庫有部分唯一索引擋住「兩位主要聯絡人」，但那個索引會讓
   * insert 直接失敗——而使用者看到的是一個看不懂的資料庫錯誤。
   * 在這裡先讓位，行為才是他預期的「改成這一位」。
   */
  if (parsed.data.isPrimary) {
    await supabase
      .from("client_contacts")
      .update({ is_primary: false })
      .eq("client_id", parsed.data.clientId);
  }

  const { error } = await supabase.from("client_contacts").insert({
    client_id: parsed.data.clientId,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    title: parsed.data.title || null,
    is_primary: parsed.data.isPrimary,
  });

  if (error) return { ok: false, message: `儲存失敗：${error.message}` };

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true };
}

export async function deleteContact(formData: FormData): Promise<void> {
  await requireStaff();

  const id = text(formData, "id");
  const clientId = text(formData, "clientId");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("client_contacts").delete().eq("id", id);

  revalidatePath(`/admin/clients/${clientId}`);
}

export async function addNote(formData: FormData): Promise<void> {
  const identity = await requireStaff();

  const subjectType = text(formData, "subjectType");
  const subjectId = text(formData, "subjectId");
  const body = text(formData, "body");

  // 空備註不存。存了之後時間軸上會多一則什麼都沒說的紀錄
  if (!body || !subjectId) return;
  if (!["client", "contact", "deal", "engagement"].includes(subjectType)) return;

  const supabase = await createSupabaseServerClient();

  await supabase.from("notes").insert({
    subject_type: subjectType,
    subject_id: subjectId,
    body,
    // 目前一律內部。開放客戶檢視時，這個旗標就是那條線
    internal: true,
    author_id: identity.userId,
  });

  revalidatePath(`/admin/clients/${subjectId}`);
}

/**
 * 把一筆詢問轉成客戶。
 *
 * ⚠️ 這是一個**明確的動作**，不是自動的。
 * 自動轉的話，一堆試填的假詢問會變成一堆假客戶，
 * 而清掉它們比當初不要自動轉費事得多。
 *
 * lead 本身完全不動——它是訪客當時說的話，是證據。
 * 只在它身上補一個 client_id 指過去。
 */
export async function convertLeadToClient(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const leadId = text(formData, "leadId");
  if (!leadId) return { ok: false, message: "缺少詢問編號" };

  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, client_id, business_name, business_industry, contact_name, contact_email, contact_phone",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, message: "找不到這筆詢問" };
  if (lead.client_id) return { ok: false, message: "這筆詢問已經轉成客戶了" };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: lead.business_name || lead.contact_name || "（未命名客戶）",
      kind: lead.business_name ? "company" : "individual",
      industry: lead.business_industry,
      status: "prospect",
      source: "lead",
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: `建立客戶失敗：${error.message}` };

  // 詢問裡有聯絡方式的話一併帶過來，省得再打一次
  if (lead.contact_name || lead.contact_email || lead.contact_phone) {
    await supabase.from("client_contacts").insert({
      client_id: client.id,
      name: lead.contact_name || lead.contact_email || "（未命名）",
      email: lead.contact_email,
      phone: lead.contact_phone,
      is_primary: true,
    });
  }

  await supabase.from("leads").update({ client_id: client.id }).eq("id", leadId);

  revalidatePath("/admin/inbox");
  revalidatePath("/admin/clients");
  return { ok: true, id: client.id };
}
