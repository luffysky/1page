import { getPricingTiersByGroup, PRICING_GROUPS, type PricingTier } from "@/config/pricing";

/**
 * Pricing Ladder（Spec §26.2）
 *
 * ⚠️ 六級不得做成六張等寬圓角卡。
 *
 * 兩個理由：
 * 1. 那正是 §3.1 禁止的卡片文法
 * 2. 六欄在 1280px 以下根本無法閱讀
 *
 * 改採縱向階梯：分兩組敘事，每級一列，靠縮排與字級傳達
 * 「責任範圍遞增」，而不是 SaaS 的功能打勾比較表（呼應 §27）。
 */

function TierRow({ tier, index }: { tier: PricingTier; index: number }) {
  return (
    <li
      className={`border-brand-line grid gap-2 border-t py-7 md:grid-cols-[1fr_auto] md:items-baseline md:gap-10 ${
        tier.featured ? "border-brand-accent border-t-2" : ""
      }`}
    >
      {/* 縮排隨層級遞增，讓「往上一階＝責任更重」在版面上看得出來 */}
      <div className={index > 0 ? "md:pl-8" : ""}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-heading-1">{tier.name}</h3>
          {tier.featured ? (
            <span className="bg-brand-accent text-brand-on-accent text-caption rounded-pill px-2.5 py-1 font-black">
              POPULAR
            </span>
          ) : null}
        </div>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">{tier.summary}</p>
      </div>

      <p className="text-heading-1 whitespace-nowrap md:text-right">
        {tier.price}
        {tier.priceSuffix ? (
          <span className="text-caption text-brand-muted font-normal"> {tier.priceSuffix}</span>
        ) : null}
      </p>
    </li>
  );
}

export function PricingLadder() {
  return (
    <div className="flex flex-col gap-16">
      {PRICING_GROUPS.map((group) => (
        <section key={group.id}>
          <p className="text-kicker text-brand-accent uppercase">{group.label}</p>
          <p className="text-body-sm text-brand-muted mt-2 max-w-prose">{group.description}</p>

          <ul className="mt-6">
            {getPricingTiersByGroup(group.id).map((tier, index) => (
              <TierRow key={tier.id} tier={tier} index={index} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
