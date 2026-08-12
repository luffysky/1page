"use client";

import { useId, useRef } from "react";

import { useSitePreview } from "@/features/website-engine/preview-context";
import {
  ACCENT_IDS,
  ACCENT_LABELS,
  type AccentId,
  resolveTheme,
  THEME_PRESETS,
} from "@/features/website-engine/templates";
import type { Device } from "@/features/website-engine/types";
import { track } from "@/lib/analytics/track";

/**
 * Preview 控制項（Spec §15）
 *
 * > 訪客可以免費修改：Brand Name / Industry / Theme / Accent Color
 * > 並查看：Desktop / Tablet / Mobile
 *
 * 每一個控制項做的事都一樣：改 draft 的一個欄位。
 * 畫面是 `buildSiteConfig(draft)` 的結果，沒有任何一條路徑能只改畫面。
 *
 * 1C 的殼在這個位置放了三顆 disabled 的按鈕（「暖一點／精品一點／更極簡」），
 * 那三個名字現在是 themes.ts 裡真的主題。
 */

const DEVICES: { id: Device; label: string; hint: string }[] = [
  { id: "desktop", label: "Desktop", hint: "桌機" },
  { id: "tablet", label: "Tablet", hint: "平板" },
  { id: "mobile", label: "Mobile", hint: "手機" },
];

const chip = (active: boolean) =>
  `rounded-pill border px-4 py-2 text-body-sm transition-colors ${
    active
      ? "border-brand-ink bg-brand-ink text-brand-on-ink"
      : "border-brand-line bg-brand-paper hover:border-brand-ink"
  }`;

export function PreviewControls() {
  const { draft, device, template, setAccent, setBrandName, setDevice, setIndustry, setTheme } =
    useSitePreview();

  const brandId = useId();
  const industryId = useId();
  const industryListId = useId();

  /*
   * `preview_modified` 在失焦時發一次，不是每個按鍵。
   *
   * 每個按鍵都發的話，一個十個字的店名會產生十筆事件，
   * 之後看到的「修改次數」量到的是打字速度，不是行為。
   */
  const focusValue = useRef<string>("");

  const trackTextEdit = (field: string, value: string) => {
    if (value === focusValue.current) return;
    track("preview_modified", { field });
  };

  return (
    <div className="border-brand-line bg-brand-paper flex flex-col gap-6 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={brandId} className="text-caption text-brand-muted block">
            品牌名稱
          </label>
          <input
            id={brandId}
            type="text"
            value={draft.brandName}
            maxLength={80}
            onFocus={(event) => (focusValue.current = event.target.value)}
            onChange={(event) => setBrandName(event.target.value)}
            onBlur={(event) => trackTextEdit("brandName", event.target.value)}
            className="border-brand-line focus-visible:border-brand-ink text-body mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor={industryId} className="text-caption text-brand-muted block">
            產業
          </label>
          <input
            id={industryId}
            type="text"
            value={draft.industry}
            maxLength={60}
            list={industryListId}
            onFocus={(event) => (focusValue.current = event.target.value)}
            onChange={(event) => setIndustry(event.target.value)}
            onBlur={(event) => trackTextEdit("industry", event.target.value)}
            className="border-brand-line focus-visible:border-brand-ink text-body mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2"
          />
          {/*
           * 建議值來自模板的 recommendedIndustries（Spec §12）。
           * 那個欄位原本只是宣告在型別上、沒有任何地方讀它——
           * 接到這裡之後它才真的有用途，同時也省去訪客自己想怎麼描述。
           */}
          <datalist id={industryListId}>
            {template.recommendedIndustries.map((industry) => (
              <option key={industry} value={industry} />
            ))}
          </datalist>
        </div>
      </div>

      <fieldset>
        <legend className="text-caption text-brand-muted mb-2">風格</legend>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={preset.id === draft.themeId}
              title={preset.description}
              onClick={() => {
                setTheme(preset.id);
                track("theme_switched", { theme: preset.id });
              }}
              className={chip(preset.id === draft.themeId)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-caption text-brand-muted mb-2">主色</legend>
        <div className="flex flex-wrap gap-2">
          {ACCENT_IDS.map((accentId) => (
            <AccentSwatch
              key={accentId}
              accentId={accentId}
              active={accentId === draft.accentId}
              onSelect={() => {
                setAccent(accentId);
                track("theme_switched", { theme: draft.themeId, accent: accentId });
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-caption text-brand-muted mb-2">裝置</legend>
        <div className="flex flex-wrap gap-2">
          {DEVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === device}
              onClick={() => {
                setDevice(item.id);
                track("preview_device_switched", { device: item.id });
              }}
              className={chip(item.id === device)}
            >
              {item.label}
              <span className="sr-only">（{item.hint}）</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * 色票。
 *
 * ⚠️ 這是全站第二個允許 inline style 的地方（見
 * `no-hardcoded-design-values.test.ts` 的具名例外）。
 *
 * 理由與上傳進度條同一類：**類別表達不了執行期才決定的值**。
 * accent 的實際色碼取決於「哪個主題 × 哪個色系」，共 12 種組合，
 * 而且它是被預覽網站的顏色，不是本站的設計數值——
 * 寫進 tokens.css 反而是把兩個系統混在一起。
 *
 * 色票本身以 `aria-hidden` 排除，選擇的語意由文字標籤承擔：
 * 只靠顏色傳達資訊的話，色覺障礙的使用者無從分辨（WCAG 1.4.1）。
 */
function AccentSwatch({
  accentId,
  active,
  onSelect,
}: {
  accentId: AccentId;
  active: boolean;
  onSelect: () => void;
}) {
  const { draft } = useSitePreview();
  const color = resolveTheme(draft.themeId, accentId).colors.accent;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`${chip(active)} inline-flex items-center gap-2`}
    >
      <span
        aria-hidden
        className="border-brand-line size-3.5 rounded-full border"
        style={{ backgroundColor: color }}
      />
      {ACCENT_LABELS[accentId]}
    </button>
  );
}
