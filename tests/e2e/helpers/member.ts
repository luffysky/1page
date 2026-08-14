import type { Page } from "@playwright/test";

/**
 * 拋棄式的一般會員帳號
 *
 * ⚠️ 刻意不共用 authed-breakpoints 那個後台帳號：會員區要證明的正是
 * 「一般人自己的後台能用」，拿員工帳號測就把兩個後台混在一起了。
 *
 * 也刻意不用 `.env.local` 的 ADMIN_EMAIL / ADMIN_PASSWORD——
 * 測試不該依賴一個人的個人密碼，那個值隨時可能改，
 * 改了就整組測試變紅，而紅的原因與程式碼無關。
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function requireSupabaseEnv() {
  // 不靜默跳過：2E 有過教訓，兩條安全測試因為沒載入 .env.local
  // 而安靜地跳過，報告全綠了好一陣子。
  if (!supabaseUrl || !serviceKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return { supabaseUrl, serviceKey };
}

async function gotrue(path: string, init?: RequestInit) {
  return fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
  });
}

export async function sql(query: string) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
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

/** 建立（或重建）一個測試會員，回傳它的 user id */
export async function createMember(email: string, password: string): Promise<string> {
  requireSupabaseEnv();

  // 前一次跑到一半被中斷時可能留下殘骸
  const existing = await sql(`select id from auth.users where email = '${email}'`);
  for (const row of existing) await gotrue(`/users/${row.id}`, { method: "DELETE" });

  const created = await gotrue("/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const body = (await created.json()) as { id?: string };
  if (!body.id) throw new Error(`建立測試會員帳號失敗：${JSON.stringify(body)}`);
  return body.id;
}

export async function deleteMember(userId: string) {
  // profiles 與 saved_sites 都是 on delete cascade，刪帳號就一起走
  await gotrue(`/users/${userId}`, { method: "DELETE" });
}

export async function signIn(page: Page, email: string, password: string, next = "/edit") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(new RegExp(next.split("?")[0]!), { timeout: 20_000 });
}
