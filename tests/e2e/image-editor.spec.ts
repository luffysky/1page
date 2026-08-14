import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, signIn } from "./helpers/member";

/**
 * 上傳前的圖片編輯：旋轉、裁切、局部模糊（CR-003-4）
 *
 * ── 這裡驗的是「編輯真的改到了輸出」 ─────────────────────────
 *
 * 畫面上看得到裁切框不代表輸出被裁過。這種功能最典型的壞法是
 * **預覽對、輸出不對**——因為預覽是縮小的，而輸出是原始解析度，
 * 兩邊各有一次座標換算。
 *
 * 所以這裡量的是輸出 File 的實際尺寸，不是畫面上的框。
 *
 * ⚠️ 真正的上傳會失敗（R2 bucket 還沒設 CORS），那不影響這一組：
 * 編輯發生在上傳之前，而我們攔的是交給上傳那一刻的檔案。
 */

const EMAIL = "e2e-imageedit@1page.test";
const PASSWORD = "E2e!ImageEdit#2026";

let userId: string | undefined;

test.beforeAll(async () => {
  userId = await createMember(EMAIL, PASSWORD);
});

test.afterAll(async () => {
  if (userId) await deleteMember(userId);
});

/**
 * 攔住交給上傳的那個檔案。
 *
 * 在 `File.prototype` 上掛不到，所以改攔 XHR 的 send——
 * 那正是編輯完成之後唯一會拿到最終檔案的地方。
 * 順便把它畫進 canvas 量尺寸，因為「裁切有沒有生效」就是尺寸的問題。
 */
async function captureUploadedImage(page: Page) {
  await page.addInitScript(() => {
    const original = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (body instanceof File && body.type.startsWith("image/")) {
        const url = URL.createObjectURL(body);
        const image = new Image();
        image.onload = () => {
          /*
           * 順便取樣中央那一點的顏色。
           *
           * 「模糊有沒有生效」用尺寸看不出來——它不改尺寸，只改像素。
           * 在兩個顏色的交界處取樣：沒模糊時那一點是純色，
           * 模糊之後會變成兩者的混合。
           */
          const probe = document.createElement("canvas");
          probe.width = image.width;
          probe.height = image.height;
          const ctx = probe.getContext("2d");
          ctx?.drawImage(image, 0, 0);
          const pixel = ctx?.getImageData(
            Math.floor(image.width / 2),
            Math.floor(image.height / 2),
            1,
            1,
          ).data;

          (window as unknown as Record<string, unknown>).__uploaded = {
            name: body.name,
            type: body.type,
            width: image.width,
            height: image.height,
            centerPixel: pixel ? [pixel[0], pixel[1], pixel[2]] : null,
          };
          URL.revokeObjectURL(url);
        };
        image.src = url;
      }
      return original.call(this, body);
    };
  });
}

async function openGalleryUpload(page: Page) {
  await page.goto("/edit");
  await page.getByText("新增區塊").click();
  await page.getByRole("button", { name: "＋ 作品", exact: true }).click();

  await expect(page.getByRole("button", { name: "選擇圖片" })).toBeVisible();

  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#e63946";
    ctx.fillRect(0, 0, 200, 150);
    ctx.fillStyle = "#457b9d";
    ctx.fillRect(200, 0, 200, 150);
    ctx.fillStyle = "#2a9d8f";
    ctx.fillRect(0, 150, 200, 150);
    ctx.fillStyle = "#e9c46a";
    ctx.fillRect(200, 150, 200, 150);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    const buffer = await blob!.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  });

  await page.locator("input[type='file']").setInputFiles({
    name: "quadrants.png",
    mimeType: "image/png",
    buffer: Buffer.from(png),
  });

  // 編輯器要自己跳出來，不必再按一次「編輯」
  await expect(page.getByText("編輯「quadrants.png」")).toBeVisible({ timeout: 15_000 });
}

const uploadedImage = (page: Page) =>
  page.evaluate(() => (window as unknown as Record<string, unknown>).__uploaded);

test("選了圖片就直接進編輯器，不用再多按一次", async ({ page }) => {
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  // 預覽是一張 canvas，不是原圖的 img——旋轉與模糊都畫在上面
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /向左轉/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /加一塊模糊/ })).toBeVisible();
});

