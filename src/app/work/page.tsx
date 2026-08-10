import type { Metadata } from "next";
import Link from "next/link";

import { PortfolioFilter } from "@/components/portfolio/portfolio-filter";
import { PortfolioLayout } from "@/components/portfolio/portfolio-layout";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { getAdminEntry } from "@/features/admin/auth";
import { SiteFooter } from "@/components/shared/site-footer";
import { FINAL_CTA_COPY } from "@/config/home-copy";
import {
  ALL_CATEGORIES,
  ALL_PROJECT_TYPES,
  getCategoryName,
  parseCategoryFilter,
  parseProjectTypeFilter,
} from "@/config/portfolio-categories";
import { getPortfolioRepository } from "@/features/portfolio";
import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";

export const metadata: Metadata = {
  title: "作品｜一頁起家",
  description: "網站、品牌、內容與 AI 自動化作品。Demo、內部產品與客戶案明確標示，不混在一起。",
};

/**
 * `/work` 作品列表（Spec §8.7）
 *
 * 篩選狀態進 URL，沿用 Home Goal 建立的模式：可分享、可作為廣告落地頁、
 * 重新整理不掉狀態、analytics 有可靠來源。
 *
 * 資料來自 `PortfolioRepository`。目前是 in-memory 實作，
 * 2D 換成 Supabase 時本檔一行都不用改。
 */

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "AI 顧問", href: "/#advisor" },
  { label: "服務", href: "/#services" },
  { label: "價格", href: "/#pricing" },
  { label: "流程", href: "/#process" },
];

export default async function WorkPage({ searchParams }: PageProps<"/work">) {
  const params = await searchParams;
  const category = parseCategoryFilter(params.category);
  const projectType = parseProjectTypeFilter(params.type);

  const items = await getPortfolioRepository().listPublished({ category, projectType });
  // 後台入口只渲染給已驗證的後台人員；其他人拿到 null，
  // 密路徑因此完全不會出現在送給瀏覽器的 HTML 裡。
  const adminEntry = await getAdminEntry();

  const isFiltered = category !== ALL_CATEGORIES || projectType !== ALL_PROJECT_TYPES;
  const activeLabels = [
    category !== ALL_CATEGORIES ? getCategoryName(category) : null,
    projectType !== ALL_PROJECT_TYPES ? PROJECT_TYPE_LABELS[projectType] : null,
  ].filter(Boolean);

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        links={NAV_LINKS}
        cta={{ label: "開始一個專案 ↗", href: "/#contact" }}
      />

      <main>
        <section className="mx-auto w-full max-w-page px-gutter pt-section pb-10 lg:px-gutter-lg lg:pt-section-lg">
          <p className="text-kicker text-brand-accent-strong uppercase">Selected Work</p>
          <h1 className="text-display-2 mt-3 max-w-[14em]">不只說我們會做，直接給你看。</h1>
          <p className="text-lead text-brand-muted mt-6 max-w-prose">
            Demo、內部產品與真實客戶案會明確標示，不混在一起。
          </p>
        </section>

        <section className="mx-auto w-full max-w-page px-gutter pb-10 lg:px-gutter-lg">
          <PortfolioFilter
            category={category}
            projectType={projectType}
            resultCount={items.length}
          />
        </section>

        <section className="mx-auto w-full max-w-page px-gutter pb-section lg:px-gutter-lg lg:pb-section-lg">
          {items.length > 0 ? (
            <PortfolioLayout items={items} variant="uniform" />
          ) : (
            /*
             * 空狀態必須誠實：說明「這個篩選條件下沒有作品」，
             * 不偷偷退回全部——那會讓使用者以為篩選沒作用。
             */
            <div className="border-brand-line rounded-lg border border-dashed p-12 text-center">
              <p className="text-body">
                目前沒有{isFiltered ? `「${activeLabels.join(" × ")}」的` : ""}公開作品。
              </p>
              <p className="text-body-sm text-brand-muted mt-3">
                不代表做不到。直接告訴我們你想完成什麼，我們會說明可以先看哪個方向。
              </p>
              <Link
                href="/work"
                className="border-brand-ink text-body-sm mt-8 inline-flex rounded-pill border px-5 py-3 font-bold"
              >
                清除篩選
              </Link>
            </div>
          )}
        </section>

        <DarkCtaBlock {...FINAL_CTA_COPY} />
      </main>

      <SiteFooter />
    </>
  );
}
