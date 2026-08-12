/**
 * 白名單嵌入（CR-003-3 / Spec §36）
 *
 * ── 為什麼不是接受一段 HTML 或一個網址 ────────────────────────
 *
 * MaoTravelBlog 那類建站工具有 `html` 與 `embed` 兩種區塊，
 * 使用者貼一段 `<iframe>` 或 `<script>` 進去就渲染。那等於在自己的產品裡
 * 開一個 XSS 洞——任何能編輯網站的人都能在頁面上執行 JavaScript，
 * 而這個專案的網站是 Agent 在編輯的。
 *
 * 連「只接受網址」都不夠：`javascript:`、`data:`、開放導向、
 * 以及指向攻擊者主機的 iframe，全都只是一個字串。
 *
 * 所以這裡收的是**提供者 + 一個識別碼**，網址由我們組。
 * 使用者拿到一樣的功能，而我們完全不需要相信他給的字串——
 * YouTube 的 id 是 11 個 base64url 字元，地圖的查詢整串 encodeURIComponent。
 * 兩者都不可能組出別的主機。
 *
 * ⚠️ 新增提供者時，src 一律在這裡組。任何「讓使用者填網址」的欄位
 * 都會讓上面整段推理失效。
 */

export type EmbedVariant = "youtube" | "map";

export interface EmbedSpec {
  src: string;
  /** iframe 的無障礙名稱。沒有 title 的 iframe 是 axe 的 serious 違規 */
  title: string;
  /** 允許的功能。空字串代表什麼都不給 */
  allow: string;
  referrerPolicy: "no-referrer" | "strict-origin-when-cross-origin";
  /** 還沒載入時顯示的說明，也是 facade 按鈕上的字 */
  facadeLabel: string;
  /** 按下去之後會連到誰。要講給訪客聽，所以是明寫的欄位，
   *  不是從 referrerPolicy 之類的東西反推出來的 */
  provider: string;
}

export type EmbedResult = { ok: true; spec: EmbedSpec } | { ok: false; reason: string };

/**
 * YouTube 影片 id：11 個 base64url 字元。
 *
 * 這個規則本身就是防線——通過的字串不可能含有 `/`、`?`、`:` 或引號，
 * 也就不可能把 src 帶去別的路徑或主機。
 */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** 地圖查詢字串的長度上限。地址再長也不會到這個數字 */
const MAX_MAP_QUERY = 160;

export function buildEmbed(variant: string, content: Record<string, unknown>): EmbedResult {
  if (variant === "youtube") {
    const videoId = content.videoId;

    if (typeof videoId !== "string" || !YOUTUBE_ID.test(videoId)) {
      return { ok: false, reason: "YouTube 影片 id 不正確（應為 11 個英數字元）。" };
    }

    return {
      ok: true,
      spec: {
        /*
         * youtube-nocookie.com 而不是 youtube.com：
         * 前者在使用者實際播放之前不寫追蹤 cookie。
         * 這是別人的網站，訪客是別人的客戶——沒有理由替 Google 多收一份資料。
         */
        src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        title: typeof content.title === "string" && content.title ? content.title : "YouTube 影片",
        allow: "accelerometer; encrypted-media; picture-in-picture; fullscreen",
        /*
         * YouTube 有「只允許特定網域嵌入」的設定，判斷依據是 referrer，
         * 所以這裡不能用 no-referrer——會讓那些影片顯示「無法播放」。
         * strict-origin 只送出來源網域，不送路徑。
         */
        referrerPolicy: "strict-origin-when-cross-origin",
        facadeLabel: "播放影片",
        provider: "YouTube",
      },
    };
  }

  if (variant === "map") {
    const query = content.query;

    if (typeof query !== "string" || query.trim().length === 0) {
      return { ok: false, reason: "地圖需要一個地址或地標名稱。" };
    }
    if (query.length > MAX_MAP_QUERY) {
      return { ok: false, reason: "地址太長了。" };
    }

    /*
     * 整串 encodeURIComponent，所以 `&`、`#`、引號、換行全部變成 %XX，
     * 沒有辦法跳出 query 參數、也沒有辦法改變主機。
     */
    return {
      ok: true,
      spec: {
        src: `https://www.google.com/maps?q=${encodeURIComponent(query.trim())}&output=embed`,
        title: `地圖：${query.trim()}`,
        allow: "",
        referrerPolicy: "no-referrer",
        facadeLabel: "顯示地圖",
        provider: "Google 地圖",
      },
    };
  }

  return { ok: false, reason: `不支援的嵌入類型：${variant}` };
}

/**
 * iframe 的 sandbox。
 *
 * `allow-scripts` 與 `allow-same-origin` 同時給，一般會被提醒
 * 「被嵌入的文件可以自己拿掉 sandbox」——但那句話的前提是**同源**。
 * 這裡的 src 一定是 youtube-nocookie.com 或 google.com，
 * 它的 same-origin 是它自己，不是我們。它拿不到我們的 DOM、
 * cookie 或 localStorage。
 *
 * 兩個都是播放器與地圖運作的必要條件，拿掉任何一個都只會得到白框。
 */
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-presentation";
