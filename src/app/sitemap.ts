import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";
import { getPortfolioRepository } from "@/features/portfolio";

/**
 * Sitemap（Spec §32）
 *
 * Plan §11 C.1：`/_dev/*` 不得被收錄。此處以「明確列出要收錄的路由」
 * 而非「排除不要的」——白名單比黑名單不容易漏。
 *
 * ⚠️ 必須是動態的，原因有二：
 *
 * 1. **建置期不該連資料庫。** 預設會在 `next build` 時預先產生，
 *    而建置容器不一定連得到資料庫，也不一定有環境變數。
 *    Zeabur 第一次部署就是因此整個 build 失敗。
 * 2. **內容本來就會變。** 新增或下架作品後 sitemap 應該立刻反映，
 *    而不是等下一次部署。
 *
 * 其餘路由（/、/work、/work/[slug]）因讀取 searchParams / params
 * 本來就是動態渲染，不受影響。
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getPortfolioRepository().listPublished({
    category: "all",
    projectType: "all",
  });

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/work"), changeFrequency: "weekly", priority: 0.8 },
    // Project Builder（Spec §30）。轉換頁，優先度僅次於首頁。
    { url: absoluteUrl("/start"), changeFrequency: "monthly", priority: 0.9 },
    /*
     * ⚠️ CR-006 與 CR-003-5 新增的四條，0818 收尾稽核才補進來。
     *
     * 白名單比黑名單不容易漏——這句話只在**有人記得加**的時候成立。
     * `/pricing` 是完整的六級價格、`/playground` 是完整試穿，
     * 兩條都是首頁瘦身時搬出去的主要內容，而它們在 sitemap 裡
     * 缺席了整整一段時間，沒有任何東西會說。
     *
     * 現在 `tests/unit/sitemap-coverage.test.ts` 會問反過來的問題：
     * 公開路由清單裡有沒有哪一條不在 sitemap、也沒寫明為什麼不收錄。
     */
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/playground"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/crm"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/edit"), changeFrequency: "monthly", priority: 0.6 },
    ...projects.map((project) => ({
      url: absoluteUrl(project.href),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
