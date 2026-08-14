import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buildObjectKey,
  buildSiteObjectKey,
  createUploadUrl,
  keyFromPublicUrl,
  publicUrlFor,
} from "@/lib/storage/r2";

/**
 * R2 上傳鏈路的實測（CR-001，Spec §8.9 / §36）。
 *
 * ⚠️ R2 沒有 RLS。資料庫那側的 policy 保護不到物件儲存，
 * 因此「簽名網址到底鎖死了什麼」必須用真的請求驗證，不能只看程式碼。
 *
 * 需要真實 R2 憑證，故在 `pnpm test:db` 而非 `pnpm test`。
 */

const PROJECT_ID = "00000000-0000-4000-8000-00000000dead";
const cleanup: string[] = [];

let s3: S3Client;

beforeAll(() => {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "NEXT_PUBLIC_R2_PUBLIC_URL",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `缺少 R2 設定：${missing.join(", ")}。\n` +
        "這個測試不會靜默跳過——物件儲存的授權邊界沒驗證過就是沒驗證過。",
    );
  }

  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
});

async function removeAll() {
  for (const key of cleanup) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
      .catch(() => {});
  }
}

describe("物件路徑", () => {
  it("符合 Spec §8.9 的慣例，且檔名為伺服器產生的 uuid", () => {
    const key = buildObjectKey(PROJECT_ID, "png");
    expect(key).toMatch(/^portfolio\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
  });

  it("同一件作品連續產生的 key 不會相同", () => {
    const a = buildObjectKey(PROJECT_ID, "png");
    const b = buildObjectKey(PROJECT_ID, "png");
    expect(a).not.toBe(b);
  });
});

describe("編輯器上傳的圖片（CR-003-4）", () => {
  const OWNER_ID = "00000000-0000-4000-8000-00000000beef";

  it("放在 sites/<owner>/ 底下，與作品集分開", () => {
    /*
     * 兩者的信任層級不一樣：portfolio 是員工放上去的，sites 是任何登入者的。
     * 混在同一個前綴下的話，之後想針對其中一邊做保留期或配額都得先分家。
     */
    const key = buildSiteObjectKey(OWNER_ID, "jpg");
    expect(key).toMatch(/^sites\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    expect(key.startsWith(`sites/${OWNER_ID}/`)).toBe(true);
  });

  it("這條路徑的網址也還原得回 key", () => {
    // 還原不回來的話，之後要刪掉某個人的圖時會被當成外部網址而拒絕刪除
    const key = buildSiteObjectKey(OWNER_ID, "webp");
    expect(keyFromPublicUrl(publicUrlFor(key))).toBe(key);
  });
});

describe("keyFromPublicUrl 只接受自家 bucket 的網址", () => {
  it("自家網址可還原 key", () => {
    const key = buildObjectKey(PROJECT_ID, "webp");
    expect(keyFromPublicUrl(publicUrlFor(key))).toBe(key);
  });

  it("外部網址一律拒絕", () => {
    // 否則有人可以傳入任意網址誘導後端刪除或記錄
    expect(keyFromPublicUrl("https://evil.example.com/portfolio/a/b.png")).toBeNull();
  });

  it("路徑形狀不符的一律拒絕", () => {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "");
    expect(keyFromPublicUrl(`${base}/../../secret.txt`)).toBeNull();
    expect(keyFromPublicUrl(`${base}/portfolio/not-a-uuid/x.png`)).toBeNull();
    expect(keyFromPublicUrl(`${base}/other-prefix/a/b.png`)).toBeNull();
  });
});

describe("簽名網址鎖死上傳內容", () => {
  it("依簽章上傳可成功，且公開讀得到", async () => {
    const body = Buffer.from("test-image-bytes");
    const key = buildObjectKey(PROJECT_ID, "png");
    cleanup.push(key);

    const url = await createUploadUrl({
      key,
      contentType: "image/png",
      contentLength: body.byteLength,
    });

    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body,
    });
    expect(put.status).toBe(200);

    const read = await fetch(publicUrlFor(key));
    expect(read.status).toBe(200);

    await removeAll();
  });

  it("換掉 Content-Type 會被 R2 拒絕", async () => {
    // 這是「簽章鎖住了什麼」的關鍵驗證：拿到一張「PNG」的簽名網址，
    // 不能改拿去上傳 HTML。若這條過了，MIME 白名單形同虛設。
    const body = Buffer.from("<html>evil</html>");
    const key = buildObjectKey(PROJECT_ID, "png");
    cleanup.push(key);

    const url = await createUploadUrl({
      key,
      contentType: "image/png",
      contentLength: body.byteLength,
    });

    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body,
    });

    expect(put.status).toBeGreaterThanOrEqual(400);
    await removeAll();
  });

  it("超過簽章大小的內容會被拒絕", async () => {
    const key = buildObjectKey(PROJECT_ID, "png");
    cleanup.push(key);

    const url = await createUploadUrl({ key, contentType: "image/png", contentLength: 10 });

    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: Buffer.alloc(5000),
    });

    expect(put.status).toBeGreaterThanOrEqual(400);
    await removeAll();
  });

  it("簽章對應的 key 無法被改寫成其他路徑", async () => {
    const key = buildObjectKey(PROJECT_ID, "png");
    const url = await createUploadUrl({ key, contentType: "image/png", contentLength: 4 });

    // 把網址中的 key 換成別的路徑，簽章即失效
    const tampered = url.replace(key, `portfolio/${PROJECT_ID}/tampered.png`);
    const put = await fetch(tampered, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from("evil"),
    });

    expect(put.status).toBeGreaterThanOrEqual(400);
  });
});

describe("網域搬遷", () => {
  it("新上傳使用自訂網域（若已設定）", () => {
    const custom = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL;
    if (!custom) return;

    const host = new URL(publicUrlFor(buildObjectKey(PROJECT_ID, "png"))).hostname;
    const normalized = custom.startsWith("http") ? custom : `https://${custom}`;
    expect(host).toBe(new URL(normalized).hostname);
  });

  it("舊網域的既有網址仍可辨識", () => {
    // 只認新網域會讓所有既有媒體記錄被當成外部網址而整批消失。
    // 網域搬遷必須是加法，不是替換。
    const legacy = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    if (!legacy) return;

    const base = legacy.endsWith("/") ? legacy.slice(0, -1) : legacy;
    const key = buildObjectKey(PROJECT_ID, "png");
    expect(keyFromPublicUrl(`${base}/${key}`)).toBe(key);
  });
});

describe("bucket 不可公開列舉", () => {
  it("公開網域不提供物件清單", async () => {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "");
    const response = await fetch(`${base}/`);

    // r2.dev 的公開端點只提供單一物件讀取，不應回傳可列舉的清單
    const text = response.ok ? await response.text() : "";
    expect(text).not.toContain("<ListBucketResult");
    expect(text).not.toContain("portfolio/");
  });
});
