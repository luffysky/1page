import { config } from "dotenv";

/**
 * 建立後台管理員帳號。
 *
 * 為什麼不用一般註冊流程：
 * 自架 Supabase 的 `mailer_autoconfirm` 為 false 且多半沒設 SMTP，
 * 走註冊流程會卡在收不到的驗證信。Admin API 可直接建立已驗證的帳號。
 *
 * ⚠️ 需要 SUPABASE_SERVICE_ROLE_KEY。這支只在本機跑，不要放進部署環境。
 *
 * 用法：
 *   pnpm admin:create                 用 .env.local 的 ADMIN_EMAIL / ADMIN_PASSWORD
 *   pnpm admin:create --role owner    指定角色（預設 owner，因為第一個帳號通常是站主）
 *   pnpm admin:list                   列出目前的後台成員
 */

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function sql(query) {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SQL 失敗 HTTP ${response.status}\n${text.slice(0, 600)}`);
  return JSON.parse(text);
}

async function listStaff() {
  const rows = await sql(`
    select a.role, a.created_at, u.email
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.role, a.created_at
  `);
  if (rows.length === 0) {
    console.log("目前沒有任何後台成員。");
    return;
  }
  console.log(`後台成員 ${rows.length} 位：`);
  for (const row of rows) console.log(`  ${row.role.padEnd(6)} ${row.email}`);
}

if (process.argv.includes("--list")) {
  await listStaff();
  process.exit(0);
}

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("請先在 .env.local 設定 ADMIN_EMAIL 與 ADMIN_PASSWORD");
  process.exit(1);
}

const roleIndex = process.argv.indexOf("--role");
const role = roleIndex >= 0 ? process.argv[roleIndex + 1] : "owner";

if (!["owner", "admin"].includes(role)) {
  console.error(`角色只能是 owner 或 admin，收到：${role}`);
  process.exit(1);
}

if (password.length < 12) {
  console.warn(
    `\n⚠️  密碼只有 ${password.length} 個字元。這組帳號可以改動網站上所有公開內容，` +
      `\n   建議至少 16 字元。仍會繼續建立，但請盡快改掉。\n`,
  );
}

// 先看看使用者是否已存在——重複執行不該報錯
const existing = await sql(
  `select id from auth.users where email = '${email.replace(/'/g, "''")}' limit 1`,
);

let userId = existing[0]?.id;

if (userId) {
  /*
   * ⚠️ 這裡原本只印一行「使用者已存在」就跳過了。
   *
   * 後果是：改了 .env.local 的 ADMIN_PASSWORD、再跑一次這支腳本，
   * 它會印「使用者已存在」→「已授予 admin 權限」→「下一步：以此帳號登入」，
   * 從頭到尾一副成功的樣子——但**密碼完全沒有被套用**。
   * 資料庫裡還是建立當天那一組。
   *
   * 然後登入頁說「帳號或密碼不正確」，而你輸入的確實是你設定的那一組。
   * 沒有任何一個地方會告訴你這兩件事對不起來。
   *
   * 這支腳本的 ADMIN_PASSWORD 就是密碼的來源，那它就該真的把密碼寫進去。
   */
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });

  if (!response.ok) {
    console.error(`更新既有使用者的密碼失敗 HTTP ${response.status}`);
    console.error(JSON.stringify(await response.json()).slice(0, 600));
    process.exit(1);
  }

  console.log(`使用者已存在：${email}`);
  console.log("已把密碼更新成 .env.local 裡的 ADMIN_PASSWORD。");
} else {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await response.json();
  if (!response.ok) {
    console.error(`建立使用者失敗 HTTP ${response.status}`);
    console.error(JSON.stringify(body).slice(0, 600));
    process.exit(1);
  }
  userId = body.id;
  console.log(`已建立使用者：${email}`);
}

await sql(`
  insert into public.admin_users (user_id, role, note)
  values ('${userId}', '${role}', '由 pnpm admin:create 建立')
  on conflict (user_id) do update set role = excluded.role
`);

console.log(`已授予 ${role} 權限。\n`);
await listStaff();

console.log(
  "\n下一步：\n" +
    "  1. 確認 .env.local 有 ADMIN_SEGMENT（後台密路徑）\n" +
    "  2. 以此帳號登入，選單會出現後台入口\n" +
    "  3. 建議關閉 Supabase 的公開註冊（disable_signup），此站不需要一般使用者註冊\n",
);
