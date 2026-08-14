import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, signIn } from "./helpers/member";

/**
 * 編輯器的圖片上傳（CR-003-4）
 *
 * ── 這裡驗的是整條路徑，不是「按鈕在不在」 ────────────────────
 *
 * 上傳這件事橫跨四個地方：server action 簽發網址、瀏覽器直接 PUT 到 R2、
 * schema 認不認那個網址、以及 next.config 的 remotePatterns。
 * 其中任何一段漏掉的表現都一樣：**圖片不出現，而且沒有錯誤訊息**。
 *
 * 所以這條真的上傳一張圖，然後看預覽裡有沒有那張圖。
 */

const E2E_EMAIL = "e2e-images@1page.test";
const E2E_PASSWORD = "E2e!Images#2026";

/** 1×1 的透明 PNG。內容不重要，重要的是它真的是一張 PNG */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let userId: string | undefined;
const uploaded: string[] = [];

test.beforeAll(async () => {
  userId = await createMember(E2E_EMAIL, E2E_PASSWORD);
});

test.afterAll(async () => {
  /*
   * 測試上傳的東西要自己收掉。
   *
   * 刪帳號不會刪 R2 上的物件——那邊沒有 cascade，也沒有 RLS。
   * 不收的話 bucket 會慢慢被歷次測試的 1×1 PNG 填滿，
   * 而那正是「沒有人在看的東西」最容易發生的地方。
   */
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (uploaded.length > 0 && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    for (const key of uploaded) {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {});
    }
  }

  if (userId) await deleteMember(userId);
});

/**
 * 加一塊作品區塊並選到它。
 *
 * 刻意用「新增區塊」而不是去點模板裡現成的那一塊——哪一套模板有沒有
 * gallery 是會變的事實，釘住它等於釘住一個會過期的東西。
 */
async function addGallery(page: Page) {
  await page.getByText("新增區塊").click();
  await page.getByRole("button", { name: "＋ 作品", exact: true }).click();

  // 新增之後會自動選取它，所以內容面板已經是這一塊的
  const added = page.locator("[data-section-widget^='gallery']").last();
  await expect(added).toBeVisible();
  return added;
}

test("沒登入時說清楚為什麼不能上傳，而不是放一個按了會失敗的框", async ({ page }) => {
  /*
   * 上傳這條線與存檔那條不一樣：存檔是定價（免費編輯、存檔才付費），
   * 上傳是安全——不檢查身分的 presign 端點等於開放公開寫入，
   * 而 R2 沒有 RLS，放行就是真的放行。
   */
  await page.goto("/edit");
  await addGallery(page);

  await expect(page.getByText("上傳圖片需要帳號")).toBeVisible();
  expect(await page.locator("input[type='file']").count()).toBe(0);
});

test("R2 bucket 允許從我們的網站上傳（bucket CORS）", async () => {
  /*
   * ⚠️ 這一條驗的是**基礎設施**，不是程式碼，而它現在是紅的。
   *
   * 媒體上傳是瀏覽器直接 PUT 到 R2 的 S3 端點，也就是一個跨來源的寫入。
   * bucket 沒有 CORS 設定時，瀏覽器連 preflight 都過不了，請求根本送不出去。
   *
   * 這件事從 CR-001 到現在一直沒被發現，因為兩層驗證都繞過了它：
   *   - `pnpm test:db` 的上傳測試是從 Node 發的，Node 不做 CORS
   *   - 後台的作品上傳沒有人從瀏覽器真的跑過（portfolio_media 是空的）
   *
   * 也就是說**媒體上傳從來沒有在瀏覽器裡成功過**。
   * 這條紅著是對的：功能確實不能用，紅燈要留到它真的能用為止。
   *
   * 修法：在 Cloudflare 後台幫 bucket 加 CORS（設定內容見
   * `scripts/r2-cors.mjs`，或用有 Admin Read & Write 權限的 token 跑
   * `node scripts/r2-cors.mjs --apply`）。
   */
  const { R2_ACCOUNT_ID, R2_BUCKET } = process.env;
  expect(R2_ACCOUNT_ID && R2_BUCKET, "缺少 R2_ACCOUNT_ID / R2_BUCKET").toBeTruthy();

  const response = await fetch(
    `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/preflight-probe`,
    {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    },
  );

  expect(
    response.headers.get("access-control-allow-origin"),
    "bucket 沒有 CORS 設定，瀏覽器上傳一律送不出去。修法見 scripts/r2-cors.mjs",
  ).toBeTruthy();
});

test("登入後上傳一張圖，預覽裡真的看得到它", async ({ page }) => {
  await signIn(page, E2E_EMAIL, E2E_PASSWORD);

  const gallery = await addGallery(page);
  expect(await gallery.locator("img").count(), "一開始應該是色塊，不是圖片").toBe(0);

  await page.locator("input[type='file']").setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });

  // 上傳要跑一趟 server action 再跑一趟 R2，用 expect 的自動重試等它
  const image = gallery.locator("img").first();
  await expect(image).toBeVisible({ timeout: 30_000 });

  const src = await image.getAttribute("src");
  expect(src, "圖片網址不是我們自己的媒體網域").toMatch(/^https:\/\//);

  const key = new URL(src!).pathname.replace(/^\//, "");
  expect(key, "上傳的檔案沒有放在 sites/<owner>/ 底下").toMatch(
    /^sites\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/,
  );
  uploaded.push(key);

  /*
   * ⚠️ 還要確認那個網址**真的讀得到**。
   *
   * 只看 DOM 裡有 img 的話，一張破圖也會通過——而破圖正是這條路徑
   * 最可能的失敗結果（簽章對、上傳成功、公開網域卻讀不到）。
   */
  const response = await page.request.get(src!);
  expect(response.status(), "圖片上傳成功了，但公開網域讀不到").toBe(200);
});
