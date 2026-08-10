/**
 * Dark CTA Block（Spec §30 / §3.1）
 *
 * 節奏上的收束：整頁以暖白為底，最後用一塊近黑滿版把視線收起來。
 * 這是全站唯一大面積深色區塊，用多了就失去收束效果。
 */
export function DarkCtaBlock({
  titleLines,
  lead,
  cta,
  children,
}: {
  /** 與 Hero 相同的理由逐行給定：這是轉換前最後一句話，不交給瀏覽器猜斷點 */
  titleLines: readonly string[];
  lead: string;
  cta: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-page px-gutter py-section lg:px-gutter-lg lg:py-section-lg">
      <div className="bg-brand-ink text-brand-on-ink rounded-2xl p-8 md:p-14">
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-start">
          <div>
            <h2 className="text-display-2">
              {titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="text-lead mt-6 opacity-75">{lead}</p>
            <a
              href={cta.href}
              className="bg-brand-accent-strong text-brand-on-accent mt-10 inline-flex rounded-pill px-6 py-4 font-bold"
            >
              {cta.label}
            </a>
          </div>
          {children ? <div>{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
