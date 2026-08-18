import { TrackPageView } from "@/components/analytics/page-view";
import { ProjectJsonLd } from "@/components/seo/structured-data";
import { TrackedExternalLink } from "@/components/analytics/tracked-external-link";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortfolioLayout } from "@/components/portfolio/portfolio-layout";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { Navbar } from "@/components/shared/navbar";
import { PUBLIC_NAV } from "@/config/nav";
import { getAdminEntry } from "@/features/admin/auth";
import { SiteFooter } from "@/components/shared/site-footer";
import { readCmsDocument } from "@/features/cms/read";
import { getCategoryName } from "@/config/portfolio-categories";
import { SERVICE_LINES } from "@/config/services";
import { absoluteUrl, SITE_NAME } from "@/config/site";
import { presentCaseStudySections } from "@/features/portfolio/detail";
import { getPortfolioRepository } from "@/features/portfolio";
import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";

/**
 * `/work/[slug]` 作品詳細頁（Spec §8.10）
 *
 * > 內容不要只是 Gallery。
 * > 如果沒有完整 Case Study 資料，只顯示存在的區塊。不要顯示空 Section。
 *
 * 這兩條規則在本頁都是硬性的：每一個區塊渲染前都先檢查資料是否存在，
 * 沒有資料就整段不出現——而不是留一個標題配空白。
 */

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPortfolioRepository().getBySlug(slug);

  if (!project) return { title: `找不到作品｜${SITE_NAME}` };

  const description = project.summary ?? project.kicker;
  const url = absoluteUrl(`/work/${project.slug}`);

  return {
    title: `${project.title}｜${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: project.title,
      description,
      url,
      siteName: SITE_NAME,
    },
  };
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-brand-line border-t py-4">
      <dt className="text-caption text-brand-muted">{label}</dt>
      <dd className="text-body-sm mt-1">{value}</dd>
    </div>
  );
}

export default async function WorkDetailPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = await getPortfolioRepository().getBySlug(slug);

  // 找不到與未發布都走同一條路徑：不從回應差異洩漏草稿的存在
  if (!project) notFound();

  const related = await getPortfolioRepository().listRelated(slug, 3);
  // 分類名稱從資料庫來，與 /work 的篩選器同一份
  const categories = await getPortfolioRepository().listCategories();
  // 後台入口只渲染給已驗證的後台人員；其他人拿到 null，
  // 密路徑因此完全不會出現在送給瀏覽器的 HTML 裡。
  const adminEntry = await getAdminEntry();
  const caseStudySections = presentCaseStudySections(project.caseStudy);
  const services = SERVICE_LINES.filter((line) => project.services.includes(line.id));
  const links = Object.entries(project.links).filter(([, href]) => Boolean(href));

  // Gallery 排除 cover：封面是列表卡片用的，重複出現在圖廊裡只是同一張圖看兩次。
  // 這也讓「只有封面、沒有其他媒體」的作品正確地不顯示 Gallery。
  const gallery = project.media.filter((media) => media.role !== "cover");

  return (
    <>
      {/* Spec §31。掛在詳細頁而不是列表的連結上——
          直接從搜尋進來的人也該被算到。 */}
      <TrackPageView event="portfolio_project_opened" payload={{ slug: project.slug }} />
      {/* Spec §32。用 CreativeWork 而非 Product——標成產品等於宣稱賣過（§29） */}
      <ProjectJsonLd
        title={project.title}
        summary={project.summary ?? undefined}
        href={`/work/${project.slug}`}
        year={project.year ?? undefined}
      />
      <Navbar
        adminEntry={adminEntry}
        links={[...PUBLIC_NAV]}
        cta={{ label: "開始一個專案 ↗", href: "/#contact" }}
      />

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-page px-gutter pt-section pb-12 lg:px-gutter-lg lg:pt-section-lg">
          <nav aria-label="麵包屑" className="text-caption text-brand-muted">
            <Link href="/work" className="hover:text-brand-ink underline underline-offset-4">
              作品
            </Link>
            <span aria-hidden="true"> / </span>
            <span>{project.title}</span>
          </nav>

          <p className="text-kicker text-brand-accent-strong mt-8 uppercase">{project.kicker}</p>
          <h1 className="text-display-2 mt-3 max-w-[14em]">{project.title}</h1>

          {project.summary ? (
            <p className="text-lead text-brand-muted mt-6 max-w-prose">{project.summary}</p>
          ) : null}

          {/*
           * 來源類型標示（Spec §8.2 / §29）。放在 Hero 而非埋在頁尾，
           * 因為「這是不是真實客戶案」是訪客最該第一眼知道的事。
           */}
          <p className="border-brand-ink text-caption mt-8 inline-flex rounded-pill border px-3.5 py-2 font-black">
            {PROJECT_TYPE_LABELS[project.projectType]}
          </p>
        </section>

        {/* Project Meta */}
        <section className="mx-auto w-full max-w-page px-gutter pb-16 lg:px-gutter-lg">
          <h2 className="sr-only">專案資訊</h2>
          <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            <MetaRow
              label="分類"
              value={project.categories.map((slug) => getCategoryName(slug, categories)).join("、")}
            />
            {project.industry ? <MetaRow label="產業" value={project.industry} /> : null}
            {project.year ? <MetaRow label="年份" value={String(project.year)} /> : null}
            {project.tags.length > 0 ? (
              <MetaRow label="標籤" value={project.tags.join("、")} />
            ) : null}
          </dl>

          {links.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-3">
              {links.map(([kind, href]) => (
                <li key={kind}>
                  {/* Spec §31 portfolio_live_demo_clicked */}
                  <TrackedExternalLink
                    href={href}
                    event="portfolio_live_demo_clicked"
                    payload={{ slug: project.slug, kind }}
                    className="border-brand-ink text-body-sm inline-flex rounded-pill border px-5 py-2.5 font-bold"
                  >
                    {kind === "live" ? "Live Site" : kind === "demo" ? "Live Demo" : kind} ↗
                  </TrackedExternalLink>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* Case Study —— 只渲染有內容的區塊（Spec §8.10） */}
        {caseStudySections.length > 0 ? (
          <section className="mx-auto w-full max-w-page px-gutter pb-16 lg:px-gutter-lg">
            <h2 className="sr-only">Case Study</h2>
            <div className="flex flex-col gap-14">
              {caseStudySections.map((section) => (
                <article
                  key={section.key}
                  className="grid gap-4 lg:grid-cols-[12rem_1fr] lg:gap-12"
                >
                  <h3 className="text-kicker text-brand-accent-strong uppercase lg:pt-2">
                    {section.label}
                  </h3>
                  <p className="text-body max-w-prose">{section.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* Media Gallery —— 無媒體時整段不出現，而非顯示空相簿 */}
        {gallery.length > 0 ? (
          <section className="mx-auto w-full max-w-page px-gutter pb-16 lg:px-gutter-lg">
            <h2 className="text-heading-1 mb-6">Gallery</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {gallery.map((media) => (
                <li key={media.id} className="border-brand-line overflow-hidden rounded-lg border">
                  {/*
                   * ⚠️ 尺寸決定用哪一條路徑，而不是用哪一種樣式。
                   *
                   * 知道原始尺寸 → 照它的長寬比留位置，圖片載入時不會把
                   * 下面的內容推開，也不會裁到任何東西。
                   *
                   * 不知道（0818 之前上傳的，或量不出來的）→ 退回固定比例的框
                   * 加 object-contain。**不用 object-cover**：作品圖是設計稿，
                   * 裁掉的那一塊很可能正是要看的地方。留白比裁掉好。
                   */}
                  {media.width && media.height ? (
                    <Image
                      src={media.url}
                      alt={media.alt}
                      width={media.width}
                      height={media.height}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="h-auto w-full"
                    />
                  ) : (
                    <div className="bg-brand-cream relative aspect-[4/3] w-full">
                      <Image
                        src={media.url}
                        alt={media.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-contain"
                      />
                    </div>
                  )}
                  {media.caption ? (
                    <p className="text-caption text-brand-muted p-4">{media.caption}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Services Used（Spec §8.13） */}
        {services.length > 0 ? (
          <section className="mx-auto w-full max-w-page px-gutter pb-16 lg:px-gutter-lg">
            <h2 className="text-heading-1 mb-6">用到的服務</h2>
            <ul className="flex flex-wrap gap-3">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="border-brand-line bg-brand-paper text-body-sm rounded-pill border px-5 py-2.5"
                >
                  {service.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* AI Disclosure（Spec §28） */}
        {project.aiDisclosure?.used ? (
          <section className="mx-auto w-full max-w-page px-gutter pb-16 lg:px-gutter-lg">
            <div className="border-brand-line bg-brand-paper rounded-lg border p-6">
              <h2 className="text-heading-2">AI Disclosure</h2>
              <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
                AI-assisted · Human-reviewed
                {project.aiDisclosure.description ? `　${project.aiDisclosure.description}` : ""}
              </p>
            </div>
          </section>
        ) : null}

        {/* Related Projects */}
        {related.length > 0 ? (
          <section className="mx-auto w-full max-w-page px-gutter pb-section lg:px-gutter-lg lg:pb-section-lg">
            <h2 className="text-heading-1 mb-6">其他作品</h2>
            <PortfolioLayout items={related} variant="uniform" />
          </section>
        ) : null}

        <DarkCtaBlock {...await readCmsDocument("home.final-cta")} />
      </main>

      <SiteFooter />
    </>
  );
}
