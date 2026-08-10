export interface HeroCta {
  label: string;
  href: string;
}

/**
 * Hero（Spec §5）
 *
 * 刻意不接受 children、不內建預覽卡：Hero 的工作是把一句話講清楚，
 * 靠大字級與留白建立節奏，而不是塞一張示意圖進去（Spec §3.1）。
 *
 * 文案由外部傳入——primitive 只負責版面，內容來自 config。
 */
export function Hero({
  badge,
  titleLines,
  lead,
  primaryCta,
  secondaryCta,
}: {
  badge: string;
  /**
   * 逐行給定，不是一整串。
   *
   * 中文無詞界，把全站最大的一行交給瀏覽器自動斷行，
   * 在不同視窗寬度會斷在不同的、且常常是錯的位置。
   */
  titleLines: readonly string[];
  lead: string;
  primaryCta: HeroCta;
  secondaryCta: HeroCta;
}) {
  return (
    <section className="mx-auto w-full max-w-page px-gutter pt-section pb-section lg:px-gutter-lg lg:pt-section-lg lg:pb-section-lg">
      <p className="border-brand-line text-caption text-brand-muted inline-flex items-center gap-2.5 rounded-pill border px-3.5 py-2 font-bold">
        <span className="bg-brand-accent h-2 w-2 rounded-pill" aria-hidden="true" />
        {badge}
      </p>

      {/* 不設 max-w-[Nch]：ch 以拉丁數字「0」的字寬校準，套在中文上會嚴重低估
          可容納字數，導致標題提早換行。斷行改由 titleLines 明確控制。 */}
      <h1 className="text-display-1 mt-7">
        {titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="text-lead text-brand-muted mt-8 max-w-prose">{lead}</p>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={primaryCta.href}
          className="bg-brand-accent text-brand-on-accent inline-flex rounded-pill px-6 py-4 font-bold"
        >
          {primaryCta.label}
        </a>
        <a
          href={secondaryCta.href}
          className="border-brand-ink text-brand-ink inline-flex rounded-pill border px-6 py-4 font-bold"
        >
          {secondaryCta.label}
        </a>
      </div>
    </section>
  );
}
