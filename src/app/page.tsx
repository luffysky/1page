import { OrganizationJsonLd } from "@/components/seo/structured-data";
import { TrackPageView } from "@/components/analytics/page-view";
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
import { getAdminEntry } from "@/features/admin/auth";
import { SiteFooter } from "@/components/shared/site-footer";
import { FINAL_CTA_COPY, HERO_COPY, SECTION_COPY } from "@/config/home-copy";
import { getHomeGoal, parseHomeGoal } from "@/config/home-goals";
import { HomeGoalProvider } from "@/features/home/goal-context";
import { getPortfolioRepository } from "@/features/portfolio";
import { AgentHandoffProvider } from "@/features/agent/handoff";
import { SitePreviewProvider } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";

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
  // 後台入口只渲染給已驗證的後台人員；其他人拿到 null，
  // 密路徑因此完全不會出現在送給瀏覽器的 HTML 裡。
  const adminEntry = await getAdminEntry();

  // Preview 的初始模板在 server 就依 goal 決定，首次輸出即為正確的那一套。
  // 若交給 client 進場後再校正，訪客會先看到一套模板再跳成另一套。
  const initialTemplateId = listTemplates(getHomeGoal(goal).templateCategories)[0]?.id;

  return (
    <HomeGoalProvider initialGoal={goal}>
      <SitePreviewProvider initialTemplateId={initialTemplateId}>
        <AgentHandoffProvider>
          <OrganizationJsonLd />
          <Navbar
            adminEntry={adminEntry}
            links={NAV_LINKS}
            cta={{ label: "開始一個專案 ↗", href: "/start" }}
          />

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
              {/* Spec §31：免費顧問沒有另外的開關，對話區出現就算開啟過 */}
              <TrackPageView event="agent_opened" />
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
              {/* Spec §31 */}
              <TrackPageView event="pricing_viewed" />
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
        </AgentHandoffProvider>
      </SitePreviewProvider>
    </HomeGoalProvider>
  );
}
