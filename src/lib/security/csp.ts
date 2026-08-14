/**
 * Content-Security-Policy（Spec §36）
 *
 * ── 這份 CSP 誠實地說明它擋得住什麼 ──────────────────────────
 *
 * `script-src` 裡有 `'unsafe-inline'`，所以**它不是 XSS 的最後一道防線**。
 * 真正擋 XSS 的仍然是 schema（`plainText` 不收 HTML 標籤）與 React 的逸出。
 *
 * 為什麼不用 nonce 換掉 `'unsafe-inline'`：Next 的 nonce 方案要求
 * **每一頁都改成動態渲染**，靜態產生、CDN 快取與 PPR 全部失效。
 * 這是一個作品集／行銷網站，首頁的載入速度就是它的賣點之一，
 * 而且專案裡有一支效能稽核在盯著。用整站變慢換一條本來就有兩層防護的規則，
 * 划不來。
 *
 * ⚠️ 而且 `style-src` **不能**用 nonce：nonce 對 `style=""` 屬性無效，
 * 而 SiteScope 正是用 inline style 注入 `--site-*`（見 site-scope.tsx，
 * 那裡寫了為什麼一定要 inline style）。改用 nonce 會讓所有主題直接失效。
 *
 * ── 那它真正的價值在哪 ────────────────────────────────────────
 *
 *   frame-src        只准嵌入 YouTube 與 Google 地圖。CR-003-3 的
 *                    `buildEmbed` 已經只組得出這兩個主機，這是第二層——
 *                    萬一哪天有人繞過它，瀏覽器還會擋一次。
 *   object-src       'none'。<object>／<embed> 是老牌的繞過管道。
 *   base-uri         'self'。擋掉 <base> 綁架所有相對路徑。
 *   frame-ancestors  'none'。點擊劫持。
 *   form-action      'self'。擋掉把表單送去別人家。
 */

export interface CspEnv {
  supabaseUrl?: string;
  r2DomainUrl?: string;
  r2PublicUrl?: string;
  analyticsEndpoint?: string;
  /**
   * R2 的 S3 API 帳號 id。
   *
   * ⚠️ 這一項一開始漏了，而漏掉的後果不是「上傳有點怪」，是**所有媒體
   * 上傳完全不能用**：presigned upload 是瀏覽器直接 PUT 到
   * `<account>.r2.cloudflarestorage.com`，而那個主機不在 connect-src 裡。
   *
   * 沒有立刻發現是因為加 CSP 那天之後沒有人上傳過任何東西，
   * 而 21 項 security 稽核沒有一項在問「加了 CSP 之後既有功能還能不能用」。
   * CSP 擋掉東西的時候不會有伺服器錯誤——只有瀏覽器 console 裡一行字。
   *
   * 放進標頭沒有洩漏問題：這個 id 本來就出現在送給瀏覽器的簽名網址裡。
   */
  r2AccountId?: string;
  /**
   * bucket 名稱。
   *
   * ⚠️ 需要它是因為 AWS SDK 預設用 virtual-hosted-style 定址，
   * 也就是把 bucket 放在**主機名的最前面**：
   *   `https://<bucket>.<account>.r2.cloudflarestorage.com`
   *
   * 只放 `<account>.r2.cloudflarestorage.com` 的話 CSP 仍然擋——
   * 而且 console 的訊息看起來像「已經加了啊」，因為那兩個字串長得很像。
   * 實測過才發現差一段。
   */
  r2Bucket?: string;
}

/** CR-003-3 白名單嵌入的兩個提供者。要與 embeds.ts 組出來的主機一致 */
const EMBED_FRAME_SRC = ["https://www.youtube-nocookie.com", "https://www.google.com"];

/**
 * 從一個可能是完整網址的環境變數取出 origin。
 *
 * 直接把整個網址塞進 CSP 是不行的——CSP 的來源不接受路徑，
 * 而設錯的那一條會讓整個 directive 靜靜失效（瀏覽器只在 console 抱怨一句）。
 * 取不出來就回傳 null，讓呼叫端把它濾掉，而不是留一個壞值。
 */
function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export function buildCsp(env: CspEnv, isDev: boolean): string {
  const supabase = toOrigin(env.supabaseUrl);
  const analytics = toOrigin(env.analyticsEndpoint);
  const media = [toOrigin(env.r2DomainUrl), toOrigin(env.r2PublicUrl)].filter(
    (origin): origin is string => origin !== null,
  );

  /*
   * 上傳走的是 S3 API 的主機，不是公開讀取的媒體網域——兩個是不同的名字。
   * 只放媒體網域的話讀得到圖、上傳不了，而且看起來像網路問題。
   */
  const account = env.r2AccountId?.trim();
  const bucket = env.r2Bucket?.trim();

  /*
   * 兩種定址都放進去。
   *
   * SDK 預設走 virtual-hosted-style（bucket 在主機名前面），但它在某些
   * bucket 名稱下會退回 path-style。只放其中一種的話，退回的那一刻
   * 上傳就整個不能用——而那是「有時候壞」，比「一直壞」更難查。
   */
  const uploadOrigins = account
    ? [
        `https://${account}.r2.cloudflarestorage.com`,
        ...(bucket ? [`https://${bucket}.${account}.r2.cloudflarestorage.com`] : []),
      ]
    : [];

  const connect = ["'self'", supabase, analytics, ...uploadOrigins].filter(
    (source): source is string => source !== null,
  );

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],

    /*
     * 開發時需要 'unsafe-eval'：React 用 eval 重建伺服器端的錯誤堆疊。
     * 正式環境不需要，所以不給。
     */
    ["script-src", ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])]],

    // 見檔頭：inline style 是主題系統的運作方式，不是可以收掉的技術債
    ["style-src", ["'self'", "'unsafe-inline'"]],

    ["img-src", ["'self'", "blob:", "data:", ...media]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    ["media-src", ["'self'", ...media]],
    ["worker-src", ["'self'", "blob:"]],

    // CR-003-3：這條就是加這份 CSP 的主要理由
    ["frame-src", EMBED_FRAME_SRC],

    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];

  const policy = directives.map(([name, sources]) => `${name} ${sources.join(" ")}`);

  /*
   * upgrade-insecure-requests 只在正式環境。
   * 開發是 http://127.0.0.1，加了會把本機資源請求也升級成 https，
   * 而 dev server 沒有 https——結果是整個頁面載不起來。
   */
  if (!isDev) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

/**
 * 一併送出的其他安全標頭。
 *
 * 這些不是 CSP，但屬於同一件事，而且都只有一行。
 * X-Frame-Options 與 frame-ancestors 重複是刻意的——
 * 前者給不支援 frame-ancestors 的舊瀏覽器。
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // 沒有用到的裝置權限一律關掉，包括被我們嵌入的 iframe
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];
