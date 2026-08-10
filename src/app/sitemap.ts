import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";
import { getPortfolioRepository } from "@/features/portfolio";

/**
 * Sitemap（Spec §32）
 *
 * Plan §11 C.1：`/_dev/*` 不得被收錄。此處以「明確列出要收錄的路由」
 * 而非「排除不要的」——白名單比黑名單不容易漏。
 *
 * 作品詳細頁由 repository 供應，2D 換 Supabase 後自動反映真實資料，
 * 且只會列出已發布作品（`listPublished` 的語意）。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getPortfolioRepository().listPublished({
    category: "all",
    projectType: "all",
  });

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/work"), changeFrequency: "weekly", priority: 0.8 },
    ...projects.map((project) => ({
      url: absoluteUrl(project.href),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
