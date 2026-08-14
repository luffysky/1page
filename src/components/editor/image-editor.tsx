"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  type BlurRegion,
  clampRegion,
  FULL_FRAME,
  IDENTITY_EDIT,
  type ImageEdit,
  isIdentityEdit,
  outputFilename,
  outputType,
  type Region,
  renderEdit,
  rotate,
} from "@/features/website-engine/image-edit";

/**
 * 上傳前的圖片編輯器：旋轉、裁切、局部模糊（CR-003-4）
 *
 * ── 每一個拖曳都有數字欄位當替代路徑 ─────────────────────────
 *
 * WCAG 2.1 §2.5.7（Dragging Movements）：任何用拖曳完成的操作
 * 都要有不需拖曳的替代方式。裁切框與模糊區塊都能拖，
 * 所以**兩者都各有一組百分比的數字欄位**。
 *
 * 這與 CR-003-4 的區塊排序是同一條判斷，也是同樣的做法：
 * 拖曳與數字欄位改的是**同一份狀態**，所以它們在結構上
 * 不可能有不同的行為。
 *
 * ── 為什麼不用現成的裁切套件 ──────────────────────────────────
 *
 * 常見的那幾個都是「整塊 div 監聽 mousedown」，鍵盤完全進不去，
 * 而這個專案每一段的 gate 都擋 axe critical/serious。
 * 自己做的成本是這一個檔案，換來的是它真的能用鍵盤操作。
 */

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

type DragMode = { kind: "crop" } | { kind: "blur"; id: string } | null;

const PERCENT = (value: number) => Math.round(value * 100);

/** 百分比輸入 → 比例。空白或非數字一律當作不變更 */
function fromPercent(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) / 100 : fallback;
}

