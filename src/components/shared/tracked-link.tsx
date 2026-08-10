"use client";

import Link from "next/link";

import { track, type AnalyticsEvent } from "@/lib/analytics/track";

/**
 * 需要上報 analytics 的連結。
 *
 * Hero、Final CTA 等區塊是 Server Component，本身不能掛 onClick；
 * 用這支小型 client 元件包住連結，讓上報點集中在一處。
 */
export function TrackedLink({
  href,
  event,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event, { href })}>
      {children}
    </Link>
  );
}
