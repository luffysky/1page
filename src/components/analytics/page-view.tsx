"use client";

import { useEffect } from "react";

import { track, type AnalyticsEvent, type AnalyticsPayload } from "@/lib/analytics/track";

/**
 * 「這一頁被看到了」類的事件（Spec §31）。
 *
 * `portfolio_viewed`、`pricing_viewed` 這些沒有對應的點擊動作——
 * 它們的觸發時機是畫面出現。放在 server component 裡沒有用
 * （那是在 server 上執行的），所以需要這麼一個小小的 client 元件。
 *
 * 只在掛載時送一次。用 IntersectionObserver 做「真的捲到了才算」會更準，
 * 但那要決定「多少比例算看到」「停留多久算看到」，而目前沒有人會用到
 * 那個精度——多出來的複雜度只會變成之後要維護的東西。
 */
export function TrackPageView({
  event,
  payload,
}: {
  event: AnalyticsEvent;
  payload?: AnalyticsPayload;
}) {
  useEffect(() => {
    track(event, payload);
    // payload 是每次渲染新建的物件，放進依賴會讓這裡每次都重跑。
    // 事件的意義是「這一頁被看到」，一次就夠。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
