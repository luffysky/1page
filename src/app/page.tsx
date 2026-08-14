import { OrganizationJsonLd } from "@/components/seo/structured-data";
import { TrackPageView } from "@/components/analytics/page-view";
import { AdvisorSection } from "@/components/landing/advisor-section";
import { GoalSelector } from "@/components/landing/goal-selector";
import { Hero } from "@/components/landing/hero";
import { ProcessSteps } from "@/components/landing/process-steps";
import { SelectedWork } from "@/components/landing/selected-work";
import { TemplateExperienceSection } from "@/components/landing/template-experience-section";
import { PricingLadder } from "@/components/pricing/pricing-ladder";
import { readCmsDocument } from "@/features/cms/read";
import { ServicesBand } from "@/components/services/services-band";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { EditorialSection } from "@/components/shared/editorial-section";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { SiteFooter } from "@/components/shared/site-footer";
import { getHomeGoal, parseHomeGoal } from "@/config/home-goals";
import { mergeGoalCopy } from "@/features/cms/merge";
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
  // 編輯器是一條真的路由，不是首頁的錨點——它是訪客自己動手的入口
  { label: "自己排版", href: "/edit" },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const goal = parseHomeGoal(params.goal);
  const featured = await getPortfolioRepository().listFeatured();
  // 價格從 CMS 讀（有快取，tag 由後台存檔時打掉）。資料庫沒有那一列時
  // 退回 config/pricing.ts 的預設值——行為與搬進 CMS 之前完全一樣
  /*
   * 首頁上的每一段文案都從 CMS 讀（CR-004 / BI）。
   *
   * ⚠️ 一次 `Promise.all`，不是一段一段 `await`。
   * 逐段等的話這一頁會串起十次往返——即使每一次都是快取命中，
   * 那也是十次進出，而首頁的載入速度是這個網站的賣點之一。
   *
   * 資料庫沒有那幾列時全部退回 config 的預設值，
   * 行為與搬進 CMS 之前完全一樣。
   */
  const [
    hero,
    goalsCopy,
    workCopy,
    templateCopy,
    advisorCopy,
    philosophyCopy,
    servicesCopy,
    pricingCopy,
    processCopy,
    finalCta,
    pricing,
  ] = await Promise.all([
    readCmsDocument("home.hero"),
    readCmsDocument("home.goals"),
    readCmsDocument("home.work"),
    readCmsDocument("home.template"),
    readCmsDocument("home.advisor"),
    readCmsDocument("home.philosophy"),
    readCmsDocument("home.services"),
    readCmsDocument("home.pricing"),
    readCmsDocument("home.process"),
    readCmsDocument("home.final-cta"),
    readCmsDocument("pricing.tiers"),
  ]);
  // 後台入口只渲染給已驗證的後台人員；其他人拿到 null，
  // 密路徑因此完全不會出現在送給瀏覽器的 HTML 裡。
  const [adminEntry, accountEntry] = await Promise.all([getAdminEntry(), getAccountEntry()]);

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
            accountEntry={accountEntry}
            links={NAV_LINKS}
            cta={{ label: "開始一個專案 ↗", href: "/start" }}
          />

          <main id="top">
            <Hero {...hero} />

            <EditorialSection {...goalsCopy.section}>
              <GoalSelector items={mergeGoalCopy(goalsCopy)} />
            </EditorialSection>

            <div id="work">
              <EditorialSection {...workCopy.section}>
                <SelectedWork items={featured} />
              </EditorialSection>
            </div>

            <div id="templates">
              <EditorialSection {...templateCopy.section}>
                <TemplateExperienceSection />
              </EditorialSection>
            </div>

            <div id="advisor">
              {/* Spec §31：免費顧問沒有另外的開關，對話區出現就算開啟過 */}
              <TrackPageView event="agent_opened" />
              <EditorialSection {...advisorCopy.section}>
                <AdvisorSection />
              </EditorialSection>
            </div>

            <EditorialSection {...philosophyCopy.section} />

            <div id="services">
              <EditorialSection {...servicesCopy.section}>
                <ServicesBand lines={servicesCopy.lines} />
              </EditorialSection>
            </div>

            <div id="pricing">
              {/* Spec §31 */}
              <TrackPageView event="pricing_viewed" />
              <EditorialSection {...pricingCopy.section}>
                <PricingLadder groups={pricing.groups} tiers={pricing.tiers} />
              </EditorialSection>
            </div>

            <div id="process">
              <EditorialSection {...processCopy.section}>
                <ProcessSteps steps={processCopy.steps} />
              </EditorialSection>
            </div>

            <div id="contact">
              <DarkCtaBlock {...finalCta} />
            </div>
          </main>

          <SiteFooter />
        </AgentHandoffProvider>
      </SitePreviewProvider>
    </HomeGoalProvider>
  );
}
