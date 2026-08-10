/**
 * Editorial Section（Spec §3.1）
 *
 * 大字 + 留白的敘事版式，用來打斷卡片網格的節奏。
 * 全站不得連續出現超過兩個卡片網格 Section，這個 primitive 就是解藥之一。
 *
 * 刻意不提供 card 變體：需要卡片時用別的 primitive，
 * 不要讓這支元件長出「editorial 但其實是卡片」的模式。
 */
export function EditorialSection({
  kicker,
  title,
  lead,
  align = "start",
  children,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  align?: "start" | "center";
  children?: React.ReactNode;
}) {
  const isCentered = align === "center";

  return (
    <section
      className={`mx-auto w-full max-w-page px-gutter py-section lg:px-gutter-lg lg:py-section-lg ${
        isCentered ? "text-center" : ""
      }`}
    >
      <div className={isCentered ? "mx-auto" : ""}>
        {kicker ? <p className="text-kicker text-brand-accent uppercase">{kicker}</p> : null}
        {/* 量測寬度用 em 而非 ch：ch 以拉丁數字「0」的字寬校準，中文字約為其兩倍寬，
            用 ch 會讓中文標題在遠早於預期的位置換行（24ch 實測只放得下 5–6 個中文字）。
            1em ≈ 1 個中文字，因此 14em ≈ 每行 14 字，是可預期的中文行長。 */}
        <h2 className={`text-display-2 mt-3 max-w-[14em] ${isCentered ? "mx-auto" : ""}`}>
          {title}
        </h2>
      </div>

      {lead ? (
        <p className={`text-lead text-brand-muted mt-8 max-w-prose ${isCentered ? "mx-auto" : ""}`}>
          {lead}
        </p>
      ) : null}

      {children ? <div className="mt-14">{children}</div> : null}
    </section>
  );
}
