"use client";

import { track, type AnalyticsEvent, type AnalyticsPayload } from "@/lib/analytics/track";

/**
 * 會離開本站的連結（Spec §31）。
 *
 * 與 `shared/tracked-link.tsx` 的差別是那個包的是 next/link（站內導覽），
 * 這個包的是原生 `<a>`——目標在別的網域，Link 的預取與 client 導覽都不適用。
 *
 * 記錄之所以要在這裡而不是在 server 上：點下去之後頁面就走了，
 * 沒有第二次機會。`track` 用 sendBeacon，正是為了這個瞬間。
 */
export function TrackedExternalLink({
  href,
  event,
  payload,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  payload?: AnalyticsPayload;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      // 外部連結一律加這兩個：noopener 防止對方拿到 window.opener，
      // noreferrer 不把訪客從哪一頁過去的告訴對方。
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track(event, payload)}
    >
      {children}
    </a>
  );
}
