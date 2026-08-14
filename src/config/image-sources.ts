/**
 * 網站設定裡的圖片可以來自哪裡（Spec §36 image source validation）
 *
 * ── 為什麼是白名單，而且只有我們自己的網域 ────────────────────
 *
 * SiteConfig 是不可信輸入：它可能來自 Agent 的 tool call、使用者匯入的
 * JSON、或資料庫裡一份很舊的草稿。任何一個字串欄位放進 `<img src>`
 * 就等於「叫訪客的瀏覽器去連那個網址」。
 *
 * 允許任意 https 的話會有兩件事：
 *   1. 對方的伺服器拿得到每一位訪客的 IP 與 Referer
 *   2. 用了 next/image 的話，**我們的伺服器**會去代抓那張圖
 *      （對方看到的是我們機器的 IP，而且流量算我們的）
 *
 * 所以只認自己的媒體網域。要放別人的圖，先上傳過來。
 *
 * ⚠️ 兩個網域都要認：自訂網域是新上傳用的，r2.dev 那個是既有記錄用的。
 * 只認新的會讓舊記錄整批被判成外部網址而消失（見 r2.ts 的同一段說明）。
 *
 * 這個模組**不能**匯入 server-only：schema 會在瀏覽器端跑
 * （編輯器就地驗證），而 NEXT_PUBLIC_ 的值本來就會進 bundle。
 */

/**
 * 環境變數容許不帶 scheme（設定介面上常常只填主機名），此處補上。
 */
function normalizeBase(value: string | undefined): string | null {
  const raw = value?.trim().replace(/\/$/, "");
  if (!raw) return null;

  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    return null;
  }
}

/**
 * 公開讀取網域，**順序有意義**：第一個是新上傳用的。
 *
 *   NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL   自訂網域（優先）
 *   NEXT_PUBLIC_R2_PUBLIC_URL          r2.dev（保留，既有記錄用它）
 *
 * ⚠️ 只認新網域會讓所有既有的媒體記錄「查不到 key」而被視為外部網址，
 * 進而在畫面上整批消失。網域搬遷必須是加法，不是替換。
 *
 * 這份清單是 r2.ts、next.config 的 remotePatterns、以及 schema 的圖片
 * 來源檢查**共同**的來源。抄第二份的話，換網域時漏改的那一份
 * 會安靜地擋掉（或安靜地放行）圖片。
 */
export function publicMediaBases(): string[] {
  return [
    normalizeBase(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL),
    normalizeBase(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  ].filter((base): base is string => Boolean(base));
}

export function allowedImageHosts(): string[] {
  return publicMediaBases().map((base) => new URL(base).hostname);
}

/**
 * 沒設定媒體網域時**一個都不准**，不是「都准」。
 *
 * 失敗方向要選會少東西的那一邊：設定漏了的表現是圖片不顯示（看得出來），
 * 而不是任意來源全部放行（看不出來，而且看不出來的那個是安全問題）。
 */
export function isAllowedImageUrl(value: string): boolean {
  const hosts = allowedImageHosts();
  if (hosts.length === 0) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}
