/**
 * 上傳前的圖片編輯：旋轉、裁切、局部模糊（CR-003-4）
 *
 * ── 為什麼在瀏覽器做，不在伺服器 ──────────────────────────────
 *
 * 1page 的上傳是 presigned 直傳 R2，檔案**完全不經過我們的伺服器**。
 * 要在伺服器裁切就得先把檔案收進來、處理完再送出去——那等於把
 * 「不讓 8MB 影像流經 Node 行程」那個決定整個推翻。
 *
 * 在瀏覽器做還有兩個附帶好處：
 *   - 裁掉的部分**從來沒有離開過使用者的電腦**。用模糊遮住臉之後，
 *     原圖不會有一份留在我們的 bucket 裡
 *   - 裁切後檔案變小，上傳更快，也更不容易撞到大小上限
 *
 * ── 座標一律用比例（0..1），不用像素 ─────────────────────────
 *
 * 預覽是縮小的，輸出是原始解析度。存像素的話，兩邊要各自換算一次，
 * 而換算錯的表現是「預覽跟結果不一樣」——那種 bug 很難用眼睛抓。
 * 存比例則兩邊都是同一組數字乘上自己的尺寸。
 *
 * 這個模組是純函式，不碰 DOM 事件也不碰 React，所以測得動。
 */

/** 旋轉只做 90 度的倍數。任意角度會產生鋸齒邊與透明角落，那是另一個題目 */
export type Rotation = 0 | 90 | 180 | 270;

/** 比例座標。x/y 是左上角，w/h 是寬高，全部相對於**旋轉後**的影像 */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlurRegion extends Region {
  id: string;
  /** 模糊強度，相對於影像短邊的百分比。用比例才能在不同解析度下看起來一樣 */
  strength: number;
}

export interface ImageEdit {
  rotation: Rotation;
  /** 裁切範圍。整張都要就是 {0,0,1,1} */
  crop: Region;
  blurs: BlurRegion[];
}

export const FULL_FRAME: Region = { x: 0, y: 0, w: 1, h: 1 };

export const IDENTITY_EDIT: ImageEdit = { rotation: 0, crop: FULL_FRAME, blurs: [] };

export function isIdentityEdit(edit: ImageEdit): boolean {
  return (
    edit.rotation === 0 &&
    edit.blurs.length === 0 &&
    edit.crop.x === 0 &&
    edit.crop.y === 0 &&
    edit.crop.w === 1 &&
    edit.crop.h === 1
  );
}

export function rotate(rotation: Rotation, direction: -1 | 1): Rotation {
  return ((((rotation + direction * 90) % 360) + 360) % 360) as Rotation;
}

/** 把比例夾回 0..1，並保證寬高不為零 */
export function clampRegion(region: Region): Region {
  const w = Math.min(Math.max(region.w, 0.02), 1);
  const h = Math.min(Math.max(region.h, 0.02), 1);
  return {
    w,
    h,
    x: Math.min(Math.max(region.x, 0), 1 - w),
    y: Math.min(Math.max(region.y, 0), 1 - h),
  };
}

/** 旋轉之後的畫布尺寸。90/270 度時長寬互換 */
export function rotatedSize(
  width: number,
  height: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/**
 * 輸出的檔案類型。
 *
 * ⚠️ GIF 不在這裡：動畫 GIF 一旦畫進 canvas 就只剩第一格。
 * 呼叫端要在使用者按下編輯之前就擋掉（見 canEdit）。
 *
 * PNG 保持 PNG——它可能有透明背景，轉成 JPEG 會變成黑色或白色的塊。
 * 其餘一律轉 JPEG：照片轉 PNG 檔案會大好幾倍，而使用者上傳的多半是照片。
 */
export function outputType(inputType: string): "image/png" | "image/jpeg" {
  return inputType === "image/png" ? "image/png" : "image/jpeg";
}

export function outputFilename(filename: string, type: "image/png" | "image/jpeg"): string {
  const base = filename.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${type === "image/png" ? "png" : "jpg"}`;
}

/**
 * 能不能編輯這種檔案。
 *
 * GIF 擋掉是刻意的：畫進 canvas 只會留下第一格，
 * 而使用者不會預期「裁切一下」順便把動畫弄不見了。
 * 讓他原樣上傳，比給他一個會靜靜破壞內容的功能好。
 */
export function canEdit(mimeType: string): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp";
}

/**
 * 把編輯套用到來源影像，畫進目標 canvas。
 *
 * @param source 已載入的影像（或另一個 canvas）
 * @param target 目標 canvas；尺寸會被這個函式改寫
 * @param scale  1 = 原始解析度；預覽會傳小於 1 的值
 */
export function renderEdit(
  source: CanvasImageSource & { width: number; height: number },
  target: HTMLCanvasElement,
  edit: ImageEdit,
  scale = 1,
): void {
  const rotated = rotatedSize(source.width, source.height, edit.rotation);

  /*
   * 兩段式：先畫旋轉後的完整影像到暫存 canvas，再從它裁切到目標。
   *
   * 一次到位（旋轉 + 裁切一起算）在數學上做得到，但 90/270 度時
   * 裁切框的 x/y 要跟著換軸，而那個換算寫錯的表現是
   * 「轉了 90 度之後裁切框跳到別的地方」——很難一眼看出哪裡錯。
   * 多一個暫存 canvas 換來的是「裁切永遠在旋轉後的座標系」。
   */
  const stage = document.createElement("canvas");
  stage.width = rotated.width;
  stage.height = rotated.height;

  const stageCtx = stage.getContext("2d");
  if (!stageCtx) return;

  stageCtx.save();
  stageCtx.translate(stage.width / 2, stage.height / 2);
  stageCtx.rotate((edit.rotation * Math.PI) / 180);
  stageCtx.drawImage(source, -source.width / 2, -source.height / 2);
  stageCtx.restore();

  /*
   * 模糊。
   *
   * ⚠️ 不能直接對 stage 自己套 filter 再畫回自己——來源與目標是同一張
   * canvas 時，瀏覽器的行為不一致（有的會先讀後寫、有的會逐塊處理）。
   * 所以先複製一份當來源。
   *
   * 模糊半徑用短邊的比例算：同一組設定在縮圖預覽與原始解析度上
   * 才會看起來一樣。用固定像素的話，預覽看起來糊得剛好，
   * 輸出的原圖幾乎看不出模糊過。
   */
  if (edit.blurs.length > 0) {
    const clean = document.createElement("canvas");
    clean.width = stage.width;
    clean.height = stage.height;
    clean.getContext("2d")?.drawImage(stage, 0, 0);

    const shortEdge = Math.min(stage.width, stage.height);

    for (const blur of edit.blurs) {
      const x = blur.x * stage.width;
      const y = blur.y * stage.height;
      const w = blur.w * stage.width;
      const h = blur.h * stage.height;

      stageCtx.save();
      stageCtx.beginPath();
      stageCtx.rect(x, y, w, h);
      stageCtx.clip();
      stageCtx.filter = `blur(${Math.max(1, (blur.strength / 100) * shortEdge)}px)`;
      stageCtx.drawImage(clean, 0, 0);
      stageCtx.restore();
    }
  }

  const crop = clampRegion(edit.crop);
  const sx = crop.x * stage.width;
  const sy = crop.y * stage.height;
  const sw = crop.w * stage.width;
  const sh = crop.h * stage.height;

  target.width = Math.max(1, Math.round(sw * scale));
  target.height = Math.max(1, Math.round(sh * scale));

  const ctx = target.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(stage, sx, sy, sw, sh, 0, 0, target.width, target.height);
}
