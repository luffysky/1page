import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2（CR-001，Spec V1.2 §8.9）
 *
 * ⚠️ **R2 沒有 RLS。**
 *
 * 資料庫那側的 policy 完全保護不到物件儲存。Supabase Storage 的權限是
 * 宣告式的、和資料表共用同一套 RLS、可被 `pnpm test:db` 驗證；
 * R2 沒有這個機制，上傳授權只剩這支模組與呼叫它的 server action 在把關。
 *
 * 因此本模組匯入 `server-only`：任何 client component 誤引用會直接編譯失敗。
 * 金鑰永遠不會出現在瀏覽器。
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

/**
 * 公開讀取網域可以有兩個，且**兩個都要認**。
 *
 *   NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL   自訂網域（優先，新上傳用它）
 *   NEXT_PUBLIC_R2_PUBLIC_URL          r2.dev（保留，既有記錄用它）
 *
 * ⚠️ 只認新網域會讓所有既有的媒體記錄「查不到 key」而被視為外部網址，
 * 進而在畫面上整批消失。網域搬遷必須是加法，不是替換。
 *
 * 環境變數容許不帶 scheme（設定介面上常常只填主機名），此處補上。
 */
function normalizeBase(value: string | undefined): string | null {
  const raw = value?.trim().replace(/\/$/, "");
  if (!raw) return null;
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

const primaryBase = normalizeBase(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL);
const legacyBase = normalizeBase(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

/** 新上傳一律使用第一個；有自訂網域時就是自訂網域 */
const PUBLIC_BASES = [primaryBase, legacyBase].filter((base): base is string => Boolean(base));

export function hasR2Config(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && PUBLIC_BASES.length > 0);
}

/** 供 next.config 與測試取得所有已知的公開網域主機名 */
export function publicHostnames(): string[] {
  return PUBLIC_BASES.map((base) => new URL(base).hostname);
}

let cached: S3Client | null = null;

function client(): S3Client {
  if (!hasR2Config()) {
    throw new Error("缺少 R2 設定，請參考 .env.example 的 R2_* 變數");
  }

  cached ??= new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });

  return cached;
}

/** Spec §8.9 指定的路徑慣例 */
export function buildObjectKey(projectId: string, extension: string): string {
  return `portfolio/${projectId}/${crypto.randomUUID()}.${extension}`;
}

export function publicUrlFor(key: string): string {
  const base = PUBLIC_BASES[0];
  if (!base) throw new Error("缺少 R2 公開網域設定");
  return `${base}/${key}`;
}

/**
 * 簽發上傳用的短期網址。
 *
 * ── 三個刻意鎖死的參數 ────────────────────────────────────
 *
 * `Key` 由伺服器產生（uuid），呼叫端無法指定路徑。
 *     否則對方可以覆寫別人的檔案，或把東西寫到 bucket 的任意位置。
 *
 * `ContentType` 與 `ContentLength` 必須明確列入 `signableHeaders`。
 *
 *     ⚠️ 只在 PutObjectCommand 帶上 ContentType 是**不夠的**。
 *     presigner 預設只簽 `host`，其餘標頭會被提升成查詢參數而不納入簽章——
 *     實測結果是：拿一張「image/png」的簽名網址上傳 text/html，R2 回 200 接受。
 *     那會讓 MIME 白名單形同虛設。
 *     列入 signableHeaders 後，標頭與簽章不符的請求才會被拒絕。
 *
 * `expiresIn` 短。簽名網址等同一次性的寫入權限，不該長期有效。
 */
export async function createUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return getSignedUrl(client(), command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * 從公開網址反推物件 key。
 *
 * 刪除時需要 key，但資料庫存的是完整網址。回傳 null 表示這個網址不屬於
 * 我們的 bucket——那種情況一律拒絕刪除，避免有人傳入任意網址誘導後端動作。
 *
 * 比對**所有**已知的公開網域，不只是目前用於新上傳的那一個：
 * 網域搬遷後，既有記錄仍存著舊網址。
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = PUBLIC_BASES.find((candidate) => url.startsWith(`${candidate}/`));
  if (!base) return null;

  const key = url.slice(base.length + 1);
  // 再確認一次路徑形狀符合我們的慣例，不接受任意 key
  return /^portfolio\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[A-Za-z0-9]+$/.test(key) ? key : null;
}
