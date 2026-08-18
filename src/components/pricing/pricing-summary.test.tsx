// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRICING_GROUPS, PRICING_TIERS, type PricingTier } from "@/config/pricing";

import { PricingSummary } from "./pricing-summary";

/**
 * 首頁的價格入口（Spec §26.1 / CR-006）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * CR-006 把完整六級移到 `/pricing`，首頁只留入口。而 §26.1 的原意
 * （升級路徑不能有斷層）只在**首頁真的把人帶過去**時才成立——
 * 藏起來就等於缺了那些級距。
 *
 * 另一半是「兩個地方講不一樣的價錢」：價格的真相是 CMS，
 * 而這一段若寫死數字，後台改完之後首頁會繼續顯示舊的，
 * 沒有任何錯誤訊息。
 */

describe("首頁的價格入口", () => {
  it("每一組的入口價都出現，而且是從資料來的", () => {
    render(<PricingSummary groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);

    for (const group of PRICING_GROUPS) {
      const first = PRICING_TIERS.find((tier) => tier.group === group.id)!;
      expect(screen.getByText(group.label)).toBeInTheDocument();
      expect(
        screen.getAllByText(new RegExp(first.price.replace(/\$/g, "\\$"))).length,
      ).toBeGreaterThan(0);
    }
  });

  it("⚠️ 改了 CMS 的價格，首頁跟著變", () => {
    /*
     * 這一條是整組的核心。
     *
     * 寫死「NT$ 8,800 起」的話上面那條也會過（因為預設資料剛好是它），
     * 所以要用一份**不一樣的**資料再驗一次。
     * 兩個地方講不一樣的價錢是會賠錢的失敗，而它完全不會報錯。
     */
    const changed: PricingTier[] = PRICING_TIERS.map((tier) =>
      tier.group === "build" && tier.id === "template-build"
        ? { ...tier, price: "NT$ 12,345" }
        : tier,
    );

    render(<PricingSummary groups={PRICING_GROUPS} tiers={changed} />);
    expect(screen.getByText(/12,345/)).toBeInTheDocument();
  });

  it("級數是算出來的，不是寫死的「六級」", () => {
    // 之後加一級而這裡還寫「六級」，那就是在說謊
    const { unmount } = render(<PricingSummary groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    expect(
      screen.getByRole("link", { name: new RegExp(`完整 ${PRICING_TIERS.length} 級`) }),
    ).toBeInTheDocument();
    unmount();

    const fewer = PRICING_TIERS.slice(0, 4);
    render(<PricingSummary groups={PRICING_GROUPS} tiers={fewer} />);
    expect(screen.getByRole("link", { name: /完整 4 級/ })).toBeInTheDocument();
  });

  it("往完整階梯的連結一定在，而且指向 /pricing", () => {
    // §26.1 的原意靠這個連結成立。沒有它，首頁就真的「缺了那幾級」
    render(<PricingSummary groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    expect(screen.getByRole("link", { name: /完整/ })).toHaveAttribute("href", "/pricing");
  });
});
