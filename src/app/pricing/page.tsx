import type { Metadata } from "next";

import { TrackPageView } from "@/components/analytics/page-view";
import { PricingLadder } from "@/components/pricing/pricing-ladder";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { Navbar } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { PUBLIC_NAV } from "@/config/nav";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { readCmsDocument } from "@/features/cms/read";

/**
 * `/pricing` 完整價格階梯（Spec §26 / CR-006）
 *
 * ── 這一頁是 §26.1 的新住所 ──────────────────────────────────
 *
 * §26.1 原本要求六級完整呈現在首頁。CR-006 把位置移過來，
 * 而**原意一個字都沒有變**：
 *
 * > 缺了 Template Build 與 Semi-Custom，訪客的升級路徑等同
 * > 從 NT$990 直接跳 NT$30,000，轉換會斷在這裡。
 *
 * 所以這一頁**必須**呈現完整階梯、順序正確、兩個承接點都在。
 * `pricing.spec.ts` 反過來問：CMS 裡的每一級是不是都畫在這一頁上。
 *
 * ⚠️ §26.2 在這裡一樣成立：不得做成六張等寬圓角卡。
 * `PricingLadder` 用的是縱向階梯，那個元件本身就是那條約束的實作。
 */

export const metadata: Metadata = {
  title: "價格｜一頁起家",
  description:
    "從免費的 AI 顧問到完整客製，六級責任範圍與各自的價格。價格依責任範圍與客製程度，不按頁數算。",
};

export default async function PricingPage() {
  const [pricing, intro, finalCta, adminEntry, accountEntry] = await Promise.all([
    readCmsDocument("pricing.tiers"),
    readCmsDocument("pricing.intro"),
    readCmsDocument("home.final-cta"),
    getAdminEntry(),
    getAccountEntry(),
  ]);

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={[...PUBLIC_NAV]}
        cta={{ label: "開始一個專案 ↗", href: "/start" }}
      />

      <main>
        {/*
         * Spec §31：這一頁存在就是「看過價格」，與有沒有捲到底無關。
         * `from` 見首頁那一段的說明——同一個事件，分得出在哪裡看的。
         */}
        <TrackPageView event="pricing_viewed" payload={{ from: "pricing-page" }} />

        <div className="mx-auto w-full max-w-page px-gutter pt-16 pb-4 lg:px-gutter-lg">
          {intro.section.kicker ? (
            <p className="text-kicker text-brand-accent-strong uppercase">{intro.section.kicker}</p>
          ) : null}
          <h1 className="text-display-1 mt-3 max-w-[14em]">{intro.section.title}</h1>
          {intro.section.lead ? (
            <p className="text-lead text-brand-muted mt-8 max-w-prose">{intro.section.lead}</p>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-page px-gutter py-section lg:px-gutter-lg lg:py-section-lg">
          <PricingLadder groups={pricing.groups} tiers={pricing.tiers} />
        </div>

        <DarkCtaBlock {...finalCta} />
      </main>

      <SiteFooter />
    </>
  );
}
