/**
 * 產品階梯（Spec §26 / §26.1 / §26.2）
 *
 * ⚠️ 六級必須完整。Template Build 與 Semi-Custom 是 990 與 30,000 之間
 * 唯一的承接點——缺了它們，升級路徑等同從 NT$990 直接跳 NT$30,000，
 * 轉換會斷在這裡。V3 Demo 只呈現 4 級，屬於偏離（Spec §45.1）。
 *
 * 呈現形式見 §26.2：不得做成六張等寬圓角卡。
 */

export type PricingGroupId = "clarify" | "build";

export interface PricingTier {
  id: string;
  name: string;
  /** 價格文字。刻意存字串而非數字：「免費」「專案報價」不是數字 */
  price: string;
  /** 「起」之類的價格後綴；無則省略 */
  priceSuffix?: string;
  summary: string;
  group: PricingGroupId;
  featured?: boolean;
}

export interface PricingGroup {
  id: PricingGroupId;
  label: string;
  description: string;
}

/**
 * §26.2：分兩組敘事，強調「責任範圍遞增」而非「功能打勾比較」。
 * 呼應 §27——價格依責任範圍，不依頁數，呈現方式也該傳達這件事。
 */
export const PRICING_GROUPS: readonly PricingGroup[] = [
  {
    id: "clarify",
    label: "先想清楚",
    description: "還不確定要做什麼、做到多深的階段。",
  },
  {
    id: "build",
    label: "開始建站",
    description: "確定方向後，依責任範圍與客製程度選擇。",
  },
];

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: "advisor",
    name: "AI Advisor",
    price: "免費",
    summary: "需求探索、方案推薦、價格區間與基礎網站試穿。",
    group: "clarify",
  },
  {
    id: "workshop",
    name: "Website Workshop",
    price: "NT$ 990",
    priceSuffix: "起",
    summary: "Blueprint、Section 規劃、文案初稿與 Agent 網站操作；正式建站可折抵。",
    group: "clarify",
    featured: true,
  },
  {
    id: "template-build",
    name: "Template Build",
    price: "NT$ 8,800",
    priceSuffix: "起",
    summary: "以既有模板調整品牌與內容，人工 QA 後上線。",
    group: "build",
  },
  {
    id: "semi-custom",
    name: "Semi-Custom",
    price: "NT$ 15,800",
    priceSuffix: "起",
    summary: "模板為底，版面與視覺依品牌調整，可加入客製 Section。",
    group: "build",
  },
  {
    id: "custom",
    name: "Custom",
    price: "NT$ 30,000",
    priceSuffix: "起",
    summary: "依品牌與需求重新設計，不被模板限制。",
    group: "build",
  },
  {
    id: "strategy",
    name: "Strategy + Design + Build",
    price: "專案報價",
    summary: "策略、內容、UX/UI、開發與成效追蹤一起處理。",
    group: "build",
  },
];

/**
 * 依組別取出價格級距。
 *
 * ⚠️ 級距由呼叫端傳進來，不在這裡讀 `PRICING_TIERS`。
 *
 * 價格現在的真相是 CMS（`cms_documents` 的 `pricing.tiers`），
 * 而這個常數退成預設值。讀常數的話，後台改了價格、首頁顯示新的、
 * **AI 顧問的系統提示卻還是舊的**——那正是 Phase 5「模型自己編價格」
 * 那個 bug 的翻版，只是這次編的人是我們自己。
 */
export function getPricingTiersByGroup(
  tiers: readonly PricingTier[],
  group: PricingGroupId,
): PricingTier[] {
  return tiers.filter((tier) => tier.group === group);
}
