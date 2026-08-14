import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * R2 bucket 的 CORS 設定
 *
 * ── 為什麼需要這支 ────────────────────────────────────────────
 *
 * 媒體上傳是**瀏覽器直接 PUT 到 R2**（presigned URL，檔案不經過我們的
 * 伺服器）。那是一個跨來源的寫入請求，所以瀏覽器會先送 preflight，
 * 而 bucket 沒有 CORS 設定時 preflight 就過不了。
 *
 * ⚠️ 這件事從 CR-001 做完到現在一直沒被發現，因為：
 *   - `pnpm test:db` 的上傳測試是從 Node 發的，Node 不做 CORS
 *   - 後台的作品上傳沒有人從瀏覽器真的跑過一次（portfolio_media 是空的）
 *
 * 也就是說**媒體上傳從來沒有在瀏覽器裡成功過**，而兩層阻擋
 * （我們自己的 CSP、R2 的 CORS）都只在 console 裡留一行字。
 *
 * ── 這份設定給了什麼 ──────────────────────────────────────────
 *
 * 只放行我們自己的來源，而且只放行上傳需要的方法與標頭。
 * 它**不會**讓任何人多出寫入權限：寫入仍然需要一個我們簽發的、
 * 五分鐘到期、綁死 key／content-type／content-length 的網址。
 * CORS 只決定「瀏覽器願不願意把請求送出去」。
 *
 * 用法：
 *   node scripts/r2-cors.mjs            只顯示目前設定與將要套用的內容
 *   node scripts/r2-cors.mjs --apply    真的寫進去
 */

const {
  R2_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
  R2_BUCKET: bucket,
  NEXT_PUBLIC_SITE_URL: siteUrl,
} = process.env;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("缺少 R2_* 設定，請參考 .env.example");
  process.exit(1);
}

/*
 * 正式網址從環境變數來，開發用的兩個寫死。
 *
 * 127.0.0.1 與 localhost 都要：Playwright 用前者，人用瀏覽器多半打後者，
 * 而 CORS 是逐字比對來源字串的——差一個字就整個不通。
 */
const origins = [
  siteUrl?.trim().replace(/\/$/, ""),
  "http://127.0.0.1:3000",
  "http://localhost:3000",
].filter(Boolean);

const rules = [
  {
    AllowedOrigins: origins,
    // PUT 是上傳，GET/HEAD 是上傳後立刻讀回來確認
    AllowedMethods: ["PUT", "GET", "HEAD"],
    /*
     * 只放行簽章真的用到的標頭。
     *
     * `content-type` 與 `content-length` 都列在 presigner 的 signableHeaders 裡，
     * 少放行任何一個，preflight 就會擋下實際請求。
     */
    AllowedHeaders: ["content-type", "content-length"],
    ExposeHeaders: ["etag"],
    MaxAgeSeconds: 3600,
  },
];

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

console.log(`bucket：${bucket}`);
console.log(`允許的來源：\n  ${origins.join("\n  ")}\n`);

try {
  const current = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("目前的設定：");
  console.log(JSON.stringify(current.CORSRules, null, 2));
} catch (error) {
  // NoSuchCORSConfiguration＝從來沒設過，那正是這支腳本要修的狀態
  console.log(`目前的設定：（沒有）${error.name ? ` [${error.name}]` : ""}`);
}

if (!process.argv.includes("--apply")) {
  console.log("\n將要套用：");
  console.log(JSON.stringify(rules, null, 2));
  console.log("\n加上 --apply 才會真的寫進去。");
  process.exit(0);
}

await s3.send(
  new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }),
);

const after = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log("\n已套用，讀回來確認：");
console.log(JSON.stringify(after.CORSRules, null, 2));
