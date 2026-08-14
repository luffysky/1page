"use client";

import { PreviewAssistant } from "@/components/website-preview/preview-assistant";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { SiteRenderer } from "@/features/website-engine/site-renderer";
import { site as siteClasses } from "@/features/website-engine/site-classes";
import { SiteScope } from "@/features/website-engine/site-scope";
import type { Device } from "@/features/website-engine/types";

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
/**
 * 裝置寬度（Spec §15）。
 *
 * 這裡改的只是**容器寬度**。Section 元件的斷點是 container query
 * （`@3xl:` 而非 `md:`），所以窄下來之後版面是真的重排，
 * 不是把桌機版縮小。見 site-scope.tsx 的說明。
 *
 * 每個都加 `max-w-full`：在手機上看「Desktop」時，
 * 預覽仍然不能撐破頁面——那會讓整頁出現橫向捲動。
 */
const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "w-full",
  tablet: "w-3xl max-w-full",
  mobile: "w-96 max-w-full",
};

export function SitePreview() {
  const { config, device, template } = useSitePreview();

  return (
    <div className="border-brand-line bg-brand-paper rounded-xl border p-4">
      <div className="text-caption text-brand-muted flex items-center justify-between px-1 pb-3">
        <span className="font-black tracking-widest uppercase">Template Preview</span>
        {/*
         * 不用 opacity 做次要層級：外層已經是 text-brand-muted，
         * 再乘 0.7 就掉到 AA 以下（axe 抓到過，serious）。
         * 層級改用分隔符表示，顏色維持原樣。
         */}
        <span>
          {template.name} · {device}
        </span>
      </div>

      <div className={`bg-brand-ink relative mx-auto rounded-lg p-2.5 ${DEVICE_WIDTH[device]}`}>
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
          className="scrollbar-none max-h-[34rem] overflow-y-auto rounded-md"
        >
          <SiteRenderer config={config} />
        </div>

        {/*
         * 模板內的 AI 客服體驗（CR-003）。
         *
         * 放在捲動容器外面、定位容器裡面——真實網站的客服泡泡
         * 是固定在視窗角落的，不是跟著內容捲走。
         *
         * ⚠️ 但這樣它就跑到 SiteRenderer 的 `[data-site-scope]` 外面了，
         * 而 `--site-*` 全部宣告在那個元素上。泡泡用的 `site.accentBg`
         * 於是解析到一個**不存在的變數**——背景變透明。
         *
         * 沒有錯誤、沒有紅字、類別也都在，只是那顆按鈕悄悄沒有顏色。
         * 跟 4A 的 `font-[var(--x)]` 是同一種：寫法看起來對，產出是空的。
         * 這次是實際去讀 computed style 才看到的（backgroundColor 量出來是完全透明），不是用看的。
         *
         * 所以這裡補一層 scope。radius 是必要的：SiteScope 會帶自己的
         * 底色，方角的話會在圓角泡泡後面露出一圈。
         */}
        <SiteScope
          theme={config.theme}
          /*
           * 寬度必須明寫。SiteScope 的 base 帶了 `@container`
           * （container-type: inline-size），那會對行內軸做尺寸內縮——
           * 這個框就**不再依內容撐開**，量出來是 width: 0，
           * 泡泡整個溢出到預覽框外面。
           *
           * 又是「沒有錯誤、只是位置不對」的一種。量了 bounding box 才看到。
           */
          className={`${siteClasses.radius} absolute right-4 bottom-4 flex w-[min(22rem,calc(100%-2rem))] justify-end`}
        >
          <PreviewAssistant />
        </SiteScope>
      </div>
    </div>
  );
}
