"use client";

import { useSitePreview } from "@/features/website-engine/preview-context";
import { SiteRenderer } from "@/features/website-engine/site-renderer";

/**
 * Preview 視窗（Spec §8.15 / §11）
 *
 * 這裡沒有任何一行在決定「畫面長什麼樣子」——只有一個 `<SiteRenderer />`
 * 吃著 context 算出來的 config。Spec §8.15 要求首頁 Preview 與 Agent Preview、
 * Workshop Preview 共用同一個 renderer，而共用的前提是這裡不能有第二套邏輯。
 *
 * 1C 的殼曾經在這個位置放一個「尚未選擇模板」的佔位。那塊現在沒有了：
 * 一定有一套模板是選中的（server 依 goal 決定初始值），
 * 沒有需要顯示空狀態的情況。
 */
export function SitePreview() {
  const { config, template } = useSitePreview();

  return (
    <div className="border-brand-line bg-brand-paper rounded-xl border p-4">
      <div className="text-caption text-brand-muted flex items-center justify-between px-1 pb-3">
        <span className="font-black tracking-widest uppercase">Template Preview</span>
        <span>{template.name}</span>
      </div>

      <div className="bg-brand-ink rounded-lg p-2.5">
        {/*
         * 可捲動區域必須能用鍵盤操作。
         *
         * 預覽比視窗高很多，因此內部捲動；而一個只有滑鼠能捲的區塊，
         * 鍵盤使用者就完全看不到下半部——axe 的 scrollable-region-focusable
         * 把這件事列為 serious，而首頁的 a11y 測試正是擋 serious 以上。
         */}
        <div
          tabIndex={0}
          role="group"
          aria-label={`${template.name} 模板預覽`}
          className="max-h-[34rem] overflow-y-auto rounded-md"
        >
          <SiteRenderer config={config} />
        </div>
      </div>
    </div>
  );
}
