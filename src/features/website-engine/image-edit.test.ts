import { describe, expect, it } from "vitest";

import {
  canEdit,
  clampRegion,
  FULL_FRAME,
  IDENTITY_EDIT,
  isIdentityEdit,
  outputFilename,
  outputType,
  rotate,
  rotatedSize,
} from "./image-edit";

/**
 * 上傳前的圖片編輯（CR-003-4）
 *
 * `renderEdit` 需要 canvas，那一段由 e2e 在真的瀏覽器裡驗。
 * 這裡驗的是純計算的部分——那些正是「預覽跟結果不一樣」的來源。
 */

describe("旋轉", () => {
  it("繞一圈回到原點", () => {
    let rotation = rotate(0, 1);
    for (let step = 0; step < 3; step += 1) rotation = rotate(rotation, 1);
    expect(rotation).toBe(0);
  });

  it("往回轉不會變成負的", () => {
    // 負的角度會讓 canvas 轉錯方向，而且 rotatedSize 的判斷也會失效
    expect(rotate(0, -1)).toBe(270);
    expect(rotate(90, -1)).toBe(0);
  });

  it("90 與 270 度時長寬互換", () => {
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 270)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 180)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
  });
});

describe("範圍夾制", () => {
  it("超出邊界時往內推，而不是把寬高砍掉", () => {
    /*
     * 砍寬高的話，把框拖到右邊界會讓它越拖越窄——
     * 使用者以為自己在移動它，實際上在縮小它。
     */
    const pushed = clampRegion({ x: 0.9, y: 0.9, w: 0.4, h: 0.4 });

    expect(pushed.w).toBe(0.4);
    expect(pushed.h).toBe(0.4);
    expect(pushed.x).toBeCloseTo(0.6);
    expect(pushed.y).toBeCloseTo(0.6);
  });

  it("寬高不會變成零", () => {
    // 零寬的裁切框畫出來是一張 0 像素的圖，而 toBlob 會回 null
    const tiny = clampRegion({ x: 0.5, y: 0.5, w: 0, h: -1 });
    expect(tiny.w).toBeGreaterThan(0);
    expect(tiny.h).toBeGreaterThan(0);
  });

  it("負座標拉回 0", () => {
    expect(clampRegion({ x: -0.5, y: -0.5, w: 0.5, h: 0.5 })).toMatchObject({ x: 0, y: 0 });
  });
});

describe("輸出格式", () => {
  it("PNG 保持 PNG", () => {
    // PNG 可能有透明背景，轉 JPEG 會變成黑色或白色的塊
    expect(outputType("image/png")).toBe("image/png");
  });

  it("其餘轉 JPEG", () => {
    expect(outputType("image/jpeg")).toBe("image/jpeg");
    expect(outputType("image/webp")).toBe("image/jpeg");
  });

  it("副檔名跟著輸出格式走", () => {
    // 內容是 JPEG、副檔名還寫 .webp 的話，後端的「副檔名與 MIME 相符」會擋下來
    expect(outputFilename("photo.webp", "image/jpeg")).toBe("photo.jpg");
    expect(outputFilename("photo.png", "image/png")).toBe("photo.png");
    expect(outputFilename("no-extension", "image/jpeg")).toBe("no-extension.jpg");
  });

  it("GIF 不能編輯", () => {
    /*
     * 動畫 GIF 畫進 canvas 只剩第一格。使用者不會預期
     * 「裁切一下」順便把動畫弄不見了——所以它走原樣上傳那條路。
     */
    expect(canEdit("image/gif")).toBe(false);
    expect(canEdit("image/jpeg")).toBe(true);
    expect(canEdit("image/png")).toBe(true);
    expect(canEdit("image/webp")).toBe(true);
  });
});

describe("沒有動過的編輯", () => {
  it("認得出來，這樣按鈕才能說「直接上傳」", () => {
    expect(isIdentityEdit(IDENTITY_EDIT)).toBe(true);
    expect(isIdentityEdit({ ...IDENTITY_EDIT, rotation: 90 })).toBe(false);
    expect(isIdentityEdit({ ...IDENTITY_EDIT, crop: { ...FULL_FRAME, w: 0.5 } })).toBe(false);
    expect(
      isIdentityEdit({
        ...IDENTITY_EDIT,
        blurs: [{ id: "a", x: 0, y: 0, w: 0.1, h: 0.1, strength: 4 }],
      }),
    ).toBe(false);
  });
});
