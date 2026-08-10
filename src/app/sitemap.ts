import type { MetadataRoute } from "next";

/**
 * Plan §11 C.1：`/_dev/*` 不得被 sitemap 收錄。
 *
 * Phase 1 只有首頁一條公開路由。`/work`、`/work/[slug]`、`/service/*`
 * 於 Phase 2 起加入（Spec §32 要求 Portfolio detail 有獨立 metadata）。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://1page.tw/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
