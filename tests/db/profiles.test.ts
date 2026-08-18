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

/**
 * 直接下 SQL。
 *
 * 「有沒有孤兒帳號」這種問題必須跨 `auth` 與 `public` 兩個 schema，
 * 而 PostgREST 不暴露 auth schema——用 client 問不出來。
 */
async function sql(query: string): Promise<Record<string, string>[]> {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`SQL 失敗：${await response.text()}`);
  return response.json() as Promise<Record<string, string>[]>;
}

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

describe("沒有孤兒帳號", () => {
  /*
   * ── 這一條在守什麼 ────────────────────────────────────────────
   *
   * `on_auth_user_created` 是 `after insert`——它守得住**之後**建立的帳號，
   * 對已經在 `auth.users` 裡的列不會觸發。所以 0811 那份 migration
   * 上線的當下就已經有一個孤兒（0810 建的管理員帳號），
   * 而症狀一週後才出現：那個帳號存不了任何東西。
   *
   * 九張表的外鍵指向 profiles，所以「沒有 profile」的後果是
   * 存網站草稿、存 CMS 內容、存 CRM 設計全部撞外鍵——
   * 而應用層把它吞成一句「存檔失敗。」。
   *
   * ⚠️ 形式是**反過來問**：不列「這個帳號要有 profile」，
   * 而是問「有沒有哪個帳號沒有」。前者每加一個帳號都要記得補，
   * 後者自己會發現下一次。
   *
   * ⚠️ 而且它必須跑在**真的資料庫**上。這件事在單元測試層問不出來——
   * 那裡沒有 auth.users。e2e 也問不出來，因為每支測試都自己建新帳號，
   * 涵蓋的永遠是「新使用者」。
   */
  it("每一個 auth.users 都有對應的 profile", async () => {
    const rows = await sql(`
      select u.id, u.email
      from auth.users u
      left join public.profiles p on p.id = u.id
      where p.id is null
    `);

    expect(
      rows,
      `這幾個帳號沒有 profile，它們存不了任何東西：${rows.map((row) => row.email).join("、")}`,
    ).toEqual([]);
  });

  it("profile 的顯示名稱不是空的", async () => {
    // 空的 display_name 在畫面上是一段空白，而使用者會以為資料壞了。
    // 回填與 trigger 都用「信箱的 local part」當保底，所以這件事應該成立
    const rows = await sql(`
      select id, email from public.profiles
      where display_name is null or btrim(display_name) = ''
    `);

    expect(rows.map((row) => row.email)).toEqual([]);
  });
});