test("裁切真的改到輸出的尺寸，不只是畫面上的框", async ({ page }) => {
  await captureUploadedImage(page);
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  /*
   * 用數字欄位設定裁切，不是拖曳。
   *
   * 這同時驗了 WCAG 2.1 §2.5.7 的替代路徑：拖曳與數字欄位改的是
   * 同一份狀態，所以只要數字這條走得通，鍵盤使用者就做得到。
   */
  /*
   * 用可及名稱定位。
   *
   * ⚠️ 第一版寫 `getByLabel("上")`，結果同時選到那個檔案輸入
   * （它的 aria-label 是「選擇要上傳的圖片」，含有「上」）。
   * 那不只是測試選錯——欄位的名稱本來就該說出自己屬於哪一塊，
   * 否則加了三塊模糊之後畫面上會有四個「左」。已改成
   * 「裁切範圍的左」這種形式。
   */
  await page.getByLabel("裁切範圍的左").fill("0");
  await page.getByLabel("裁切範圍的上").fill("0");
  await page.getByLabel("裁切範圍的寬").fill("50");
  await page.getByLabel("裁切範圍的高").fill("50");

  await page.getByRole("button", { name: "套用並上傳" }).click();

  await expect
    .poll(async () => await uploadedImage(page), { timeout: 20_000 })
    .toMatchObject({ width: 200, height: 150 });
});

test("旋轉 90 度之後長寬互換", async ({ page }) => {
  await captureUploadedImage(page);
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  await page.getByRole("button", { name: /向右轉/ }).click();
  await page.getByRole("button", { name: "套用並上傳" }).click();

  // 400×300 轉 90 度就是 300×400。這條抓的是「rotatedSize 有沒有真的換軸」
  await expect
    .poll(async () => await uploadedImage(page), { timeout: 20_000 })
    .toMatchObject({ width: 300, height: 400 });
});

test("模糊真的改到像素，不只是畫面上的虛線框", async ({ page }) => {
  await captureUploadedImage(page);
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  /*
   * 測試圖是四個純色象限，正中央是四色交界。
   *
   * 沒有模糊時，正中央那一點會是其中一個象限的純色；
   * 模糊之後它變成四色的混合——所以只要它不等於任何一個原色，
   * 就證明模糊真的畫到像素上了，而不是只畫了一個虛線框。
   */
  await page.getByRole("button", { name: /加一塊模糊/ }).click();

  await page.getByLabel("第 1 塊模糊的左").fill("30");
  await page.getByLabel("第 1 塊模糊的上").fill("30");
  await page.getByLabel("第 1 塊模糊的寬").fill("40");
  await page.getByLabel("第 1 塊模糊的高").fill("40");

  await page.getByRole("button", { name: "套用並上傳" }).click();

  const uploaded = await expect
    .poll(async () => await uploadedImage(page), { timeout: 20_000 })
    .not.toBeUndefined()
    .then(() => uploadedImage(page));

  const pixel = (uploaded as { centerPixel: number[] }).centerPixel;
  const PURE = [
    [230, 57, 70],
    [69, 123, 157],
    [42, 157, 143],
    [233, 196, 106],
  ];

  const isPure = PURE.some((colour) =>
    colour.every((channel, index) => Math.abs(channel - pixel[index]!) < 12),
  );

  expect(isPure, `正中央仍然是純色 rgb(${pixel.join(",")})——模糊沒有生效`).toBe(false);
});

test("沒動過任何東西時，按鈕說「直接上傳」", async ({ page }) => {
  /*
   * 一個沒有裁切也沒有旋轉的編輯，按鈕若寫「套用並上傳」會讓人以為
   * 圖片被動過手腳。文字要說得出實際發生的事。
   */
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  await expect(page.getByRole("button", { name: "直接上傳" })).toBeVisible();

  await page.getByRole("button", { name: /向右轉/ }).click();
  await expect(page.getByRole("button", { name: "套用並上傳" })).toBeVisible();
});

test("取消就跳過這張，不會偷偷上傳", async ({ page }) => {
  await captureUploadedImage(page);
  await signIn(page, EMAIL, PASSWORD);
  await openGalleryUpload(page);

  await page.getByRole("button", { name: "取消" }).click();

  await expect(page.getByText("編輯「quadrants.png」")).toHaveCount(0);
  expect(await uploadedImage(page), "按了取消卻還是傳出去了").toBeUndefined();
});

test("GIF 不進編輯器——畫進 canvas 只會剩第一格", async ({ page }) => {
  await signIn(page, EMAIL, PASSWORD);
  await page.goto("/edit");
  await page.getByText("新增區塊").click();
  await page.getByRole("button", { name: "＋ 作品", exact: true }).click();

  // 最小的合法 GIF89a
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

  await page.locator("input[type='file']").setInputFiles({
    name: "animated.gif",
    mimeType: "image/gif",
    buffer: gif,
  });

  /*
   * 直接進上傳（會因為 bucket 沒設 CORS 而失敗），但**不會**開編輯器。
   * 使用者不會預期「裁切一下」順便把動畫弄不見了。
   */
  /*
   * 只比對這個檔名——`編輯「作品」` 是內容面板的標題，
   * 用 /編輯「/ 會把它一起選到（第一版就是這樣紅的）。
   */
  await expect(page.getByText("編輯「animated.gif」")).toHaveCount(0);
  await expect(page.getByText("animated.gif")).toBeVisible({ timeout: 15_000 });
});