function RegionFields({
  label,
  region,
  onChange,
}: {
  label: string;
  region: Region;
  onChange: (next: Region) => void;
}) {
  const id = useId();
  const fields: Array<[keyof Region, string]> = [
    ["x", "左"],
    ["y", "上"],
    ["w", "寬"],
    ["h", "高"],
  ];

  return (
    <fieldset className="mt-2">
      <legend className="sr-only">{label}的位置與大小（百分比）</legend>
      <div className="flex flex-wrap gap-2">
        {fields.map(([key, name]) => (
          <label key={key} className="text-caption text-brand-muted flex items-center gap-1">
            {name}
            <input
              id={`${id}-${key}`}
              /*
               * ⚠️ 每個欄位的可及名稱要帶上它屬於哪一塊。
               *
               * 只寫「左」的話，加了三塊模糊之後畫面上會有四個「左」，
               * 螢幕閱讀器使用者聽到的是一串一模一樣的「左 百分比」，
               * 完全分不出自己在改哪一塊。
               * （這也是 e2e 第一版撞到的：連測試都選不到正確的那一個。）
               */
              aria-label={`${label}的${name}`}
              type="number"
              min={0}
              max={100}
              value={PERCENT(region[key])}
              onChange={(event) =>
                onChange(
                  clampRegion({ ...region, [key]: fromPercent(event.target.value, region[key]) }),
                )
              }
              className="border-brand-line bg-brand-paper text-caption w-16 rounded-md border px-2 py-1"
            />
            %
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ImageEditor({ file, onCancel, onConfirm }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [edit, setEdit] = useState<ImageEdit>(IDENTITY_EDIT);
  const [drag, setDrag] = useState<DragMode>(null);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  /*
   * 載入原圖。
   *
   * object URL 一定要撤銷——不撤的話每編輯一張圖就永久佔住一份記憶體，
   * 直到分頁關掉。這與 SaveBar 匯出 JSON 那裡是同一件事。
   */
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const element = new window.Image();
    element.onload = () => setImage(element);
    element.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  /*
   * 預覽。
   *
   * ⚠️ 預覽畫的是**裁切後**的結果，而裁切框要疊在**裁切前**的畫面上——
   * 不然框一縮，被裁掉的部分就看不見了，使用者無法把它拉回來。
   * 所以預覽 canvas 永遠畫整張（crop = 全幅），裁切範圍用疊層表示。
   */
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    renderEdit(image, canvasRef.current, { ...edit, crop: FULL_FRAME }, previewScale(image));
  }, [image, edit]);

  const patchCrop = (next: Region) =>
    setEdit((current) => ({ ...current, crop: clampRegion(next) }));

  const patchBlur = (id: string, next: Partial<BlurRegion>) =>
    setEdit((current) => ({
      ...current,
      blurs: current.blurs.map((blur) =>
        blur.id === id ? { ...blur, ...next, ...clampRegion({ ...blur, ...next }) } : blur,
      ),
    }));

  const addBlur = () =>
    setEdit((current) => ({
      ...current,
      blurs: [
        ...current.blurs,
        {
          // 從中間一塊開始，使用者再拖到要遮的地方。
          // 從 0,0 開始的話它會躲在角落，第一次用的人找不到它
          id: `blur-${current.blurs.length}-${current.blurs.reduce((n) => n + 1, 0)}-${Date.now() % 100000}`,
          x: 0.3,
          y: 0.3,
          w: 0.4,
          h: 0.25,
          strength: 4,
        },
      ],
    }));

  /** 指標座標 → 相對於預覽的比例 */
  const pointFromEvent = (event: React.PointerEvent) => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (drag.kind === "crop") {
      patchCrop({ ...edit.crop, x: point.x - edit.crop.w / 2, y: point.y - edit.crop.h / 2 });
    } else {
      const blur = edit.blurs.find((item) => item.id === drag.id);
      if (blur) patchBlur(drag.id, { x: point.x - blur.w / 2, y: point.y - blur.h / 2 });
    }
  };

  const confirm = async () => {
    if (!image || !canvasRef.current) return;
    setBusy(true);

    try {
      const output = document.createElement("canvas");
      renderEdit(image, output, edit, 1);

      const type = outputType(file.type);
      const blob = await new Promise<Blob | null>((resolve) =>
        // JPEG 用 0.92：再高檔案變大很多而肉眼看不出差別
        output.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
      );

      if (!blob) {
        setBusy(false);
        return;
      }

      onConfirm(new File([blob], outputFilename(file.name, type), { type }));
    } finally {
      setBusy(false);
    }
  };

  if (!image) {
    return (
      <p role="status" className="text-body-sm text-brand-muted">
        讀取圖片中…
      </p>
    );
  }

  return (
    <div className="border-brand-line bg-brand-paper mt-3 rounded-lg border p-4">
      <h3 className="text-body font-bold">編輯「{file.name}」</h3>
      <p className="text-caption text-brand-muted mt-1">
        裁掉與遮住的部分不會被上傳——編輯是在你的瀏覽器裡做的。
      </p>

      <div
        ref={surfaceRef}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        className="bg-brand-ink relative mx-auto mt-4 w-full max-w-md touch-none select-none"
      >
        <canvas ref={canvasRef} className="block h-auto w-full" />

        {/*
         * 裁切框。四周壓暗，讓「哪些會被裁掉」一眼看得出來。
         * 純視覺，所以 aria-hidden——真正可操作的是下面的數字欄位與拖曳把手。
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            // 遮罩色來自 tokens.css，不是寫死的 rgba
            boxShadow: "0 0 0 9999px var(--color-brand-scrim) inset",
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${PERCENT(edit.crop.x)}% ${PERCENT(edit.crop.y)}%, ${PERCENT(edit.crop.x)}% ${PERCENT(edit.crop.y + edit.crop.h)}%, ${PERCENT(edit.crop.x + edit.crop.w)}% ${PERCENT(edit.crop.y + edit.crop.h)}%, ${PERCENT(edit.crop.x + edit.crop.w)}% ${PERCENT(edit.crop.y)}%, ${PERCENT(edit.crop.x)}% ${PERCENT(edit.crop.y)}%)`,
          }}
        />

        <button
          type="button"
          onPointerDown={() => setDrag({ kind: "crop" })}
          aria-label="拖曳移動裁切範圍（也可以用下方的數字欄位）"
          className="absolute cursor-move border-2 border-white"
          style={{
            left: `${PERCENT(edit.crop.x)}%`,
            top: `${PERCENT(edit.crop.y)}%`,
            width: `${PERCENT(edit.crop.w)}%`,
            height: `${PERCENT(edit.crop.h)}%`,
          }}
        />

        {edit.blurs.map((blur, index) => (
          <button
            key={blur.id}
            type="button"
            onPointerDown={() => setDrag({ kind: "blur", id: blur.id })}
            aria-label={`拖曳移動第 ${index + 1} 塊模糊（也可以用下方的數字欄位）`}
            className="border-brand-accent absolute cursor-move border-2 border-dashed"
            style={{
              left: `${PERCENT(blur.x)}%`,
              top: `${PERCENT(blur.y)}%`,
              width: `${PERCENT(blur.w)}%`,
              height: `${PERCENT(blur.h)}%`,
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-body-sm font-bold">旋轉</span>
        <button
          type="button"
          onClick={() =>
            setEdit((current) => ({ ...current, rotation: rotate(current.rotation, -1) }))
          }
          className="border-brand-line text-body-sm rounded-pill border px-4 py-2"
        >
          ↺ 向左轉
        </button>
        <button
          type="button"
          onClick={() =>
            setEdit((current) => ({ ...current, rotation: rotate(current.rotation, 1) }))
          }
          className="border-brand-line text-body-sm rounded-pill border px-4 py-2"
        >
          ↻ 向右轉
        </button>
        <span className="text-caption text-brand-muted">{edit.rotation}°</span>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-bold">裁切</span>
          <button
            type="button"
            onClick={() => patchCrop(FULL_FRAME)}
            className="border-brand-line text-caption rounded-pill border px-3 py-1"
          >
            整張都要
          </button>
        </div>
        <RegionFields label="裁切範圍" region={edit.crop} onChange={patchCrop} />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-bold">模糊</span>
          <button
            type="button"
            onClick={addBlur}
            className="border-brand-line text-caption rounded-pill border px-3 py-1"
          >
            ＋ 加一塊模糊
          </button>
          <span className="text-caption text-brand-muted">用來遮住人臉、門牌、價格</span>
        </div>

        {edit.blurs.map((blur, index) => (
          <div key={blur.id} className="border-brand-line mt-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption text-brand-muted">第 {index + 1} 塊</span>
              <button
                type="button"
                onClick={() =>
                  setEdit((current) => ({
                    ...current,
                    blurs: current.blurs.filter((item) => item.id !== blur.id),
                  }))
                }
                className="border-brand-line text-caption rounded-pill border px-3 py-1"
              >
                刪除
              </button>
            </div>

            <RegionFields
              label={`第 ${index + 1} 塊模糊`}
              region={blur}
              onChange={(next) => patchBlur(blur.id, next)}
            />

            <label className="text-caption text-brand-muted mt-2 flex items-center gap-2">
              強度
              <input
                type="range"
                min={1}
                max={15}
                value={blur.strength}
                onChange={(event) => patchBlur(blur.id, { strength: Number(event.target.value) })}
                className="flex-1"
              />
              {blur.strength}
            </label>
          </div>
        ))}
      </div>

      <div className="border-brand-line mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold disabled:opacity-50"
        >
          {busy ? "處理中…" : isIdentityEdit(edit) ? "直接上傳" : "套用並上傳"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-3"
        >
          取消
        </button>
      </div>
    </div>
  );
}

/**
 * 預覽縮放。
 *
 * 太大的圖直接畫進 canvas 會拖慢每一次調整（每動一下都要重畫），
 * 而預覽只需要看得清楚。上限 640px 是肉眼夠用、又不會卡的折衷。
 */
function previewScale(image: HTMLImageElement): number {
  const longest = Math.max(image.width, image.height);
  return longest > 640 ? 640 / longest : 1;
}
