import Image from "next/image";
import Link from "next/link";

import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";

/**
 * Portfolio Layout（Spec §8.11）
 *
 * 首頁只顯示 Featured Projects，且必須明確標記類型——
 * 「一眼證明我們真的做得出來」，但不能靠冒充客戶案例來證明。
 *
 * 這是本階段少數合法使用卡片文法的版式（Spec §3.1）：
 * 作品本來就是並列的獨立物件。但採不等寬網格而非整齊六宮格，
 * 避免整頁變成 Dashboard。
 */

export interface PortfolioCard {
  id: string;
  title: string;
  /** 作品類別或服務描述，例如「Premium Brand Landing Page」 */
  kicker: string;
  projectType: PortfolioProjectType;
  href: string;
  /**
   * 封面。
   *
   * ⚠️ `alt` 為必填而非選填，是刻意的型別設計：
   * V3 Demo 的作品區全部使用 CSS 漸層背景，因此完全沒有替代文字（Spec §45.1）。
   * 這裡讓「有圖但沒有 alt」在編譯期就不可能成立。
   *
   * Phase 2 接上 Supabase Storage 後由 PortfolioMedia 映射過來；
   * 未提供時渲染純色佔位塊，不會產生無替代文字的圖片。
   */
  cover?: { url: string; alt: string };
  /** 無封面時的佔位色調 */
  placeholderTone?: "cream" | "ink" | "accent";
}

const TONE_CLASS: Record<NonNullable<PortfolioCard["placeholderTone"]>, string> = {
  cream: "bg-brand-cream",
  ink: "bg-brand-ink",
  accent: "bg-brand-accent-soft",
};

function Card({ item, featured }: { item: PortfolioCard; featured: boolean }) {
  return (
    <article
      // 網格的欄列跨距由外層 <li> 控制，卡片本身只管高度並撐滿格子。
      className={`border-brand-line relative h-full overflow-hidden rounded-xl border ${
        featured ? "min-h-[26rem]" : "min-h-[19rem]"
      }`}
    >
      {item.cover ? (
        <Image
          src={item.cover.url}
          alt={item.cover.alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      ) : (
        <div
          className={`absolute inset-0 ${TONE_CLASS[item.placeholderTone ?? "cream"]}`}
          aria-hidden="true"
        />
      )}

      <span className="bg-brand-paper/90 text-caption absolute top-4 left-4 rounded-pill px-3 py-1.5 font-black backdrop-blur-sm">
        {PROJECT_TYPE_LABELS[item.projectType]}
      </span>

      <div className="from-brand-ink/85 text-brand-on-ink absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-6">
        <p className="text-caption opacity-80">{item.kicker}</p>
        <h3 className="text-heading-1 mt-1.5">
          <Link href={item.href} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </h3>
      </div>
    </article>
  );
}

/**
 * `featured` — 首頁用。第一件放大成 2×2 作為主視覺（Spec §8.11
 *              「一眼證明我們真的做得出來」）。適合 3 件左右。
 *
 * `uniform`  — `/work` 列表用。等權重網格。
 *              列表頁沿用 featured 會讓件數非 3 的倍數時最後一列空一半，
 *              而且「第一件比較重要」在列表語境下並不成立。
 */
export type PortfolioLayoutVariant = "featured" | "uniform";

export function PortfolioLayout({
  items,
  variant = "featured",
}: {
  items: PortfolioCard[];
  variant?: PortfolioLayoutVariant;
}) {
  if (variant === "uniform") {
    return (
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card item={item} featured={false} />
          </li>
        ))}
      </ul>
    );
  }

  const [lead, ...rest] = items;

  return (
    <ul className="grid gap-4 md:grid-cols-4">
      {lead ? (
        <li className="md:col-span-2 md:row-span-2">
          <Card item={lead} featured />
        </li>
      ) : null}
      {rest.map((item) => (
        <li key={item.id} className="md:col-span-2">
          <Card item={item} featured={false} />
        </li>
      ))}
    </ul>
  );
}
