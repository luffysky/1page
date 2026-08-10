import { readFileSync } from "node:fs";

import { config } from "dotenv";

/**
 * 接線稽核：API ↔ DB ↔ UI 是否真的接上。
 *
 * 這支腳本查的是「看起來有做、實際上沒接」的那一類問題：
 *   - 資料庫有欄位，程式碼從來沒取用（做了沒接）
 *   - 程式碼取用了不存在的欄位（接錯名字，只有執行到才會炸）
 *   - 產生的型別與資料庫現況不同步（migration 後忘了重跑 db:types）
 *   - 公開路由掛掉、後台路由沒受保護
 *
 * 這些都不會被 typecheck 或單元測試抓到，因為它們橫跨了型別系統的邊界。
 *
 * 用法：pnpm audit:wiring          （需 dev server 在 3000）
 *       pnpm audit:wiring --url https://1page.snowrealm.pet
 */

config({ path: [".env.local", ".env"], quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const urlIndex = process.argv.indexOf("--url");
const siteUrl = (urlIndex >= 0 ? process.argv[urlIndex + 1] : "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

let failures = 0;
let warnings = 0;

function pass(label, detail = "") {
  console.log(`  ✅ ${label}${detail ? `  ${detail}` : ""}`);
}
function warn(label, detail = "") {
  warnings += 1;
  console.log(`  ⚠️  ${label}${detail ? `  ${detail}` : ""}`);
}
function fail(label, detail = "") {
  failures += 1;
  console.log(`  ❌ ${label}${detail ? `  ${detail}` : ""}`);
}

async function sql(query) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// ── 1. DB 欄位 ↔ 產生的型別 ────────────────────────────────────
console.log("\n【1】資料庫欄位 ↔ src/types/database.ts");

const columns = await sql(`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public' and table_name not like '\\_%'
  order by table_name, ordinal_position
`);

const generated = readFileSync("src/types/database.ts", "utf8");
const missingInTypes = columns.filter(
  (row) => !new RegExp(`^\\s+${row.column_name}:`, "m").test(generated),
);

if (missingInTypes.length === 0) {
  pass(`${columns.length} 個欄位全部出現在產生的型別中`);
} else {
  fail(
    "型別與資料庫不同步，請執行 pnpm db:types",
    missingInTypes.map((row) => `${row.table_name}.${row.column_name}`).join(", "),
  );
}

// ── 2. 程式碼取用的欄位是否都存在於資料庫 ──────────────────────
console.log("\n【2】程式碼 select 的欄位 ↔ 資料庫");

const columnNames = new Set(columns.map((row) => row.column_name));
const sources = [
  "src/features/portfolio/supabase-repository.ts",
  "src/features/admin/portfolio-repository.ts",
  "src/features/admin/media-actions.ts",
  "src/features/admin/actions.ts",
  "src/features/admin/auth.ts",
];

const referenced = new Set();
for (const path of sources) {
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/\.(select|eq|order|update|insert)\(([^)]*)\)/g)) {
    for (const word of match[2].matchAll(/[a-z][a-z0-9_]{2,}/g)) {
      if (columnNames.has(word[0])) referenced.add(word[0]);
    }
  }
}

/*
 * 只取 select() 內第一個字串字面值，且只驗「平坦的欄位清單」。
 *
 * 第一版用 `[\s\S]*?` 做跨行比對，結果吃進整個檔案，把 JS 關鍵字
 * （const、await、return…）當成未知欄位回報。
 * 一份全是誤報的稽核比沒有稽核更糟——下次真的有問題時沒人會相信它。
 */
