import type { Metadata } from "next";

import { AgentWorkspaceShell } from "@/components/agent/agent-workspace-shell";
import { Hero } from "@/components/landing/hero";
import { PortfolioLayout, type PortfolioCard } from "@/components/portfolio/portfolio-layout";
import { PricingLadder } from "@/components/pricing/pricing-ladder";
import { DarkCtaBlock } from "@/components/shared/dark-cta-block";
import { EditorialSection } from "@/components/shared/editorial-section";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { TemplateExperienceShell } from "@/components/website-preview/template-experience-shell";
import { FINAL_CTA_COPY, HERO_COPY } from "@/config/home-copy";

export const metadata: Metadata = {
  title: "Layout Primitives — /_dev",
};

/**
 * Primitive 展示頁 — 1C 的 Gate 第 5 項固定靶（Plan §6）。
 *
 * 各 primitive 以 mock 資料獨立呈現，尚未組裝成首頁、也尚未接上 Goal Context，
 * 那是 1D 的工作。
 */

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "#work" },
  { label: "AI 顧問", href: "#try" },
  { label: "服務", href: "#services" },
  { label: "價格", href: "#pricing" },
  { label: "流程", href: "#process" },
];

/**
 * 假資料一律標為 demo / internal，並在 UI 顯示對應標籤。
 * Spec §8.2、§29：不得將 Demo / Concept 冒充真實客戶案例——
 * Phase 1 的假資料也一樣受這條約束。
 */
const MOCK_WORK: PortfolioCard[] = [
  {
    id: "interior",
    title: "山序設計 / Interior Studio",
    kicker: "Premium Brand Landing Page",
    projectType: "demo",
    href: "#",
    placeholderTone: "cream",
  },
  {
    id: "identity",
    title: "一頁起家",
    kicker: "Identity / System",
    projectType: "internal",
    href: "#",
    placeholderTone: "accent",
  },
  {
    id: "workshop",
    title: "AI Website Workshop",
    kicker: "Agent + Website Engine",
    projectType: "demo",
    href: "#",
    placeholderTone: "ink",
  },
];

function Specimen({
  index,
  name,
  note,
  children,
}: {
  index: string;
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-brand-line border-t py-14">
      <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
        <p className="text-kicker text-brand-accent-strong uppercase">{index}</p>
        <h2 className="text-heading-1 mt-2">{name}</h2>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">{note}</p>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export default function PrimitivesPage() {
  return (
    <>
      <Navbar links={NAV_LINKS} cta={{ label: "開始一個專案 ↗", href: "#contact" }} />

      <main>
        <div className="mx-auto w-full max-w-page px-gutter pt-14 pb-6 lg:px-gutter-lg">
          <p className="text-kicker text-brand-accent-strong uppercase">Dev · Phase 1C</p>
          <h1 className="text-display-2 mt-3">Layout Primitives</h1>
          <p className="text-lead text-brand-muted mt-5 max-w-prose">
            八個版面元件，資料為 mock，尚未組裝成首頁。 兩個 Shell 的切換 UI 一律 disabled——
            寧可不能按，也不假裝會動。
          </p>
        </div>

        <Specimen
          index="01"
          name="Navbar"
          note="頁面最上方即為此元件。視窗縮到 768px 以下會出現「選單」按鈕，以原生 dialog 開啟，支援 Escape 關閉與 focus trap。"
        >
          <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
            <p className="text-body-sm text-brand-muted">（見頁首）</p>
          </div>
        </Specimen>

        <Specimen index="02" name="Hero" note="Spec §5 文案與雙 CTA。大字級 + 留白，不放示意圖。">
          <Hero {...HERO_COPY} />
        </Specimen>

        <Specimen
          index="03"
          name="EditorialSection"
          note="大字 + 留白的敘事版式，用來打斷卡片網格節奏（Spec §3.1）。"
        >
          <EditorialSection
            kicker="AI Philosophy"
            title="會用 AI，跟能用 AI 做出產品，是兩回事。"
            lead="我們不隱瞞 AI，也不販賣 AI。你付的不是生成費，而是完成費。"
          />
        </Specimen>

        <Specimen
          index="04"
          name="PortfolioLayout"
          note="不等寬網格。每件作品都標示來源類型——Demo 不得冒充客戶案例（Spec §8.2 / §29）。"
        >
          <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
            <PortfolioLayout items={MOCK_WORK} />
          </div>
        </Specimen>

        <Specimen
          index="05"
          name="TemplateExperienceShell"
          note="殼。Theme / Device 切換 disabled，內含 data-site-scope 容器，Phase 3 才注入 --site-* 變數。"
        >
          <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
            <TemplateExperienceShell />
          </div>
        </Specimen>

        <Specimen
          index="06"
          name="AgentWorkspaceShell"
          note="殼。靜態範例訊息，輸入框 disabled，不用 setTimeout 假裝 AI 在回覆。"
        >
          <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
            <AgentWorkspaceShell initialIntent="website" />
          </div>
        </Specimen>

        <Specimen
          index="07"
          name="PricingLadder"
          note="完整六級，縱向階梯而非六欄卡片（Spec §26.1 / §26.2）。"
        >
          <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
            <PricingLadder />
          </div>
        </Specimen>

        <Specimen index="08" name="DarkCtaBlock" note="整頁節奏的收束。全站唯一大面積深色區塊。">
          <DarkCtaBlock {...FINAL_CTA_COPY} />
        </Specimen>
      </main>
    </>
  );
}
