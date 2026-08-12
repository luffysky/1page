import { PRICING_TIERS } from "@/config/pricing";

/**
 * 價格區間推估（Spec §20 `estimate_price_range` / §40「❌ 自動正式報價」）
 *
 * ── 為什麼這是程式而不是讓模型自己判斷 ────────────────────────
 *
 * 價格階梯已經在系統提示裡（見 knowledge.ts），所以模型看得到數字。
 * 但「這個需求落在哪一級」是一個規則問題，不是語言問題——
 * 交給模型判斷的話，同樣的需求問兩次可能得到兩個答案，
 * 而對方會記得比較高的那個。
 *
 * 這裡把 Spec §27「價格依責任範圍」翻成幾個是非題，
 * 由程式決定落點。模型負責問出那幾個是非題的答案。
 */

export interface EstimateSignals {
  /** 要不要加模板沒有的區塊、版面要不要照品牌重新調整 */
  needsCustomSections?: boolean;
  /** 要不要連策略、內容、成效追蹤一起處理 */
  needsStrategy?: boolean;
  /** 有沒有既有的品牌規範可以延用 */
  hasBrandGuideline?: boolean;
}

export interface PriceEstimate {
  /** 建議落點的級別 id */
  tierId: string;
  tierName: string;
  price: string;
  summary: string;
  /** 影響落點的因素，讓模型可以解釋為什麼 */
  reasons: string[];
  /** §40：不是正式報價 */
  disclaimer: string;
}

const DISCLAIMER =
  "這是依責任範圍推估的落點，**不是正式報價**。" +
  "正式報價需要真人確認範圍後才會出——不要承諾金額，也不要說「這樣就是多少錢」。";

export function estimatePriceRange(signals: EstimateSignals): PriceEstimate {
  const reasons: string[] = [];

  let tierId: string;

  if (signals.needsStrategy) {
    tierId = "strategy";
    reasons.push("要連策略、內容與成效追蹤一起處理");
  } else if (signals.needsCustomSections) {
    // 有既有品牌規範可延用 → 以模板為底調整就夠（Semi-Custom）；
    // 沒有的話視覺要從頭建立，那是 Custom 的範圍。
    tierId = signals.hasBrandGuideline ? "semi-custom" : "custom";
    reasons.push("需要模板沒有的區塊或版面調整");
    reasons.push(
      signals.hasBrandGuideline ? "已有品牌規範可延用" : "沒有既有品牌規範，視覺要重新建立",
    );
  } else {
    tierId = "template-build";
    reasons.push("以既有模板換上品牌與內容即可");
  }

  // 從 config 取，不手抄。抄一次就會分岔，
  // 而分岔的表現是「網站上寫 8,800、AI 說 8,000」。
  const tier = PRICING_TIERS.find((item) => item.id === tierId)!;

  return {
    tierId: tier.id,
    tierName: tier.name,
    price: `${tier.price}${tier.priceSuffix ?? ""}`,
    summary: tier.summary,
    reasons,
    disclaimer: DISCLAIMER,
  };
}
