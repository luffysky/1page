import { writeFileSync } from "node:fs";

import { config } from "dotenv";
import { format, resolveConfig } from "prettier";

/**
 * 由資料庫 schema 產生 TypeScript 型別。
 *
 * `supabase gen types` 需要 Postgres 連線字串或 Supabase Cloud 專案 id，
 * 自架版兩者都沒有，因此改為透過 pg-meta 直接 introspect information_schema。
 *
 * 產出 `src/types/database.ts`。**不要手動編輯**——手抄的型別會與 schema 悄悄分歧，
 * 而分歧的方向永遠是「程式以為欄位可以是 null，資料庫其實不允許」這類最難查的。
 *
 * 目前只產 Row 型別與 enum。Insert / Update 於 2E（Admin 寫入）需要時再加——
 * 沒有呼叫端的型別同樣是規格債。
 *
 * 用法：node scripts/db-types.mjs
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
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}\n${(await response.text()).slice(0, 800)}`);
  return response.json();
}

const enums = await sql(`
  select t.typname as name, json_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`);

const columns = await sql(`
  select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.table_name not like '\\_%'
  order by c.table_name, c.ordinal_position
`);

const enumNames = new Set(enums.map((row) => row.name));

function toPascal(name) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function tsType(column) {
  if (enumNames.has(column.udt_name)) return toPascal(column.udt_name);

  switch (column.data_type) {
    case "text":
    case "character varying":
    case "uuid":
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
      return "string";
    case "integer":
    case "smallint":
    case "bigint":
    case "numeric":
    case "double precision":
    case "real":
      return "number";
    case "boolean":
      return "boolean";
    case "jsonb":
    case "json":
      return "Json";
    case "ARRAY":
      return "string[]";
    default:
      return "unknown";
  }
}

const byTable = new Map();
for (const column of columns) {
  if (!byTable.has(column.table_name)) byTable.set(column.table_name, []);
  byTable.get(column.table_name).push(column);
}

let out = `/**
 * 由資料庫 schema 自動產生 —— 請勿手動編輯。
 *
 * 重新產生：pnpm db:types
 * 產生器：scripts/db-types.mjs（透過 pg-meta introspect information_schema）
 *
 * 目前只含 Row 型別與 enum。Insert / Update 於 2E 需要寫入時再加。
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

`;

for (const row of enums) {
  const values = row.values.map((value) => `"${value}"`).join(" | ");
  out += `export type ${toPascal(row.name)} = ${values};\n`;
}

out += "\n";

for (const [table, cols] of [...byTable.entries()].sort()) {
  out += `export interface ${toPascal(table)}Row {\n`;
  for (const column of cols) {
    const nullable = column.is_nullable === "YES" ? " | null" : "";
    out += `  ${column.column_name}: ${tsType(column)}${nullable};\n`;
  }
  out += "}\n\n";
}

// 產生完就格式化。少了這步，`db:types` 之後的第一次 gate 一定卡在
// prettier --check，而那是個純噪音的失敗：它不代表任何東西壞掉。
//
// 用 Node API 而非開子行程跑 CLI：prettier 本來就是相依套件，
// 而在 Windows 上從 .mjs 的 top-level await 生 pnpm.cmd 會讓 node 直接 abort。
const target = "src/types/database.ts";
const formatted = await format(out, {
  ...(await resolveConfig(target)),
  filepath: target,
});
writeFileSync(target, formatted, "utf8");

console.log(`已產生 ${target}`);
console.log(`  enum ${enums.length} 個：${enums.map((e) => e.name).join(", ")}`);
console.log(`  資料表 ${byTable.size} 個：${[...byTable.keys()].sort().join(", ")}`);
