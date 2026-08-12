import type { SiteSection, SiteSectionType } from "./schema";
import { CtaBanner, ContactSimple, FooterSimple } from "./sections/action";
import { AboutSimple, GalleryGrid, ServicesList } from "./sections/content";
import { FaqList, FormSimple, PricingTiers, ProcessSteps } from "./sections/detail";
import { EmbedFrame } from "./sections/embed";
import { HeroCentered, HeroEditorial, HeroMinimal } from "./sections/hero";
import { StatsRow, TeamGrid, TestimonialsQuotes } from "./sections/proof";
import type { SectionProps } from "./sections/shared";
import { site } from "./site-classes";

/**
 * Section Registry（Spec §10 / §11）
 *
 * type + variant → 元件。這是 SiteRenderer 唯一的查找表。
 *
 * ⚠️ 未知的 type 或 variant **不得讓整頁崩潰**。
 *
 * 這條在 Phase 6 特別重要：Agent 會直接產生 `set_section_variant` 之類的
 * tool call，而 LLM 生出一個不存在的 variant 名稱是遲早的事。
 * 那時使用者看到的應該是「這一塊還沒有這個排版」，
 * 而不是整片白畫面加一個 console error——後者會讓人以為自己把網站弄壞了。
 */

type SectionComponent = (props: SectionProps) => React.ReactNode;

/**
 * 每個 type 的第一個 variant 是預設。
 * variant 找不到時退到預設，而不是直接失敗——
 * 排版錯了還能看，內容不見了就沒得救。
 */
export const SECTION_REGISTRY: Partial<Record<SiteSectionType, Record<string, SectionComponent>>> =
  {
    hero: {
      centered: HeroCentered,
      editorial: HeroEditorial,
      minimal: HeroMinimal,
    },
    about: { simple: AboutSimple },
    services: { list: ServicesList },
    features: { list: ServicesList },
    gallery: { grid: GalleryGrid },
    portfolio: { grid: GalleryGrid },
    pricing: { tiers: PricingTiers },
    testimonials: { quotes: TestimonialsQuotes },
    faq: { list: FaqList },
    process: { steps: ProcessSteps },
    stats: { row: StatsRow },
    team: { grid: TeamGrid },
    form: { simple: FormSimple },
    embed: { youtube: EmbedFrame, map: EmbedFrame },
    cta: { banner: CtaBanner },
    contact: { simple: ContactSimple },
    footer: { simple: FooterSimple },
  };

export interface Resolution {
  component: SectionComponent;
  /** 實際採用的 variant。與請求的不同時代表發生了降級 */
  variant: string;
  fallback: "none" | "variant" | "type";
}

export function resolveSection(section: SiteSection): Resolution | null {
  const variants = SECTION_REGISTRY[section.type];
  if (!variants) return null;

  const exact = variants[section.variant];
  if (exact) return { component: exact, variant: section.variant, fallback: "none" };

  const [defaultVariant, defaultComponent] = Object.entries(variants)[0]!;
  return { component: defaultComponent, variant: defaultVariant, fallback: "variant" };
}

/**
 * 尚未實作的 section type 的佔位。
 *
 * 刻意做成看得見而非靜默略過：靜默略過會讓人以為「Agent 沒做事」，
 * 實際上是「這個 type 還沒有元件」。兩者要分得出來。
 *
 * 只在開發環境顯示技術細節；正式環境只留一個中性的位置指示，
 * 不把內部 type 名稱暴露給訪客。
 */
export function UnknownSection({ section }: SectionProps) {
  // 判準是「不是正式環境」而非「是開發環境」：
  // 要防的是對訪客洩漏內部結構，而測試環境同樣需要看得到細節。
  const showDetails = process.env.NODE_ENV !== "production";

  return (
    <section className={`${site.bg} ${site.muted} ${site.body} ${site.sectionYTight} px-6`}>
      <div
        className={`${site.surface} ${site.radius} ${site.cardPad} mx-auto max-w-5xl text-center`}
      >
        {showDetails ? (
          <p className="text-sm">
            尚未實作的區塊類型：<code className="font-mono">{section.type}</code>
            <span className="opacity-60">（variant: {section.variant}）</span>
          </p>
        ) : (
          <p className="text-sm">這個區塊還在準備中。</p>
        )}
      </div>
    </section>
  );
}

/** 已實作的 type 清單，供 Phase 4 的模板與 Phase 6 的 Agent 工具參考 */
export function implementedSectionTypes(): SiteSectionType[] {
  return Object.keys(SECTION_REGISTRY) as SiteSectionType[];
}

export function variantsFor(type: SiteSectionType): string[] {
  return Object.keys(SECTION_REGISTRY[type] ?? {});
}
