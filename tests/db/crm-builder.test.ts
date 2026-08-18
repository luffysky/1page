import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 訪客自己設計的 CRM：資料層的邊界（CR-003-5）
 *
 * ── 這一組模擬「有人直接拿 anon key 打 REST API」 ─────────────
 *
 * 不經過我們的任何前端程式碼，也不經過 server action。
 * 這裡讀得到別人的資料的話，畫面上藏得再乾淨都沒有意義（Spec §41）。
 *
 * 這一塊比 saved_sites 多一個東西要證明：**crm_records 有兩個擁有者概念**
 * ——記錄自己的 owner_id，以及它掛在誰的定義底下。兩者不一致的話，
 * 一個人就能往別人的 CRM 裡寫資料。所以最重要的一條在最後面。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = "Crm!Probe#2026";
const MEMBER_A = "crm-probe-a@1page.test";
const MEMBER_B = "crm-probe-b@1page.test";

const DEFINITION = {
  name: "探測用的 CRM",
  entities: [
    {
      id: "thing-1",
      name: "東西",
      fields: [
        { id: "text-1", label: "名字", type: "text", required: true, options: [], hint: "" },
      ],
    },
  ],
};

const created: string[] = [];

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

async function createMember(email: string): Promise<string> {
  const response = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error(`建立探測帳號失敗：${JSON.stringify(body)}`);
  created.push(body.id);
  return body.id;
}

async function signIn(email: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`探測帳號登入失敗（${email}）：${error.message}`);
  return client;
}

describe("CRM 設計器的資料邊界", () => {
  let idA: string;
  let idB: string;
  let clientA: Awaited<ReturnType<typeof signIn>>;
  let clientB: Awaited<ReturnType<typeof signIn>>;
  let definitionA: string;

  beforeAll(async () => {
    // 不靜默跳過：安全邊界沒驗證過就是沒驗證過
    if (!url || !anonKey || !serviceKey) {
      throw new Error(
        "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    idA = await createMember(MEMBER_A);
    idB = await createMember(MEMBER_B);
    clientA = await signIn(MEMBER_A);
    clientB = await signIn(MEMBER_B);

    definitionA = crypto.randomUUID();
    const { error } = await clientA.from("crm_definitions").insert({
      id: definitionA,
      owner_id: idA,
      name: DEFINITION.name,
      definition: DEFINITION,
    });
    if (error) throw new Error(`建立探測定義失敗：${error.message}`);
  }, 60_000);

  afterAll(async () => {
    for (const id of created) await adminFetch(`/users/${id}`, { method: "DELETE" });
  }, 60_000);

  it("匿名讀不到任何人的 CRM 設計", async () => {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data } = await anon.from("crm_definitions").select("id");

    // RLS 過濾的表現是「查得到零筆」而非報錯——這正是我們要的：
    // 不洩漏「有一筆你看不到的資料存在」這件事本身
    expect(data).toEqual([]);
  });

  it("別人的設計看不到", async () => {
    const { data } = await clientB.from("crm_definitions").select("id").eq("id", definitionA);
    expect(data).toEqual([]);
  });

  it("別人的設計改不動", async () => {
    const { count } = await clientB
      .from("crm_definitions")
      .update({ name: "被改掉了" }, { count: "exact" })
      .eq("id", definitionA);

    // 0 列被更新。RLS 的 update policy 是先用 using 濾掉看不到的列，
    // 所以這裡不會報錯，只是什麼都沒改到
    expect(count ?? 0).toBe(0);

    const { data } = await clientA.from("crm_definitions").select("name").eq("id", definitionA);
    expect(data?.[0]?.name).toBe(DEFINITION.name);
  });

  it("記錄的 owner_id 由 trigger 決定，送什麼都沒用", async () => {
    /*
     * 這一條守的是 migration 裡那個 `crm_records_inherit_owner`。
     *
     * 本人故意把 owner_id 送成別人的。trigger 會把它蓋掉——
     * 沒有 trigger 的話，這一筆會變成「掛在我的定義底下、
     * 但擁有者是別人」的記錄：我自己看不到它，對方也看不到它
     * （他的定義列表裡沒有這一份），資料就這樣消失在中間。
     */
    const recordId = crypto.randomUUID();

    const { error } = await clientA.from("crm_records").insert({
      id: recordId,
      owner_id: idB,
      definition_id: definitionA,
      entity: "thing-1",
      data: { "text-1": "阿明" },
    });
    expect(error).toBeNull();

    const { data } = await clientA.from("crm_records").select("owner_id").eq("id", recordId);
    expect(data?.[0]?.owner_id, "trigger 沒有把 owner_id 蓋成定義的擁有者").toBe(idA);
  });

  it("⚠️ 寫不進別人的 CRM——即使 owner_id 填的是自己的", async () => {
    /*
     * 這是整組裡最重要的一條。
     *
     * 只驗 `owner_id = auth.uid()` 的話，B 可以送出
     * 「owner_id 是我自己、definition_id 是 A 的」——policy 過了，
     * 然後 trigger 把 owner_id 改成 A。結果是 **B 往 A 的 CRM 裡
     * 寫了一筆資料**，而 A 完全不知道那一筆是誰放的。
     *
     * 所以 insert policy 問的是「你有沒有這份定義的擁有權」，
     * 不是「你有沒有把自己的 id 填對」。
     */
    const { error } = await clientB.from("crm_records").insert({
      owner_id: idB,
      definition_id: definitionA,
      entity: "thing-1",
      data: { "text-1": "偷塞的" },
    });

    expect(error, "別人的定義底下竟然插得進記錄").not.toBeNull();

    const { data } = await clientA
      .from("crm_records")
      .select("data")
      .eq("definition_id", definitionA);
    expect(data?.some((row) => (row.data as Record<string, unknown>)["text-1"] === "偷塞的")).toBe(
      false,
    );
  });

  it("刪掉設計，記錄跟著走", async () => {
    // 留著的話那些記錄永遠讀不出來（沒有定義就不知道每個 key 是什麼），
    // 而且還佔著每人 500 筆的額度
    const { error } = await clientA.from("crm_definitions").delete().eq("id", definitionA);
    expect(error).toBeNull();

    const { data } = await clientA
      .from("crm_records")
      .select("id")
      .eq("definition_id", definitionA);
    expect(data).toEqual([]);
  });
});
