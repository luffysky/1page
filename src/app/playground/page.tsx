import type { Metadata } from "next";

import { Playground } from "@/components/website-preview/playground";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { Navbar } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { PUBLIC_NAV } from "@/config/nav";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { readCmsDocument } from "@/features/cms/read";
import { SitePreviewProvider } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";

/**
 * `/playground` 完整試穿（Spec §8.15 / CR-006）
 *
 * ── 為什麼要有這一頁 ──────────────────────────────────────────
 *
 * §8.15 的功能範圍原本全部塞在首頁那一段，結果它成為首頁上體積最大的
 * 一塊——`docs/gptsay.md` 的評論說得很直接：「首頁不是後台」。
 *
 * CR-006 把完整控制項移過來，首頁只留「挑模板 + 大張預覽 + 兩個出口」。
 *
 * ⚠️ **不需要登入、不需要付費、不經過 Agent。**
 * §8.15 那句「讓訪客在不與 Agent 對話的前提下自己完成一次試穿」
 * 是這一頁存在的全部理由，加任何門檻都會讓它失效。
 *
 * ── SitePreviewProvider 在這裡是必要的 ────────────────────────
 *
 * 預覽狀態（模板、主題、主色、裝置）住在 context 裡。首頁由
 * `app/page.tsx` 提供，這一頁要自己提供一份——否則
 * `useSitePreview` 會拿不到 provider 而整頁炸掉。
 */

export const metadata: Metadata = {
  title: "試穿你的網站｜一頁起家",
  description: "挑一套版型、換配色、切裝置，立刻看到自己的網站長什麼樣。不用登入，也不用先聊。",
};

export default async function PlaygroundPage() {
  const [intro, finalCta, adminEntry, accountEntry] = await Promise.all([
    readCmsDocument("playground.intro"),
    readCmsDocument("home.final-cta"),
    getAdminEntry(),
    getAccountEntry(),
  ]);

  // 與首頁同一套決定方式：首次輸出就是正確的那一套，不在 client 進場後才校正
  const initialTemplateId = listTemplates()[0]?.id;

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={[...PUBLIC_NAV]}
        cta={{ label: "開始一個專案 ↗", href: "/start" }}
      />

      <main>
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
          <SitePreviewProvider initialTemplateId={initialTemplateId}>
            <Playground />
          </SitePreviewProvider>
        </div>

        <DarkCtaBlock {...finalCta} />
      </main>

      <SiteFooter />
    </>
  );
}
