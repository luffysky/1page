import { OrganizationJsonLd } from "@/components/seo/structured-data";
import { TrackPageView } from "@/components/analytics/page-view";
import { AdvisorSection } from "@/components/landing/advisor-section";
import { GoalSelector } from "@/components/landing/goal-selector";
import { Hero } from "@/components/landing/hero";
import { ProcessSteps } from "@/components/landing/process-steps";
import { SelectedWork } from "@/components/landing/selected-work";
import { TemplateTeaser } from "@/components/landing/template-teaser";
import { PricingSummary } from "@/components/pricing/pricing-summary";
import { readCmsDocument } from "@/features/cms/read";
import { ServicesBand } from "@/components/services/services-band";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { EditorialSection } from "@/components/shared/editorial-section";
import { Navbar } from "@/components/shared/navbar";
import { homeNav } from "@/config/nav";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { SiteFooter } from "@/components/shared/site-footer";
import { getHomeGoal, parseHomeGoal } from "@/config/home-goals";
import { mergeGoalCopy } from "@/features/cms/merge";
import { blockNumbers, numberedKicker, visibleBlocks } from "@/features/cms/page-layout";
import { PageBlock } from "@/components/shared/page-block";
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
    layout,
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
    readCmsDocument("home.layout"),
  ]);
  // 後台入口只渲染給已驗證的後台人員；其他人拿到 null，
  // 密路徑因此完全不會出現在送給瀏覽器的 HTML 裡。
  const [adminEntry, accountEntry] = await Promise.all([getAdminEntry(), getAccountEntry()]);

  // Preview 的初始模板在 server 就依 goal 決定，首次輸出即為正確的那一套。
  // 若交給 client 進場後再校正，訪客會先看到一套模板再跳成另一套。
  const initialTemplateId = listTemplates(getHomeGoal(goal).templateCategories)[0]?.id;

  const blocks = visibleBlocks(layout);

  /*
   * 每一塊的編號**依實際渲染順序算出來**，不寫在文案裡。
   *
   * ⚠️ 編號曾經寫死在 `SECTION_COPY` 的 kicker 裡（`"01 / Goals"`），
   * 而 BJ-2 之後順序是後台可以拖的——兩者放在一起等於保證會對不上。
   * CR-005 把 services 提前之後就發生過一次：
   * 畫面上出現「作品之後是 05 / SERVICES」。
   *
   * `sectionOf` 把編號冠上去，順便把 kicker 裡既有的 `NN / ` 拔掉
   * （後台可以編那個欄位，有人照著舊樣子打了編號也不會變成兩層）。
   */
  const numbers = blockNumbers(blocks);
  const sectionOf = <T extends { kicker?: string }>(id: string, section: T): T => ({
    ...section,
    kicker: numberedKicker(section.kicker, numbers[id]),
  });

  /*
   * id → 那一塊的畫面。
   *
   * 用一個 map 而不是一長串 if：`page-layout.test.ts` 會反過來問
   * 「HOME_BLOCKS 裡有沒有哪一個 id 這裡沒有畫」，而那條問得出來的前提
   * 是這份對應表是一個看得到全部鍵的物件。
   */
  const BLOCKS: Record<string, React.ReactNode> = {
    hero: <Hero {...hero} />,

    goals: (
      <EditorialSection {...sectionOf("goals", goalsCopy.section)}>
        <GoalSelector items={mergeGoalCopy(goalsCopy)} />
      </EditorialSection>
    ),

    work: (
      <div id="work">
        <EditorialSection {...sectionOf("work", workCopy.section)}>
          <SelectedWork items={featured} />
        </EditorialSection>
      </div>
    ),

    template: (
      <div id="templates">
        <EditorialSection {...sectionOf("template", templateCopy.section)}>
          <TemplateTeaser />
        </EditorialSection>
      </div>
    ),

    advisor: (
      <div id="advisor">
        {/* Spec §31：免費顧問沒有另外的開關，對話區出現就算開啟過 */}
        <TrackPageView event="agent_opened" />
        <EditorialSection {...sectionOf("advisor", advisorCopy.section)}>
          <AdvisorSection />
        </EditorialSection>
      </div>
    ),

    philosophy: <EditorialSection {...sectionOf("philosophy", philosophyCopy.section)} />,

    services: (
      <div id="services">
        <EditorialSection {...sectionOf("services", servicesCopy.section)}>
          <ServicesBand lines={servicesCopy.lines} />
        </EditorialSection>
      </div>
    ),

    pricing: (
      <div id="pricing">
        {/*
         * Spec §31。
         *
         * ⚠️ 帶 `from`：CR-006 之後 `/pricing` 也會發同一個事件，
         * 而一個人從首頁點過去就會被算兩次。不加來源的話，
         * 那個數字會慢慢變成「首頁載入次數 + 價格頁載入次數」，
         * 而沒有人記得它曾經是別的意思。
         *
         * 不另外開一個事件，是因為「看過價格」本來就是同一件事——
         * 分開的是**在哪裡看的**。
         */}
        <TrackPageView event="pricing_viewed" payload={{ from: "home" }} />
        <EditorialSection {...sectionOf("pricing", pricingCopy.section)}>
          <PricingSummary groups={pricing.groups} tiers={pricing.tiers} />
        </EditorialSection>
      </div>
    ),

    process: (
      <div id="process">
        <EditorialSection {...sectionOf("process", processCopy.section)}>
          <ProcessSteps steps={processCopy.steps} />
        </EditorialSection>
      </div>
    ),

    "final-cta": (
      <div id="contact">
        <DarkCtaBlock {...finalCta} />
      </div>
    ),
  };

  /*
   * 認不得的 id 就跳過，不要炸掉整頁。
   *
   * `resolveHomeLayout` 已經把資料裡的未知 id 濾掉了，所以這裡理論上
   * 不會發生——但「理論上不會」與「發生時整頁白掉」之間，
   * 值得留這一行。
   */
  const renderBlock = (id: string) => BLOCKS[id] ?? null;

  return (
    <HomeGoalProvider initialGoal={goal}>
      <SitePreviewProvider initialTemplateId={initialTemplateId}>
        <AgentHandoffProvider>
          <OrganizationJsonLd />
          <Navbar
            adminEntry={adminEntry}
            accountEntry={accountEntry}
            links={homeNav()}
            cta={{ label: "開始一個專案 ↗", href: "/start" }}
          />

          <main id="top">
            {/*
             * 區塊照版面資料的順序渲染（CR-004 / BJ-2）。
             *
             * ⚠️ 這裡不是「什麼都能拖進來的畫布」——見 page-layout.ts 的檔頭。
             * 能改的是順序、要不要顯示、以及各自的背景。
             *
             * `resolveHomeLayout` 保證每一塊都在：新加的區塊在舊資料上
             * 會被補回來，不會因為一份存過的版面而永遠不出現。
             */}
            {blocks.map((block) => (
              <PageBlock key={block.id} background={block.background}>
                {renderBlock(block.id)}
              </PageBlock>
            ))}
          </main>

          <SiteFooter />
        </AgentHandoffProvider>
      </SitePreviewProvider>
    </HomeGoalProvider>
  );
}
