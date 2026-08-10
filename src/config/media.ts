/**
 * 媒體上傳限制（Spec §8.9 / §36）
 *
 * 這份清單是白名單，不是黑名單。黑名單永遠列不完，
 * 而且漏掉一項的後果是「可以上傳任意檔案」。
 */

export interface MediaKind {
  /** 對應資料庫的 portfolio_media.type */
  type: "image" | "video" | "pdf";
  mime: string;
  extensions: string[];
  maxBytes: number;
  label: string;
}

const MB = 1024 * 1024;

export const ALLOWED_MEDIA: MediaKind[] = [
  {
    type: "image",
    mime: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    maxBytes: 8 * MB,
    label: "JPEG",
  },
  { type: "image", mime: "image/png", extensions: ["png"], maxBytes: 8 * MB, label: "PNG" },
  { type: "image", mime: "image/webp", extensions: ["webp"], maxBytes: 8 * MB, label: "WebP" },
  { type: "image", mime: "image/gif", extensions: ["gif"], maxBytes: 12 * MB, label: "GIF" },
  { type: "video", mime: "video/mp4", extensions: ["mp4"], maxBytes: 100 * MB, label: "MP4" },
  { type: "video", mime: "video/webm", extensions: ["webm"], maxBytes: 100 * MB, label: "WebM" },
  { type: "pdf", mime: "application/pdf", extensions: ["pdf"], maxBytes: 20 * MB, label: "PDF" },
];

/**
 * ⚠️ SVG 刻意不在白名單內。
 *
 * Spec §8.3 列了 SVG（註明「需安全處理」），§36 允許
 * 「SVG sanitize or disable raw inline rendering」——此處採後者的最徹底版本：
 * 在有伺服器端 sanitizer（如 DOMPurify）之前不接受上傳。
 *
 * 理由：SVG 是可執行的 XML，可內嵌 <script>、外部參照與事件屬性。
 *
 * ⚠️ 2026-08-11 更新：媒體網域已改為 1page-r2.snowrealm.pet，
 * 與站台 1page.snowrealm.pet **同註冊網域**。
 *
 * 這正是先前預告會發生的事——當時的說明寫著「目前 r2.dev 與站台不同註冊網域，
 * 風險有限，但那是『部署剛好安全』而非『功能本身安全』；換成自訂網域後
 * 風險會立刻回來，而那時不會有人記得這件事」。現在它回來了。
 *
 * 同註冊網域下，若有任何 cookie 設定在 .snowrealm.pet 範圍，
 * 一個惡意 SVG 被直接開啟時就能讀到它。目前 Supabase 的 auth cookie
 * 是 host-only（只綁 1page.snowrealm.pet），因此尚未實際暴露——
 * 但這又是一個「剛好安全」，不是設計上的保證。
 *
 * 結論不變且更堅定：在有伺服器端 sanitizer 之前，SVG 不進白名單。
 *
 * 要開放時：加入 sanitizer → 加進白名單 → 補上針對惡意 SVG 的測試。
 */
export const SVG_INTENTIONALLY_EXCLUDED = true;

export const ACCEPT_ATTRIBUTE = ALLOWED_MEDIA.map((kind) => kind.mime).join(",");

export const MAX_ANY_BYTES = Math.max(...ALLOWED_MEDIA.map((kind) => kind.maxBytes));

export function findMediaKind(mime: string): MediaKind | null {
  return ALLOWED_MEDIA.find((kind) => kind.mime === mime) ?? null;
}

/**
 * 從檔名取副檔名，並確認它與 MIME 相符。
 *
 * 只檢查 MIME 是不夠的：MIME 由瀏覽器提供，可以偽造。
 * 只檢查副檔名也不夠：副檔名同樣可以隨便改。
 * 兩者都檢查、且必須互相對應，才擋得住「把 .html 改名成 .png 上傳」這類手法。
 *
 * 真正的內容驗證（檢查檔案開頭的 magic bytes）需要讀取檔案內容，
 * 而 presigned URL 的上傳不經過我們的伺服器。這是此架構的已知取捨：
 * 換來的是不必讓大檔案流經 Node 行程。
 */
export function extensionMatchesMime(filename: string, kind: MediaKind): string | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename);
  if (!match) return null;

  const ext = match[1]!.toLowerCase();
  return kind.extensions.includes(ext) ? ext : null;
}

/**
 * 檔名淨化。
 *
 * 實際儲存的檔名是 uuid，因此這裡淨化的是「顯示用」的原始檔名，
 * 避免路徑穿越（../）、控制字元與過長字串進到資料庫或畫面上。
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\]/g, "-")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 120);
}

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
