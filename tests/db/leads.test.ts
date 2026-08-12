import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Leads 的邊界驗證（Spec §19 / §38 / Phase 5D）
 *
 * `leads` 存的是**真人的聯絡方式與商業資訊**——信箱、電話、他在做什麼。
 * 這是全站個資密度最高的一張表，所以邊界要一條一條驗，
 * 而且要用真實身分驗：service role 會繞過所有 policy，用它測等於沒測。
 *
 * 與其他 db 測試一樣不納入 `pnpm test`，用 `pnpm test:db` 執行。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = "Pr0be!Leads#2026";
const MEMBER = "lead-member@1page.test";
const OUTSIDER = "lead-outsider@1page.test";

const createdUsers: string[] = [];
const createdLeads: string[] = [];

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
  });
}

async function sql(query: string) {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function createMember(email: string) {
  // 前一次跑到一半被中斷時可能留下殘骸
  const existing = await sql(`select id from auth.users where email = '${email}'`);
  for (const row of existing) await adminFetch(`/users/${row.id}`, { method: "DELETE" });

  const response = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error(`建立探測帳號失敗：${JSON.stringify(body)}`);
  createdUsers.push(body.id);
  return body.id;
}

async function signIn(email: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`探測帳號登入失敗（${email}）：${error.message}`);
  return client;
}

const anonClient = () => createClient(url!, anonKey!, { auth: { persistSession: false } });

describe("Leads", () => {
  let memberId: string;
  let memberClient: Awaited<ReturnType<typeof signIn>>;
  let outsiderClient: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) {
      throw new Error(
        "缺少 Supabase 環境變數。這個測試不會靜默跳過——安全邊界沒驗證過就是沒驗證過。",
      );
    }

    memberId = await createMember(MEMBER);
    await createMember(OUTSIDER);
    memberClient = await signIn(MEMBER);
    outsiderClient = await signIn(OUTSIDER);
  }, 90_000);

  afterAll(async () => {
    for (const id of createdLeads) {
      await sql(`delete from public.leads where id = '${id}'`);
    }
    for (const id of createdUsers) {
      await adminFetch(`/users/${id}`, { method: "DELETE" });
    }
  }, 60_000);

  it("匿名訪客可以留下需求", async () => {
    // Spec §37：匿名是預設。不能因為沒登入就不准留下需求——
    // 那正好把最需要被聯絡的人擋在門外。
    //
    // ⚠️ id 由呼叫端產生、插入時不要求回傳，與 repository.ts 的作法一致。
    const id = crypto.randomUUID();
    const { error } = await anonClient()
      .from("leads")
      .insert({ id, contact_email: "anon@example.com", business_name: "匿名測試" });

    expect(error).toBeNull();
    createdLeads.push(id);

    const rows = await sql(`select id from public.leads where id = '${id}'`);
    expect(rows).toHaveLength(1);
  });

  it("匿名插入時要求回傳資料會失敗——這是陷阱，不是能力問題", async () => {
    // 這條把 5D 實作時真的踩到的坑釘住。
    //
    // `.insert(...).select("id")` 需要 SELECT 權限才能把剛插入的那列回傳，
    // 而 leads 的 select policy 只開給員工與本人。PostgreSQL 把它報成
    // 「new row violates row-level security policy」——看起來像插入被擋，
    // 實際上被擋的是讀回來那一步。
    //
    // 照那個錯誤訊息去放寬 insert policy 是無效的，放寬 select policy
    // 則會把整份聯絡名單開給所有人。正確的作法是不要求回傳。
    const { error } = await anonClient()
      .from("leads")
      .insert({ contact_email: "trap@example.com" })
      .select("id");

    expect(error?.code).toBe("42501");

    // 而且失敗會回滾，不會留下幽靈資料。
    const rows = await sql(`select id from public.leads where contact_email = 'trap@example.com'`);
    expect(rows).toHaveLength(0);
  });

  it("匿名訪客讀不到任何 lead，包含自己剛留的", async () => {
    // 這條是整張表最重要的一條。leads 裡是別人的信箱與電話；
    // 匿名讀得到的話，任何人都能把整份名單抓走。
    const { data, error } = await anonClient().from("leads").select("id, contact_email");

    // RLS 擋下 select 的表現是「查得到零筆」，不是錯誤。
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("會員留的 lead 綁到自己的帳號，而且讀得回來", async () => {
    const id = crypto.randomUUID();
    const { error } = await memberClient.from("leads").insert({
      id,
      profile_id: memberId,
      contact_email: MEMBER,
      business_name: "會員測試",
    });

    expect(error).toBeNull();
    createdLeads.push(id);

    const own = await memberClient.from("leads").select("id, business_name");
    expect(own.data?.length).toBeGreaterThan(0);
    expect(own.data?.every((row) => row.business_name === "會員測試")).toBe(true);
  });

  it("會員讀不到別人的 lead", async () => {
    // 「會員可以看自己的紀錄」很容易寫成「登入就看得到」。
    // 這條是那個錯誤的偵測器。
    const { data } = await outsiderClient.from("leads").select("id, contact_email");

    expect(data).toEqual([]);
  });

  it("會員不能改自己留下的 lead", async () => {
    // 允許事後改寫，等於打開一條「業務已經照舊版聯絡了、內容卻被換掉」的路。
    // 更新一律只有員工能做。
    const target = createdLeads[createdLeads.length - 1];

    const { data } = await memberClient
      .from("leads")
      .update({ business_name: "改過的名字" })
      .eq("id", target!)
      .select("id");

    // 沒有符合 policy 的列可以更新 → 影響零列，不是錯誤。
    expect(data).toEqual([]);

    const after = await sql(`select business_name from public.leads where id = '${target}'`);
    expect(after[0].business_name).toBe("會員測試");
  });

  it("沒有人可以刪除 lead", async () => {
    // 刻意沒有 delete policy：lead 是聯絡紀錄，不該被誰順手刪掉。
    const target = createdLeads[0];

    await memberClient.from("leads").delete().eq("id", target!);
    await anonClient().from("leads").delete().eq("id", target!);

    const rows = await sql(`select id from public.leads where id = '${target}'`);
    expect(rows).toHaveLength(1);
  });

  it("匿名之間互相讀不到（profile_id 都是 null）", async () => {
    // 這條看起來與「匿名讀不到任何 lead」重複，但守的是不同的東西：
    // select_own 的條件是 `profile_id = auth.uid()`，兩邊都是 null 時
    // SQL 的三值邏輯讓它不成立。若有人哪天把它改成 `is not distinct from`，
    // 所有匿名 lead 就會互相看得到，而上面那條測試仍然是綠的。
    const policy = await sql(
      `select qual from pg_policies where tablename = 'leads' and policyname = 'leads_select_own'`,
    );

    expect(policy[0].qual).not.toMatch(/is not distinct from/i);
  });
});
