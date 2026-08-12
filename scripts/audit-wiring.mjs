import { readdirSync, readFileSync } from "node:fs";

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

// ── 8. 路由可達性 ──────────────────────────────────────────────
//
// 這一項是為了一類特定的失敗補的：**功能做完了，但畫面上沒有任何地方進得去。**
//
// 實例：`/login` 從 2E 就存在並且能用，導覽列卻沒有任何入口；
// 登入之後也沒有登出。typecheck 過、lint 過、測試全綠、build 成功、
// e2e 的 no-dead-links 也過——因為它查的是「連結指向的目標存在嗎」，
// 反方向的「這個目標有連結指向它嗎」沒有任何東西在看。
//
// 做法：從 / 開始爬同源連結，跟檔案系統上的路由清單對帳。
// 沒被連到的路由，要嘛是漏接，要嘛必須在下面的例外表裡寫明理由。
console.log("\n【8】路由可達性（畫面上真的進得去嗎）");

// 例外＝刻意不連的，每一條都要有理由。理由寫不出來就是漏接。
const UNLINKED_BY_DESIGN = [
  [/^\/admin(\/|$)/, "後台走密路徑改寫，公開頁面不得出現任何入口（見 admin-security.spec.ts）"],
  [/^\/_dev(\/|$)/, "開發用頁面，Guardrail 1 規定不得混入產品訊號"],
  [/^\/icon-maskable$/, "由 manifest.webmanifest 引用，不是給人點的"],
  /*
   * 會員中心的入口**存在**，但只渲染給已登入的人（選單上「會員中心」那顆），
   * 而這支爬蟲是匿名的，所以它看不到。
   *
   * ⚠️ 這條與 /admin 那條的理由不同，不要混為一談：
   *   /admin    路徑必須保密，公開頁面**永遠不得**出現入口
   *   /account  路徑是公開的，入口只是依登入狀態顯示
   *
   * 未登入者看得到的是「登入」那顆（連到 /login，爬得到），
   * 那條路徑才是一般人真正的入口。它有沒有出現在畫面上，
   * 由 account-entry.spec.ts 盯著——這個縫剛剛才真的發生過一次。
   */
  [/^\/account(\/|$)/, "入口只顯示給已登入者；未登入者走 /login，由 account-entry.spec.ts 驗"],
  // API 端點由前端 fetch 呼叫，本來就不會是一條 <a href>。
  // 「有沒有人在用」這件事對它們仍然要驗，只是判準不同——
  // 見下方【9】：每個 /api/* 都必須有程式碼在呼叫它。
  [/^\/api(\/|$)/, "API 端點，由 fetch 呼叫而非連結；接線由【9】檢查"],
];

function routesOnDisk() {
  const found = [];
  const walk = (dir, urlPath) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        // (group) 不影響網址；@slot 是平行路由。
        // 資料夾名稱可能是百分比編碼：Next 把 `_` 開頭的資料夾視為私有，
        // 要產生 /_dev 這種網址，資料夾必須命名為 `%5Fdev`。
        const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
        walk(next, `${urlPath}${segment}`);
      } else if (/^(page|route)\.tsx?$/.test(entry.name)) {
        found.push(urlPath === "" ? "/" : urlPath);
      }
    }
  };
  walk("src/app", "");
  return [...new Set(found)];
}

/** 動態路由在磁碟上是 /work/[slug]，爬到的是 /work/interior-studio。 */
function matchesRoute(route, visitedPaths) {
  const pattern = new RegExp(
    `^${route.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}$`,
  );
  return visitedPaths.some((path) => pattern.test(path));
}

const visited = new Set();
const queue = ["/"];
const brokenLinks = new Set();

while (queue.length > 0) {
  const path = queue.shift();
  if (visited.has(path)) continue;
  visited.add(path);

  let response;
  try {
    response = await fetch(`${siteUrl}${path}`, { redirect: "manual" });
  } catch {
    continue;
  }
  if (response.status !== 200) {
    if (path !== "/") brokenLinks.add(`${path} → HTTP ${response.status}`);
    continue;
  }
  if (!response.headers.get("content-type")?.includes("text/html")) continue;

  const html = await response.text();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const clean = href.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
    if (clean && !visited.has(clean)) queue.push(clean);
  }
}

const disk = routesOnDisk();
const visitedPaths = [...visited];
const orphans = disk.filter((route) => {
  if (matchesRoute(route, visitedPaths)) return false;
  return !UNLINKED_BY_DESIGN.some(([pattern]) => pattern.test(route));
});

pass(`從 / 爬到 ${visited.size} 個頁面，磁碟上共 ${disk.length} 條路由`);

if (orphans.length === 0) {
  pass("每條路由都有畫面上的入口（或列為刻意不連並附理由）");
} else {
  for (const route of orphans) {
    fail(`${route} 存在但畫面上沒有任何連結進得去`, "漏接，或該加進 UNLINKED_BY_DESIGN 並寫明理由");
  }
}

if (brokenLinks.size === 0) {
  pass("爬到的連結都指向存在的頁面");
} else {
  for (const link of brokenLinks) fail("死連結", link);
}

// ── 【9】API 端點有沒有人呼叫 ──────────────────────────────────
//
// 【8】驗的是「這個頁面有沒有入口」。API 端點沒有入口可言——
// 它們不是連結，是 fetch 的目標。但同一個問題仍然存在，
// 而且形式一模一樣：端點寫好了、放在那裡、沒有任何程式碼在呼叫它。
//
// `/login` 曾經躺了兩個 Phase 沒人進得去，靠的是【8】才發現。
// 這一條是同一個教訓在 API 上的版本。
console.log("\n【9】API 端點的接線");

const apiRoutes = disk.filter((route) => route.startsWith("/api/"));

if (apiRoutes.length === 0) {
  pass("目前沒有 API 端點");
} else {
  /*
   * ⚠️ 先把註解拿掉再找。
   *
   * 第一版是直接對整份原始碼做 `includes("/api/agent")`，結果它「通過」了——
   * 因為 schema.ts 的註解裡寫著「`/api/agent` 是公開端點」。
   * 一條在沒有任何呼叫端的情況下仍然顯示綠色的檢查，比沒有這條檢查更糟：
   * 它會讓人以為已經檢查過了。
   *
   * 行註解只在 `//` 前面不是冒號時才移除，才不會把 https:// 從字串裡切掉。
   */
  const stripComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const sources = [];
  const collectSources = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) collectSources(next);
      else if (/\.tsx?$/.test(entry.name) && !next.includes("/api/"))
        sources.push(stripComments(readFileSync(next, "utf8")));
    }
  };
  collectSources("src");

  const haystack = sources.join("\n");

  for (const route of apiRoutes) {
    // 必須出現在字串字面值裡——那才是「有人在呼叫」的形狀。
    const called = new RegExp(`["'\`]${route.replace(/[/]/g, "\\/")}["'\`]`).test(haystack);

    if (called) {
      pass(`${route} 有程式碼呼叫`);
    } else {
      warn(`${route} 沒有任何程式碼呼叫`, "端點做好了但還沒接上畫面");
    }
  }
}

// ── 總結 ───────────────────────────────────────────────────────
console.log(`\n${"─".repeat(56)}`);
console.log(`失敗 ${failures}　警告 ${warnings}`);
process.exit(failures > 0 ? 1 : 0);
