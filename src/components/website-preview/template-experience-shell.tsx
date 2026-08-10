"use client";

import {
  SITE_SCOPE_ATTRIBUTE,
  type Device,
  type SiteConfig,
} from "@/features/website-engine/types";

/**
 * Template Experience Shell（Spec §8.15）
 *
 * ⚠️ 這是「殼」。版面、間距、互動骨架與 TypeScript 介面已定，內容為 stub。
 *
 * 【禁止假互動】
 * Theme / Device 切換 UI 存在但一律 disabled。
 * V3 Demo 用 `element.style.background = ...` 偽造主題切換（Spec §45.1），
 * Phase 1 若為了 demo 效果重蹈覆轍，Phase 3 會整段重寫。
 * 寧可讓按鈕不能按，也不要讓它假裝會動。
 *
 * 真正的切換在 Phase 3（SiteRenderer）與 Phase 4（Templates）：
 * 屆時所有操作都是 SiteConfig mutation → SiteRenderer → Preview，
 * 不會有任何一行 DOM style 操作。
 */

const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "mobile", label: "Mobile" },
];

const THEME_CHOICES = ["暖一點", "精品一點", "更極簡"];

export function TemplateExperienceShell({
  config = null,
  device = "desktop",
}: {
  config?: SiteConfig | null;
  device?: Device;
}) {
  return (
    <div className="border-brand-line bg-brand-paper rounded-xl border p-4">
      <div className="text-caption text-brand-muted flex items-center justify-between px-1 pb-3">
        <span className="font-black tracking-widest uppercase">Template Preview</span>
        <span>{device}</span>
      </div>

      <div className="bg-brand-ink rounded-lg p-2.5">
        {/*
         * Preview 的 CSS 變數作用域邊界。Phase 3 會在此以 inline style 注入
         * ThemeConfig 對應的 --site-* 變數；官網自己的 --color-brand-* 永遠留在 :root。
         * 現在是空殼，但容器先存在，避免 Phase 3 忘記 scope 這件事。
         */}
        <div
          {...{ [SITE_SCOPE_ATTRIBUTE]: "" }}
          className="bg-brand-paper grid min-h-[19rem] place-items-center rounded-md"
        >
          <p className="text-body-sm text-brand-muted max-w-[28ch] text-center">
            {config
              ? config.brand.name
              : "SiteRenderer 於 Phase 3 接上。此區塊目前為空殼，不做任何 DOM 樣式操作。"}
          </p>
        </div>
      </div>

      <fieldset disabled className="mt-4 opacity-55">
        <legend className="text-caption text-brand-muted mb-2.5">
          Theme / Device 切換（Phase 3–4 啟用）
        </legend>
        <div className="flex flex-wrap gap-2">
          {THEME_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className="border-brand-line text-body-sm rounded-pill border px-4 py-2"
            >
              {choice}
            </button>
          ))}
          {DEVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="border-brand-line text-body-sm rounded-pill border px-4 py-2"
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