const unknownRefs = [];
const SELECT_LITERAL = /\.select\(\s*["'`]([^"'`]*)["'`]/g;

for (const path of sources) {
  const content = readFileSync(path, "utf8");

  for (const block of content.matchAll(SELECT_LITERAL)) {
    const body = block[1];
    // 含括號的是 PostgREST 巢狀語法，交由關聯層處理
    if (body.includes("(")) continue;

    for (const name of body
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) continue;
      if (columnNames.has(name)) continue;
      unknownRefs.push(`${path.split("/").pop()}: ${name}`);
    }
  }
}

if (unknownRefs.length === 0) {
  pass(`${referenced.size} 個欄位被程式碼實際取用，無未知欄位`);
} else {
  fail("程式碼引用了資料庫沒有的欄位", [...new Set(unknownRefs)].join(", "));
}

// ── 3. 有欄位但沒人用（做了沒接） ──────────────────────────────
console.log("\n【3】資料庫有、程式碼從未取用的欄位");

const allSource = sources.map((path) => readFileSync(path, "utf8")).join("\n");
const neverUsed = [...columnNames].filter((name) => !allSource.includes(name));

if (neverUsed.length === 0) {
  pass("沒有未接線的欄位");
} else {
  warn("以下欄位存在但目前沒有任何程式碼取用", neverUsed.join(", "));
}

// ── 4. 公開路由 ────────────────────────────────────────────────
console.log(`\n【4】公開路由（${siteUrl}）`);

const publicRoutes = [
  ["/", 200],
  ["/work", 200],
  ["/work/interior-studio", 200],
  ["/work/does-not-exist", 404],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/login", 200],
];

for (const [path, expected] of publicRoutes) {
  try {
    const response = await fetch(`${siteUrl}${path}`, { redirect: "manual" });
    const ok = response.status === expected;
    (ok ? pass : fail)(`${path}`, `HTTP ${response.status}（預期 ${expected}）`);
  } catch (error) {
    fail(`${path}`, error.message);
  }
}

// ── 5. 後台保護 ────────────────────────────────────────────────
console.log("\n【5】後台保護");

for (const path of ["/admin", "/admin/portfolio", "/console-x7k2/admin"]) {
  const response = await fetch(`${siteUrl}${path}`, { redirect: "manual" });
  (response.status === 404 ? pass : fail)(`${path} 未授權時不存在`, `HTTP ${response.status}`);
}

const segment = process.env.ADMIN_SEGMENT?.trim();
if (segment) {
  const response = await fetch(`${siteUrl}/${segment}/admin`, { redirect: "manual" });
  const redirected = response.status >= 300 && response.status < 400;
  (redirected ? pass : fail)("密路徑未登入時導向登入頁", `HTTP ${response.status}`);

  const home = await fetch(siteUrl).then((r) => r.text());
  (home.includes(segment) ? fail : pass)("首頁 HTML 不含後台密路徑");
} else {
  warn("未設定 ADMIN_SEGMENT，跳過密路徑檢查");
}

// ── 6. 公開資料不含草稿 ────────────────────────────────────────
console.log("\n【6】公開資料隔離");

const workHtml = await fetch(`${siteUrl}/work`).then((r) => r.text());
(workHtml.includes("unpublished-draft") ? fail : pass)("列表不含未發布作品");

const draftResponse = await fetch(`${siteUrl}/work/unpublished-draft`, { redirect: "manual" });
(draftResponse.status === 404 ? pass : fail)("草稿詳細頁回 404", `HTTP ${draftResponse.status}`);

// ── 7. 媒體網域設定 ────────────────────────────────────────────
console.log("\n【7】媒體網域");

const media = await sql(`select url from public.portfolio_media limit 50`);
const bases = [process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL, process.env.NEXT_PUBLIC_R2_PUBLIC_URL]
  .filter(Boolean)
  .map((value) => (value.startsWith("http") ? value : `https://${value}`).replace(/\/$/, ""));

if (media.length === 0) {
  pass("目前沒有媒體記錄");
} else {
  const orphans = media.filter((row) => !bases.some((base) => row.url.startsWith(`${base}/`)));
  (orphans.length === 0 ? pass : fail)(
    `${media.length} 筆媒體網址都屬於已設定的網域`,
    orphans.length > 0 ? `${orphans.length} 筆不符（會在畫面上消失）` : "",
  );
}

// ── 總結 ───────────────────────────────────────────────────────
console.log(`\n${"─".repeat(56)}`);
console.log(`失敗 ${failures}　警告 ${warnings}`);
process.exit(failures > 0 ? 1 : 0);
