"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminIdentity } from "@/features/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { parseDuration } from "./engagement-types";

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

/* ------------------------------------------------------------------ */
/* 報價與成交（CR-004 / Phase B BE）                                    */
/* ------------------------------------------------------------------ */

const dealSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid(),
  title: z.string().trim().min(1, "報價名稱不可空白").max(200),
  stage: z.enum(["inquiry", "quoted", "negotiating", "won", "lost"]),
  /*
   * 金額可以留白（還沒報價），但填了就必須是數字。
   *
   * `.catch(null)` 會把打錯的字默默變成 null——那等於「金額不見了」，
   * 而使用者以為自己填了。所以這裡讓它紅。
   */
  amount: z.number().min(0).max(99999999).nullable(),
  expectedClose: z.union([z.iso.date(), z.literal("")]),
  lostReason: z.string().trim().max(500),
});

export async function saveDeal(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const rawAmount = text(formData, "amount");
  const parsed = dealSchema.safeParse({
    id: text(formData, "id") || undefined,
    clientId: text(formData, "clientId"),
    title: formData.get("title"),
    stage: formData.get("stage"),
    amount: rawAmount === "" ? null : Number(rawAmount),
    expectedClose: text(formData, "expectedClose"),
    lostReason: text(formData, "lostReason"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "輸入有誤" };
  }

  const data = parsed.data;

  /*
   * 「未成交」一定要寫原因，在這裡先擋。
   *
   * 資料庫也有 check constraint 擋著（那是真正的邊界），
   * 但那條會回一個看不懂的錯誤訊息。這裡擋是為了說人話。
   */
  if (data.stage === "lost" && !data.lostReason) {
    return { ok: false, message: "標成「未成交」要寫原因——那是這張表最有用的一欄。" };
  }

  const payload = {
    client_id: data.clientId,
    title: data.title,
    stage: data.stage,
    amount: data.amount,
    expected_close: data.expectedClose || null,
    // 不是 lost 就把原因清掉：留著一個舊原因會讓下次看的人以為它輸過
    lost_reason: data.stage === "lost" ? data.lostReason : null,
  };

  const supabase = await createSupabaseServerClient();

  const saved = data.id
    ? await supabase.from("deals").update(payload).eq("id", data.id).select("id").single()
    : await supabase.from("deals").insert(payload).select("id").single();

  if (saved.error) return { ok: false, message: `儲存失敗：${saved.error.message}` };

  revalidatePath("/admin/deals");
  revalidatePath(`/admin/clients/${data.clientId}`);
  return { ok: true, id: saved.data.id };
}

const dealItemSchema = z.object({
  dealId: z.uuid(),
  description: z.string().trim().min(1, "項目說明不可空白").max(300),
  quantity: z.number().positive().max(9999),
  unitPrice: z.number().min(0).max(99999999),
  serviceId: z.string().trim().max(40),
});

export async function addDealItem(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const parsed = dealItemSchema.safeParse({
    dealId: text(formData, "dealId"),
    description: formData.get("description"),
    quantity: Number(text(formData, "quantity") || "1"),
    unitPrice: Number(text(formData, "unitPrice") || "0"),
    serviceId: text(formData, "serviceId"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const supabase = await createSupabaseServerClient();

  // 排在最後面。查一次目前的最大值，而不是用筆數——刪過項目之後兩者會不一樣
  const { data: last } = await supabase
    .from("deal_items")
    .select("sort_order")
    .eq("deal_id", parsed.data.dealId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("deal_items").insert({
    deal_id: parsed.data.dealId,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unitPrice,
    service_id: parsed.data.serviceId || null,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) return { ok: false, message: `儲存失敗：${error.message}` };

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}

export async function deleteDealItem(formData: FormData): Promise<void> {
  await requireStaff();

  const id = text(formData, "id");
  const dealId = text(formData, "dealId");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("deal_items").delete().eq("id", id);

  revalidatePath(`/admin/deals/${dealId}`);
}

/* ------------------------------------------------------------------ */
/* 專案與工時（CR-004 / Phase B BF）                                    */
/* ------------------------------------------------------------------ */

const engagementSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid(),
  dealId: z.union([z.uuid(), z.literal("")]),
  title: z.string().trim().min(1, "專案名稱不可空白").max(200),
  status: z.enum(["planning", "active", "paused", "delivered", "closed"]),
  startedOn: z.union([z.iso.date(), z.literal("")]),
  dueOn: z.union([z.iso.date(), z.literal("")]),
  deliveredOn: z.union([z.iso.date(), z.literal("")]),
  portfolioProjectId: z.union([z.uuid(), z.literal("")]),
});

export async function saveEngagement(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const parsed = engagementSchema.safeParse({
    id: text(formData, "id") || undefined,
    clientId: text(formData, "clientId"),
    dealId: text(formData, "dealId"),
    title: formData.get("title"),
    status: formData.get("status"),
    startedOn: text(formData, "startedOn"),
    dueOn: text(formData, "dueOn"),
    deliveredOn: text(formData, "deliveredOn"),
    portfolioProjectId: text(formData, "portfolioProjectId"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const data = parsed.data;

  /*
   * 「已交付」要有交付日期。
   *
   * 沒有日期的已交付，之後回答不了「這個案子做了多久」——
   * 而那是估下一個案子時唯一有用的資料。
   */
  if ((data.status === "delivered" || data.status === "closed") && !data.deliveredOn) {
    return { ok: false, message: "標成已交付／已結案要填交付日期，不然之後算不出這案做了多久。" };
  }

  /*
   * 開始日不能晚於截止日。
   *
   * 這種顛倒多半是打字打錯（月份選錯），而錯了之後排程整個歪掉，
   * 畫面上卻只是兩個看起來都正常的日期。
   */
  if (data.startedOn && data.dueOn && data.startedOn > data.dueOn) {
    return { ok: false, message: "開始日期比截止日期晚，其中一個應該是打錯了。" };
  }

  const payload = {
    client_id: data.clientId,
    deal_id: data.dealId || null,
    title: data.title,
    status: data.status,
    started_on: data.startedOn || null,
    due_on: data.dueOn || null,
    delivered_on: data.deliveredOn || null,
    portfolio_project_id: data.portfolioProjectId || null,
  };

  const supabase = await createSupabaseServerClient();

  const saved = data.id
    ? await supabase.from("engagements").update(payload).eq("id", data.id).select("id").single()
    : await supabase.from("engagements").insert(payload).select("id").single();

  if (saved.error) return { ok: false, message: `儲存失敗：${saved.error.message}` };

  revalidatePath("/admin/engagements");
  revalidatePath(`/admin/clients/${data.clientId}`);
  return { ok: true, id: saved.data.id };
}

/**
 * 成交的報價開成專案。
 *
 * 與 `convertLeadToClient` 同一個模式：報價不會被改成專案，
 * 只是新的專案指回它。談的過程與做的過程是兩件事，
 * 而請款時「當初報多少」必須還查得到。
 */
export async function startEngagementFromDeal(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const dealId = text(formData, "dealId");
  if (!z.uuid().safeParse(dealId).success) return { ok: false, message: "報價不存在" };

  const supabase = await createSupabaseServerClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, client_id, title, stage")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return { ok: false, message: "找不到這筆報價" };

  // 已經開過就不要再開一個。第二次按下去會多一個一模一樣的專案
  const { data: existing } = await supabase
    .from("engagements")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();

  if (existing) return { ok: true, id: existing.id };

  const { data: created, error } = await supabase
    .from("engagements")
    .insert({
      client_id: deal.client_id,
      deal_id: deal.id,
      title: deal.title,
      status: "planning",
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: `開案失敗：${error.message}` };

  revalidatePath("/admin/engagements");
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true, id: created.id };
}

const milestoneSchema = z.object({
  engagementId: z.uuid(),
  title: z.string().trim().min(1, "里程碑名稱不可空白").max(200),
  dueOn: z.union([z.iso.date(), z.literal("")]),
  paymentRatio: z.number().min(0).max(100).nullable(),
});

export async function addMilestone(formData: FormData): Promise<BackofficeResult> {
  await requireStaff();

  const rawRatio = text(formData, "paymentRatio");
  const parsed = milestoneSchema.safeParse({
    engagementId: text(formData, "engagementId"),
    title: formData.get("title"),
    dueOn: text(formData, "dueOn"),
    paymentRatio: rawRatio === "" ? null : Number(rawRatio),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: last } = await supabase
    .from("milestones")
    .select("sort_order")
    .eq("engagement_id", parsed.data.engagementId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("milestones").insert({
    engagement_id: parsed.data.engagementId,
    title: parsed.data.title,
    due_on: parsed.data.dueOn || null,
    payment_ratio: parsed.data.paymentRatio,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) return { ok: false, message: `儲存失敗：${error.message}` };

  revalidatePath(`/admin/engagements/${parsed.data.engagementId}`);
  return { ok: true };
}

/**
 * 里程碑打勾／取消打勾。
 *
 * 用同一個 action 來回切，不是兩個：兩個的話「已完成又退回」
 * 這條路很容易只做一半，而那正是真的會發生的事。
 */
export async function toggleMilestone(formData: FormData): Promise<void> {
  await requireStaff();

  const id = text(formData, "id");
  const engagementId = text(formData, "engagementId");
  const done = text(formData, "done") === "true";
  if (!id) return;

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("milestones")
    // 打勾記今天；取消就清掉，不留一個舊日期
    .update({ done_on: done ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);

  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function deleteMilestone(formData: FormData): Promise<void> {
  await requireStaff();

  const id = text(formData, "id");
  const engagementId = text(formData, "engagementId");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("milestones").delete().eq("id", id);

  revalidatePath(`/admin/engagements/${engagementId}`);
}

export async function addTimeEntry(formData: FormData): Promise<BackofficeResult> {
  const identity = await requireStaff();

  const engagementId = text(formData, "engagementId");
  if (!z.uuid().safeParse(engagementId).success) return { ok: false, message: "專案不存在" };

  /*
   * 長度收「90」「1:30」「1.5h」幾種寫法。
   *
   * 要求每次心算成分鐘的話，實際發生的事是他不記——
   * 而沒記下來的工時等於沒發生過。
   */
  const minutes = parseDuration(text(formData, "duration"));
  if (minutes === null) {
    return { ok: false, message: "看不懂這個長度。可以寫 90、1:30、或 1.5h。" };
  }
  if (minutes > 1440) {
    return { ok: false, message: "一筆超過 24 小時，應該是打錯了——分成幾天記。" };
  }

  const workedOn = text(formData, "workedOn") || new Date().toISOString().slice(0, 10);
  if (!z.iso.date().safeParse(workedOn).success) return { ok: false, message: "日期看不懂" };

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("time_entries").insert({
    engagement_id: engagementId,
    worked_on: workedOn,
    minutes,
    note: text(formData, "note").slice(0, 500) || null,
    actor_id: identity.userId,
  });

  if (error) return { ok: false, message: `儲存失敗：${error.message}` };

  revalidatePath(`/admin/engagements/${engagementId}`);
  return { ok: true };
}

export async function deleteTimeEntry(formData: FormData): Promise<void> {
  await requireStaff();

  const id = text(formData, "id");
  const engagementId = text(formData, "engagementId");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("time_entries").delete().eq("id", id);

  revalidatePath(`/admin/engagements/${engagementId}`);
}
