import Link from "next/link";

import { getPricingTiersByGroup, type PricingGroup, type PricingTier } from "@/config/pricing";

/**
 * 首頁的價格入口（Spec §26.1 / CR-006）
 *
 * ── 首頁只留入口，完整六級在 /pricing ────────────────────────
 *
 * §26.1 原本要求六級完整呈現在首頁。CR-006 把位置改了，但**原意沒有變**：
 * 那條的理由是「缺了承接點，升級路徑等同從 990 直接跳 30,000」，
 * 而那個顧慮是「階梯有缺口」，不是「階梯放在哪一頁」。
 *
 * 所以這一段有一個硬性要求：**把「起價」與「往下看完整階梯」都講清楚，
 * 而且連結要顯眼**。藏起來就等於缺了它們。
 *
 * ── ⚠️ 每一個數字都從資料算出來，一個都不寫死 ─────────────────
 *
 * 價格的真相是 CMS。這裡若寫死「8,800 起」或「六級」，
 * 後台改了價格之後首頁會**繼續顯示舊的**——而且不會有任何錯誤，
 * 只是兩個地方講不一樣的價錢。那是這個專案最怕的一種失敗。
 *
 * 級數也一樣：寫死「六級」的話，之後加一級就變成說謊。
 */
export function PricingSummary({
  groups,
  tiers,
  href = "/pricing",
}: {
  groups: readonly PricingGroup[];
  tiers: readonly PricingTier[];
  href?: string;
}) {
  /*
   * 每一組的第一級就是那一組的入口價。
   *
   * 用「第一級」而不是「找最便宜的那個」：價格是字串
   * （「免費」「專案報價」不是數字），比大小得先猜怎麼解析，
   * 而猜錯的表現是首頁顯示一個沒有人看得懂的數字。
   * 順序本來就是階梯的意義所在，直接用它。
   */
  const entries = groups
    .map((group) => ({ group, tier: getPricingTiersByGroup(tiers, group.id)[0] }))
    .filter((entry): entry is { group: PricingGroup; tier: PricingTier } => Boolean(entry.tier));

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-px sm:grid-cols-2">
        {entries.map(({ group, tier }) => (
          <li key={group.id} className="border-brand-line border-t pt-6">
            <p className="text-kicker text-brand-accent-strong uppercase">{group.label}</p>
            <p className="text-display-2 mt-3">
              {tier.price}
              {tier.priceSuffix ? (
                <span className="text-body text-brand-muted font-normal"> {tier.priceSuffix}</span>
              ) : null}
            </p>
            <p className="text-body-sm text-brand-muted mt-2 max-w-prose">{group.description}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          href={href}
          className="border-brand-ink text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink border px-6 py-3 font-bold transition-colors"
        >
          看完整 {tiers.length} 級與各自的責任範圍 →
        </Link>
        <p className="text-caption text-brand-muted max-w-prose">
          不知道選哪個不用先選——先告訴我們你要做什麼就好。
        </p>
      </div>
    </div>
  );
}
