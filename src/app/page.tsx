import { AdvisorSection } from "@/components/landing/advisor-section";
import { GoalSelector } from "@/components/landing/goal-selector";
import { Hero } from "@/components/landing/hero";
import { ProcessSteps } from "@/components/landing/process-steps";
import { SelectedWork } from "@/components/landing/selected-work";
import { TemplateExperienceSection } from "@/components/landing/template-experience-section";
import { PricingLadder } from "@/components/pricing/pricing-ladder";
import { ServicesBand } from "@/components/services/services-band";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { EditorialSection } from "@/components/shared/editorial-section";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { FINAL_CTA_COPY, HERO_COPY, SECTION_COPY } from "@/config/home-copy";
import { parseHomeGoal } from "@/config/home-goals";
import { HomeGoalProvider } from "@/features/home/goal-context";
import { getPortfolioRepository } from "@/features/portfolio";

/**
 * 首頁組裝（Spec §4 IA）
 *
 * 順序不得調換：
 *   Navbar → Hero → Goal Selector → Selected Work → Template Experience
 *   → AI Website Advisor → AI Philosophy → Services → Pricing → Process
 *   → Final CTA → Footer
 *
 * 資料流：
 *   server 讀 ?goal= 決定首次輸出，並一次帶入全部 featured 作品；
 *   切換 goal 後由 client context 驅動畫面，不等 RSC round-trip（Plan §6.2）。
 *
 * 本路由因讀取 searchParams 而為動態渲染。Phase 1 無資料庫，成本可忽略；
 * Phase 2 接 Supabase 後需重新評估快取策略。
 */

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "#work" },
  { label: "AI 顧問", href: "#advisor" },
  { label: "服務", href: "#services" },
  { label: "價格", href: "#pricing" },
  { label: "流程", href: "#process" },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const goal = parseHomeGoal(params.goal);
  const featured = await getPortfolioRepository().listFeatured();

  return (
    <HomeGoalProvider initialGoal={goal}>
      <Navbar links={NAV_LINKS} cta={{ label: "開始一個專案 ↗", href: "#contact" }} />

      <main id="top">
        <Hero {...HERO_COPY} />

        <EditorialSection {...SECTION_COPY.goals}>
          <GoalSelector />
        </EditorialSection>

        <div id="work">
          <EditorialSection {...SECTION_COPY.work}>
            <SelectedWork items={featured} />
          </EditorialSection>
        </div>

        <div id="templates">
          <EditorialSection {...SECTION_COPY.template}>
            <TemplateExperienceSection />
          </EditorialSection>
        </div>

        <div id="advisor">
          <EditorialSection {...SECTION_COPY.advisor}>
            <AdvisorSection />
          </EditorialSection>
        </div>

        <EditorialSection {...SECTION_COPY.philosophy} />

        <div id="services">
          <EditorialSection {...SECTION_COPY.services}>
            <ServicesBand />
          </EditorialSection>
        </div>

        <div id="pricing">
          <EditorialSection {...SECTION_COPY.pricing}>
            <PricingLadder />
          </EditorialSection>
        </div>

        <div id="process">
          <EditorialSection {...SECTION_COPY.process}>
            <ProcessSteps />
          </EditorialSection>
        </div>

        <div id="contact">
          <DarkCtaBlock {...FINAL_CTA_COPY} />
        </div>
      </main>

      <SiteFooter />
    </HomeGoalProvider>
  );
}
