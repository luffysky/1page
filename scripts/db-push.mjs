import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

/**
 * 對自架 Supabase 套用 migration。
 *
 * Zeabur 上的是自架版，`supabase link` 針對 Supabase Cloud 的 API，不適用；
 * 也沒有對外開放的 Postgres 連線埠。可用的是 Kong 後面的 pg-meta：
 *   POST {SUPABASE_URL}/pg/query   （需 apikey + Bearer，皆為 service role key）
 *
 * ⚠️ 此端點可執行任意 SQL。service role key 等同資料庫管理員，
 * 絕不可出現在瀏覽器端、不可加 NEXT_PUBLIC_ 前綴、不可進版控。
 *
 * 冪等性：已套用的 migration 記錄在 public._migrations，重複執行會跳過。
 * 這是 2A 出口條件「migration 可重複套用」的實作。
 *
 * 用法：
 *   node scripts/db-push.mjs          套用未執行的 migration
 *   node scripts/db-push.mjs --seed   額外套用 supabase/seed.sql（會先清空資料）
 *   node scripts/db-push.mjs --status 只顯示狀態，不執行
 */

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function sql(query) {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}\n${text.slice(0, 1200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const wantSeed = process.argv.includes("--seed");
const statusOnly = process.argv.includes("--status");

await sql(`
  create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`);

const applied = new Set((await sql("select name from public._migrations")).map((row) => row.name));

const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

console.log(`目標：${url}`);
console.log(`migration 檔案：${files.length} 個，已套用 ${applied.size} 個\n`);

if (statusOnly) {
  for (const file of files) {
    console.log(`  ${applied.has(file) ? "✓ 已套用" : "· 待套用"}  ${file}`);
  }
  process.exit(0);
}

for (const file of files) {
  if (applied.has(file)) {
    console.log(`  ✓ 跳過（已套用）  ${file}`);
    continue;
  }

  const body = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`  → 套用 ${file} ... `);
  try {
    await sql(body);
    await sql(`insert into public._migrations (name) values ('${file.replace(/'/g, "''")}')`);
    console.log("完成");
  } catch (error) {
    console.log("失敗");
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
}

if (wantSeed) {
  process.stdout.write("\n  → 套用 seed.sql ... ");
  // 種子可重複執行：先清空作品相關資料。
  // 只清 portfolio_*，不動 admin_users 與 auth schema。
  await sql(
    "truncate table public.portfolio_projects, public.portfolio_tags restart identity cascade;",
  );
  await sql(readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8"));
  console.log("完成");
}

const counts = await sql(`
  select
    (select count(*) from public.portfolio_projects) as projects,
    (select count(*) from public.portfolio_projects where status = 'published') as published,
    (select count(*) from public.portfolio_media) as media,
    (select count(*) from public.portfolio_categories) as categories
`);
console.log(`\n資料筆數：${JSON.stringify(counts[0])}`);
