import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 會員 Profile 的邊界驗證（Spec V1.3 §47 CR-002 / Phase MA）
 *
 * 這組測試用**真實的會員 JWT**（不是 service role）打 REST API，
 * 因為 CR-002 之後「會員」是一個真的會存在於正式環境的身分，
 * 而所有 policy 的判斷都建立在 `auth.uid()` 上——用 service role 測，
 * RLS 根本不會生效，全部都會過。
 *
 * 與 rls.test.ts 同樣不納入 `pnpm test`，用 `pnpm test:db` 執行。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = "Pr0be!Members#2026";
const MEMBER_A = "member-a@1page.test";
const MEMBER_B = "member-b@1page.test";

type Probe = { id: string; email: string };

const created: string[] = [];

async function adminFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
  });
  return response;
}

/** 直接用 Admin API 建立已驗證帳號——這裡測的是 RLS，不是註冊流程。 */
async function createMember(email: string): Promise<Probe> {
  const response = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string; msg?: string };
  if (!body.id) throw new Error(`建立探測帳號失敗：${JSON.stringify(body)}`);
  created.push(body.id);
  return { id: body.id, email };
}

/** 以會員身分登入取得 client，之後所有查詢都帶著該會員的 JWT。 */
async function signIn(email: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`探測帳號登入失敗（${email}）：${error.message}`);
  return client;
}

describe("會員 Profile", () => {
  let a: Probe;
  let b: Probe;
  let clientA: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) {
      throw new Error(
        "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY。\n" +
          "這個測試不會靜默跳過——安全邊界沒驗證過就是沒驗證過。",
      );
    }
    a = await createMember(MEMBER_A);
    b = await createMember(MEMBER_B);
    clientA = await signIn(MEMBER_A);
  }, 60_000);

  afterAll(async () => {
    for (const id of created) await adminFetch(`/users/${id}`, { method: "DELETE" });
  }, 60_000);

  it("註冊即自動產生 profile（DB trigger，不靠應用層呼叫）", async () => {
    const { data, error } = await clientA.from("profiles").select("id,email,display_name").single();
    expect(error).toBeNull();
    expect(data?.id).toBe(a.id);
    expect(data?.email).toBe(MEMBER_A);
    expect(data?.display_name).toBe("member-a");
  });

  it("會員讀不到別人的 profile", async () => {
    // 不是「查不到」而是「被 policy 濾掉」——兩者對呼叫端長得一樣，這正是我們要的
    const { data } = await clientA.from("profiles").select("id").eq("id", b.id);
    expect(data).toEqual([]);
  });

  it("會員列出 profiles 只會看到自己一列", async () => {
    const { data } = await clientA.from("profiles").select("id");
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(a.id);
  });

  it("會員可以改自己的 display_name", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ display_name: "改過的名字" })
      .eq("id", a.id);
    expect(error).toBeNull();

    const { data } = await clientA.from("profiles").select("display_name").single();
    expect(data?.display_name).toBe("改過的名字");
  });

  it("會員改不動自己的 email（改了會被 trigger 還原）", async () => {
    // update policy 允許他更新自己那列，所以這裡**不會報錯**——
    // 擋住的是 profiles_lock_identity trigger。
    // 若只驗 error 不為 null，這條測試會在 trigger 被拿掉後仍然是綠的。
    await clientA.from("profiles").update({ email: "hijack@evil.test" }).eq("id", a.id);

    const { data } = await clientA.from("profiles").select("email").single();
    expect(data?.email).toBe(MEMBER_A);
  });

  it("會員改不動 snowrealm_id（不能宣稱自己是別的平台帳號）", async () => {
    await clientA.from("profiles").update({ snowrealm_id: "someone-else" }).eq("id", a.id);

    const { data } = await clientA.from("profiles").select("snowrealm_id").single();
    expect(data?.snowrealm_id).toBeNull();
  });

  it("會員改不動別人的 profile", async () => {
    await clientA.from("profiles").update({ display_name: "被別人改的" }).eq("id", b.id);

    const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    const { data } = await admin.from("profiles").select("display_name").eq("id", b.id).single();
    expect(data?.display_name).toBe("member-b");
  });

  it("會員不能自行插入 profile 列", async () => {
    const { error } = await clientA
      .from("profiles")
      .insert({ id: crypto.randomUUID(), display_name: "偽造" });
    expect(error).not.toBeNull();
  });

  it("會員刪不掉自己的 profile（帳號還在卻沒有 profile 比刪不掉更難處理）", async () => {
    await clientA.from("profiles").delete().eq("id", a.id);

    const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", a.id);
    expect(count).toBe(1);
  });

  it("會員看不到 admin_users 名單，也加不進去", async () => {
    const { data } = await clientA.from("admin_users").select("user_id");
    expect(data).toEqual([]);

    const { error } = await clientA
      .from("admin_users")
      .insert({ user_id: a.id, role: "owner" as const });
    expect(error).not.toBeNull();
  });

  it("會員讀不到草稿作品（CR-002 沒有放寬既有邊界）", async () => {
    // 這條是刻意的重複：新增一個身分之後，最容易出事的不是新 policy 寫錯，
    // 而是舊 policy 對新身分的行為沒人檢查過。
    const { data } = await clientA.from("portfolio_projects").select("slug").eq("status", "draft");
    expect(data).toEqual([]);
  });
});
