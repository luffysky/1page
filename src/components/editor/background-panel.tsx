"use client";

import { useId } from "react";

import { BackgroundMediaField } from "@/components/editor/background-media-field";
import { useSitePreview } from "@/features/website-engine/preview-context";
import type {
  SectionBackground,
  SectionBackgroundType,
  SiteSection,
} from "@/features/website-engine/schema";
import {
  backgroundWarnings,
  DEFAULT_GRADIENT_ANGLE,
  switchBackgroundType,
} from "@/features/website-engine/section-background";

/**
 * 一塊的背景設定（CR-004 / Phase B BJ）
 *
 * ── 只在選了對應型別時才顯示那幾個欄位 ────────────────────────
 *
 * 五種來源的欄位全部攤開的話，畫面上永遠有十個框而其中八個是空的——
 * 而空欄位會被當裝飾略過（與報價的「未成交原因」、專案的「交付日期」
 * 同一個判斷）。
 *
 * ── 警告是灰字，不是紅字 ──────────────────────────────────────
 *
 * 「照片上沒有遮罩」不是錯誤，是一個**還沒發現的問題**：
 * 存得進去、看得到、只是別人讀不出來。紅字會讓人以為壞了而去找哪裡壞，
 * 灰字說得出「這樣會怎樣」，那才是使用者需要的資訊。
 */

const TYPE_LABELS: Record<SectionBackgroundType, string> = {
  none: "不設定",
  color: "純色",
  gradient: "漸層",
  image: "圖片",
  video: "影片",
};

const TYPES: SectionBackgroundType[] = ["none", "color", "gradient", "image", "video"];

const inputClass = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

/**
 * 顏色欄位：色票 + 可以打字的框。
 *
 * ⚠️ 兩個都要。
 *
 * 只有色票的話，設計稿上寫的 `#1F2933` 沒辦法直接貼進去——
 * 得用滑鼠在一個彩虹裡找那個顏色，而那件事做不到精確。
 * 只有輸入框的話，想隨手挑一個顏色的人得先知道 hex 是什麼。
 */
/**
 * `<input type="color">` 一定要有一個合法的 hex 才顯示得出來。
 *
 * ⚠️ 這個常數不是設計數值——它是「使用者還沒選顏色」時色票要停在哪裡。
 * 放在這裡具名，是為了讓 `no-hardcoded-design-values` 的例外說得出理由。
 */
const SWATCH_PLACEHOLDER = "#000000";
const SWATCH_EXAMPLE = "#1f2933";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();

  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-caption text-brand-muted block">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          type="color"
          aria-label={`${label}（色票）`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : SWATCH_PLACEHOLDER}
          onChange={(event) => onChange(event.target.value)}
          className="border-brand-line h-10 w-12 rounded-md border p-1"
        />
        <input
          id={id}
          value={value}
          placeholder={SWATCH_EXAMPLE}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function BackgroundPanel({
  section,
  signedIn,
}: {
  section: SiteSection;
  signedIn: boolean;
}) {
  const { setBackground } = useSitePreview();
  const typeId = useId();

  const background: SectionBackground = section.background ?? { type: "none" };
  const warnings = backgroundWarnings(background);

  const patch = (next: Partial<SectionBackground>) =>
    setBackground(section.id, { ...background, ...next });

  return (
    <section className="border-brand-line mt-6 border-t pt-5">
      <h3 className="text-body-sm font-bold">背景</h3>

      <div className="mt-3">
        <label htmlFor={typeId} className="text-caption text-brand-muted block">
          背景來源
        </label>
        <select
          id={typeId}
          value={background.type}
          onChange={(event) =>
            setBackground(
              section.id,
              switchBackgroundType(background, event.target.value as SectionBackgroundType),
            )
          }
          className={`${inputClass} mt-1`}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {background.type === "color" ? (
        <ColorField
          label="顏色"
          value={background.color ?? ""}
          onChange={(color) => patch({ color })}
        />
      ) : null}

      {background.type === "gradient" ? (
        <>
          <ColorField
            label="起點顏色"
            value={background.gradientFrom ?? ""}
            onChange={(gradientFrom) => patch({ gradientFrom })}
          />
          <ColorField
            label="終點顏色"
            value={background.gradientTo ?? ""}
            onChange={(gradientTo) => patch({ gradientTo })}
          />

          <div className="mt-3">
            <label
              htmlFor={`${typeId}-angle`}
              className="text-caption text-brand-muted flex justify-between"
            >
              <span>角度</span>
              <span>{background.gradientAngle ?? DEFAULT_GRADIENT_ANGLE}°</span>
            </label>
            <input
              id={`${typeId}-angle`}
              type="range"
              min={0}
              max={360}
              step={15}
              value={background.gradientAngle ?? DEFAULT_GRADIENT_ANGLE}
              onChange={(event) => patch({ gradientAngle: Number(event.target.value) })}
              className="mt-1 w-full"
            />
            <p className="text-caption text-brand-muted mt-1">0° 由下往上，90° 由左往右。</p>
          </div>
        </>
      ) : null}

      {background.type === "image" || background.type === "video" ? (
        <>
          {background.type === "video" ? (
            <BackgroundMediaField
              label="影片"
              hint="會自動播放、靜音、循環。訪客開了「減少動態效果」時不會播。"
              mediaType="video"
              value={background.videoUrl ?? ""}
              signedIn={signedIn}
              onChange={(videoUrl) => patch({ videoUrl })}
            />
          ) : null}

          <BackgroundMediaField
            label={background.type === "video" ? "封面圖" : "圖片"}
            hint={
              background.type === "video"
                ? "影片還沒載完、或訪客關掉動態效果時，看到的是它。"
                : undefined
            }
            mediaType="image"
            value={background.imageUrl ?? ""}
            signedIn={signedIn}
            onChange={(imageUrl) => patch({ imageUrl })}
          />

          <div className="mt-4">
            <label
              htmlFor={`${typeId}-overlay`}
              className="text-caption text-brand-muted flex justify-between"
            >
              <span>遮罩濃度</span>
              <span>{Math.round((background.overlay ?? 0) * 100)}%</span>
            </label>
            <input
              id={`${typeId}-overlay`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((background.overlay ?? 0) * 100)}
              onChange={(event) => patch({ overlay: Number(event.target.value) / 100 })}
              className="mt-1 w-full"
            />
          </div>

          <div className="mt-3">
            <label
              htmlFor={`${typeId}-blur`}
              className="text-caption text-brand-muted flex justify-between"
            >
              <span>背景模糊</span>
              <span>{background.blur ?? 0}px</span>
            </label>
            <input
              id={`${typeId}-blur`}
              type="range"
              min={0}
              max={20}
              step={1}
              value={background.blur ?? 0}
              onChange={(event) => patch({ blur: Number(event.target.value) })}
              className="mt-1 w-full"
            />
          </div>
        </>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {warnings.map((warning) => (
            <li key={warning} className="text-caption text-brand-muted">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
