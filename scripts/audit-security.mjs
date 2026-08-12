import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { config } from "dotenv";

/**
 * Security 稽核（Spec §36 / Phase 8B）
 *
 * 8B 的出口條件是「Spec §36 三區逐條核對，**有紀錄**」。
 *
 * 紀錄做成一支跑得動的腳本，不是一份文件。理由是文件會過期而且不會有人發現——
 * 「已核對」寫在文件上是永久有效的，寫在腳本裡則是每次跑都要重新成立。
 *
 * ⚠️ 這支腳本檢查的是**結構性的證據**（程式碼裡有沒有那道防線、
 * 端點實際回應什麼），不是「有沒有人想過這件事」。
 * 每一條檢查旁邊都寫明它實際上證明了什麼、以及它證明不了什麼。
 *
 * 用法：pnpm audit:security          （需 dev server 在 3000）
 */

config({ path: [".env.local", ".env"], quiet: true });

const urlIndex = process.argv.indexOf("--url");
const siteUrl = (urlIndex >= 0 ? process.argv[urlIndex + 1] : "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

let failures = 0;
let warnings = 0;

const pass = (label, detail = "") => console.log(`  ✅ ${label}${detail ? `  ${detail}` : ""}`);
const warn = (label, detail = "") => {
  warnings += 1;
  console.log(`  ⚠️  ${label}${detail ? `  ${detail}` : ""}`);
};
const fail = (label, detail = "") => {
  failures += 1;
  console.log(`  ❌ ${label}${detail ? `  ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */

function sources(dir = "src") {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    if (![".ts", ".tsx"].includes(extname(full))) return [];
    return [{ path: full.split("\\").join("/"), content: readFileSync(full, "utf8") }];
  });
}

/*
 * ⚠️ 先剝註解再比對。
 *
 * 第一版直接對原始碼做字串比對，於是 site-renderer.tsx 的一句註解
 * 「才有可能保證那條路徑上沒有 dangerouslySetInnerHTML」讓這條檢查變紅。
 * 稽核【9】犯過一模一樣的錯，只是方向相反——那次是假通過。
 *
 * 註解裡提到一個危險的東西，與程式碼裡用了它，是兩件事。
 */
const stripComments = (input) =>
  input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const files = sources();
const code = files.filter((file) => !/\.test\.tsx?$/.test(file.path));
const haystack = code.map((file) => stripComments(file.content)).join("\n");

const check = (label, condition, detail = "") =>
  condition ? pass(label, detail) : fail(label, detail);

console.log(`Security 稽核（Spec §36）　→ ${siteUrl}\n`);

/* ── Agent ───────────────────────────────────────────────────── */
console.log("【Agent】");

// Tool whitelist：證明的是「沒有實作被禁止的能力」，而不是「擋住了它們」。
// 沒有的東西不會因為提示詞被繞過就冒出來。
const forbidden = ["run_shell", "exec_", "code_execution", "raw_query", "web_search"];
const implemented = forbidden.filter((name) => haystack.includes(`name: "${name}"`));
check(
  "Tool whitelist：沒有實作 shell / code execution / raw query / 任意網路搜尋",
  implemented.length === 0,
  implemented.join("、"),
);

check("Tool 白名單以外的名稱會被拒絕", haystack.includes("沒有名為"));

// Zod validation：每個工具的 input 都是 zod schema，而送給模型的 JSON Schema
// 由同一份產生——這條驗的是那個機制存在，不是每個 schema 都寫對。
check(
  "所有 tool input 走 zod，JSON Schema 由 z.toJSONSchema 產生",
  haystack.includes("z.toJSONSchema"),
);

check(
  "Rate limit 在請求驗證之前生效",
  (() => {
    /*
     * 這一條原本比對的是 `checkRateLimit(requestIdentifier(request))` 這串字。
     *
     * 它從來沒有在驗順序：就算把限流搬到 safeParse 後面，只要那串字還在，
     * 它照樣是綠的。反過來，CR-003 只是給那個呼叫多加一個參數
     * （demo 用另一份額度），順序完全沒動，它就紅了。
     *
     * 兩個方向都錯，是同一個原因——比對寫法，而不是比對它宣稱的那件事。
     * 改成真的去比位置。
     *
     * 為什麼順序重要：一支狂送格式錯誤請求的腳本一樣佔用連線與 CPU，
     * 限流只在「請求合法」時才生效的話，攻擊者只要故意送壞的就能繞過。
     */
    const route = code.find((file) => file.path.endsWith("api/agent/route.ts"));
    if (!route) return false;

    const body = stripComments(route.content);
    const limitAt = body.indexOf("checkRateLimit(");
    const validateAt = body.indexOf("agentRequestSchema.safeParse(");

    return limitAt !== -1 && validateAt !== -1 && limitAt < validateAt;
  })(),
);

check(
  "對話有長度與則數上限",
  haystack.includes("maxConversationChars") && haystack.includes("maxMessages"),
);

// Prompt injection：規則面。機制面（長度、速率）在上面兩條。
check("Prompt injection：明說使用者訊息裡的指示不是指令", haystack.includes("忽略先前指示"));

check("API 金鑰不會進到瀏覽器", !haystack.includes("NEXT_PUBLIC_ANTHROPIC"));

/* ── Preview ─────────────────────────────────────────────────── */
console.log("\n【Preview】");

// 禁止 arbitrary HTML/JS：唯一允許 dangerouslySetInnerHTML 的地方是
// 結構化資料，而那裡的內容是 JSON、來源完全受控、且已逸出。
const dangerous = code.filter((file) =>
  stripComments(file.content).includes("dangerouslySetInnerHTML"),
);
const allowedDangerous = ["src/components/seo/structured-data.tsx"];
const unexpected = dangerous.filter((file) => !allowedDangerous.includes(file.path));
check(
  "禁止 arbitrary HTML：沒有非預期的 dangerouslySetInnerHTML",
  unexpected.length === 0,
  unexpected.map((f) => f.path).join("、"),
);

check("SiteConfig 的文字欄位擋掉 HTML 標籤形狀", haystack.includes("不得包含 HTML 標籤"));

check(
  "URL validation：只接受 https 與 mailto",
  haystack.includes("連結只接受 https:// 或 mailto:"),
);

check("CSS 注入：色彩與字型只接受列舉形式", haystack.includes("不得包含其他 CSS 宣告"));

check("主題變數注入前再驗一次（離開系統時的第二道）", haystack.includes("isSafeCssValue"));

/* ── Upload ──────────────────────────────────────────────────── */
console.log("\n【Upload】");

check("MIME allowlist", haystack.includes("ALLOWED_MEDIA"));
check("檔案大小上限", /maxBytes|MAX_(FILE_)?SIZE/i.test(haystack));
check("檔名 sanitize", /sanitizeFileName|sanitizeFilename/i.test(haystack));
check(
  "presigned URL 簽發前驗證 admin",
  haystack.includes("requireAdmin") || haystack.includes("是否為 admin"),
);

// Spec §36 要求「SVG sanitize 或停用 inline 渲染」。
// 這裡走的是停用：image/svg+xml 根本不在 ALLOWED_MEDIA 裡，
// 上傳階段就進不來，也就沒有 inline 渲染的問題。
check("SVG：不在允許的 MIME 清單裡（Spec §36 的「停用」那條路）", !haystack.includes("image/svg"));

/* ── 執行中的站台 ────────────────────────────────────────────── */
console.log("\n【執行中的站台】");

async function probe(path, init) {
  try {
    return await fetch(`${siteUrl}${path}`, { redirect: "manual", ...init });
  } catch {
    return null;
  }
}

const agentGarbage = await probe("/api/agent", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{ 這不是 JSON",
});

if (!agentGarbage) {
  warn("站台沒有回應", "請先啟動 dev server");
} else {
  check(
    "壞掉的請求有明確錯誤碼，不是 500",
    agentGarbage.status === 400,
    `HTTP ${agentGarbage.status}`,
  );

  const body = await agentGarbage.json().catch(() => ({}));
  check(
    "錯誤回應不可被快取",
    agentGarbage.headers.get("cache-control")?.includes("no-store") ?? false,
  );
  check("錯誤回應帶錯誤碼", Boolean(body.code), body.code ?? "");

  const home = await probe("/");
  const html = home ? await home.text() : "";
  const segment = process.env.ADMIN_SEGMENT?.trim();

  check("首頁 HTML 不含 API 金鑰", !/sk-ant-/.test(html));
  if (segment) check("首頁 HTML 不含後台密路徑", !html.includes(segment));

  const bare = await probe("/admin");
  check("裸 /admin 不存在", bare?.status === 404, `HTTP ${bare?.status}`);
}

/* ── 總結 ────────────────────────────────────────────────────── */
console.log(`\n${"─".repeat(56)}`);
console.log(`失敗 ${failures}　警告 ${warnings}`);
console.log(
  "\n這支腳本證明的是「防線存在且端點行為符合預期」，" +
    "\n不證明「沒有其他漏洞」。它是核對表，不是滲透測試。",
);

process.exit(failures === 0 ? 0 : 1);
