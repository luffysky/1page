"use client";

import { useSyncExternalStore } from "react";

import { backgroundLayerStyle, hasVisibleBackground, overlayStyle } from "../section-background";
import type { SectionBackground } from "../schema";

/**
 * 一塊的背景（CR-004 / Phase B BJ）
 *
 * ── 背景是裝飾，所以它整層都在無障礙樹之外 ────────────────────
 *
 * `aria-hidden` 加上 `<img>`／`<video>` 都不帶說明：這些東西不是內容。
 * 一段讀螢幕的人聽到「圖片：hero-bg-3.jpg」不會得到任何資訊，
 * 只會被打斷。真正的內容在上面那一層。
 *
 * ── 影片：`prefers-reduced-motion` 不是可選的 ──────────────────
 *
 * 全螢幕自動播放的影片，對前庭功能敏感的人可能引發不適；
 * 這不是「偏好」，作業系統的那個開關是一個明確的醫療性請求。
 *
 * ⚠️ 而且**純 CSS 做不到**。
 *
 * `@media (prefers-reduced-motion)` 可以把 `<video>` 藏起來，
 * 但影片仍然會被下載、仍然會播放（只是看不到）——耗流量、耗電，
 * 而且如果有一天有人拿掉那條 CSS，行為就悄悄變回去了。
 *
 * 所以這裡是 client component：問過之後才決定要不要**放 video 元素**。
 * 不放的話畫面上是封面圖，那正是靜態版本該有的樣子。
 *
 * ── 為什麼預設當作「要減少動態」 ──────────────────────────────
 *
 * 第一次 render（伺服器端與 hydration 當下）還不知道答案。
 * 預設播放的話，需要靜態畫面的人會先被閃一下才停下來——
 * 而那一下正是要避免的東西。預設不播，確認可以之後才播。
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * ⚠️ 用 `useSyncExternalStore`，不是 `useEffect` + `setState`。
 *
 * 後者有兩個問題：一是 lint 直接擋（`react-hooks/set-state-in-effect`），
 * 二是它真的會多一次 render——先畫一次「不知道」，再畫一次正確答案。
 * 那一次多出來的 render 在背景影片上就是**閃一下才停下來**，
 * 而那一下正是這整段程式要避免的東西。
 *
 * `getServerSnapshot` 回 true（當作要減少動態）：伺服器端問不到這件事，
 * 而預設不播才是安全的方向。
 */
function subscribeToReducedMotion(callback: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => true,
  );
}

export function SectionBackgroundLayer({ background }: { background: SectionBackground }) {
  const reducedMotion = usePrefersReducedMotion();

  if (!hasVisibleBackground(background)) return null;

  const overlay = overlayStyle(background);
  const playVideo = background.type === "video" && Boolean(background.videoUrl) && !reducedMotion;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/*
       * 底層。顏色、漸層與圖片都走 CSS 背景——
       * 圖片不用 <img> 是因為它是裝飾，不該進無障礙樹也不需要 alt。
       *
       * 影片模式下這一層畫的是封面圖：影片還在載、
       * 或訪客要求減少動態時，看到的就是它。
       */}
      <div
        className="absolute inset-0"
        style={
          background.type === "video"
            ? backgroundLayerStyle({ ...background, type: "image" })
            : backgroundLayerStyle(background)
        }
      />

      {playVideo ? (
        <video
          src={background.videoUrl}
          poster={background.imageUrl}
          autoPlay
          muted
          loop
          playsInline
          /*
           * `preload="metadata"`：先拿到尺寸就好。
           *
           * `auto` 會在頁面載入時就開始抓整支影片，而背景影片常常在
           * 第一屏以下——訪客可能永遠捲不到那裡，流量卻已經花掉了。
           */
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {overlay ? <div className="absolute inset-0" style={overlay} /> : null}
    </div>
  );
}
