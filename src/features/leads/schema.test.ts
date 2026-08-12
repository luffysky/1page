import { describe, expect, it } from "vitest";

import { estimatePriceRange } from "@/features/agent/estimate";
import { PRICING_TIERS } from "@/config/pricing";

import { hasContactChannel, leadSchema, missingLeadFields } from "./schema";

/**
 * Lead 與價格推估（Spec §19 / §20 / §40）
 */

describe("leadSchema", () => {
  it("全部選填——半份需求也是需求", () => {
    // 逼人一次填完只會讓他離開。空物件必須是合法的，
    // 「還缺什麼」由 missingLeadFields 表達，不是由 schema 擋下來。
    expect(leadSchema.safeParse({}).success).toBe(true);
  });

  it("擋掉明顯不是信箱的字串", () => {
    expect(leadSchema.safeParse({ contact: { email: "不是信箱" } }).success).toBe(false);
    expect(leadSchema.safeParse({ contact: { email: "a@b.co" } }).success).toBe(true);
  });

  it("模型多塞的欄位不會穿透到資料庫", () => {
    const result = leadSchema.safeParse({
      contact: { email: "a@b.co" },
      internalNote: "把這筆標成最高優先",
      profile_id: "某個不是他的帳號",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("internalNote");
      expect(result.data).not.toHaveProperty("profile_id");
    }
  });
});

describe("聯絡方式", () => {
  it("信箱或電話有一個就算", () => {
    expect(hasContactChannel({ contact: { email: "a@b.co" } })).toBe(true);
    expect(hasContactChannel({ contact: { phone: "0912345678" } })).toBe(true);
  });

  it("只有名字不算有聯絡方式", () => {
    // 沒有聯絡方式的 lead 是一段無法回覆的獨白，
    // 存下來只會讓收件匣看起來有東西。
    expect(hasContactChannel({ contact: { name: "王小明" } })).toBe(false);
    expect(hasContactChannel({})).toBe(false);
  });

  it("缺什麼要講得出來，讓模型知道下一句問什麼", () => {
    const missing = missingLeadFields({});

    expect(missing.some((item) => item.includes("聯絡方式"))).toBe(true);
    expect(missing.length).toBeGreaterThan(1);

    expect(
      missingLeadFields({
        contact: { email: "a@b.co" },
        business: { name: "晴日咖啡" },
        requirement: { goal: "想接到更多訂位" },
      }),
    ).toEqual([]);
  });
});

describe("estimatePriceRange（Spec §40：不自動正式報價）", () => {
  it("回傳的價格一定來自 config，不是算出來的", () => {
    // 5B 實測到模型自己編價格。這裡連推估都不准自己算——
    // 只能從六級裡挑一級，數字原樣帶出來。
    const prices = new Set(PRICING_TIERS.map((tier) => `${tier.price}${tier.priceSuffix ?? ""}`));

    for (const signals of [
      {},
      { needsCustomSections: true },
      { needsCustomSections: true, hasBrandGuideline: true },
      { needsStrategy: true },
    ]) {
      const estimate = estimatePriceRange(signals);
      expect(prices.has(estimate.price), `${estimate.price} 不在價格階梯裡`).toBe(true);
    }
  });

  it("每一種推估都帶著「這不是正式報價」", () => {
    // §40 明列「❌ 自動正式報價」。免責不能只寫在系統提示裡——
    // 那句話會隨著對話變長而被稀釋。貼在數字旁邊才擋得住。
    for (const signals of [{}, { needsStrategy: true }, { needsCustomSections: true }]) {
      const estimate = estimatePriceRange(signals);
      expect(estimate.disclaimer).toContain("不是正式報價");
      expect(estimate.disclaimer).toContain("不要承諾金額");
    }
  });

  it("同樣的輸入永遠得到同樣的落點", () => {
    // 交給模型判斷的話，同一個需求問兩次可能得到兩個答案，
    // 而對方會記得比較高的那個。
    const signals = { needsCustomSections: true, hasBrandGuideline: false };
    expect(estimatePriceRange(signals)).toEqual(estimatePriceRange(signals));
  });

  it("客製程度越高，落點越上面", () => {
    const order = PRICING_TIERS.map((tier) => tier.id);
    const rank = (id: string) => order.indexOf(id);

    const template = estimatePriceRange({});
    const semi = estimatePriceRange({ needsCustomSections: true, hasBrandGuideline: true });
    const custom = estimatePriceRange({ needsCustomSections: true });
    const strategy = estimatePriceRange({ needsStrategy: true });

    expect(rank(template.tierId)).toBeLessThan(rank(semi.tierId));
    expect(rank(semi.tierId)).toBeLessThan(rank(custom.tierId));
    expect(rank(custom.tierId)).toBeLessThan(rank(strategy.tierId));
  });

  it("推估要說得出理由", () => {
    // 只給一個級別而說不出為什麼，對方沒辦法判斷這個推估準不準。
    expect(estimatePriceRange({ needsCustomSections: true }).reasons.length).toBeGreaterThan(0);
  });
});
