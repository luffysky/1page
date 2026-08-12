import { PRICING_TIERS } from "./pricing";

/**
 * Website Workshop（Spec §23 / §24 / §25）
 *
 * ── 這道門要說清楚的是「界線在哪」，不是「快付錢」 ────────────
 *
 * Spec §23 的原句：「聊天免費，開始產生成果時收費。」
 * 所以這道門出現的時機不是訊息數用完，是**對方要的東西已經是成果**——
 * 排 Section、寫完整文案、實際操作網站。
 *
 * §23 還有一句同樣重要的：「不要按訊息數收費。」
 * 這個檔案裡因此沒有任何與則數有關的東西。
 *
 * ── V1 不串金流（Spec §25）────────────────────────────────────
 *
 *   Unlock → Pricing Modal → 說明交付物 → CTA / Lead
 *
 * 最後一步是留下需求由真人接手，不是付款頁。市場驗證後才接金流——
 * 在那之前假裝有結帳流程，只會讓第一批真的想付錢的人卡在半路。
 */

/** 價格與名稱都從 pricing.ts 來。抄一次就會分岔 */
const tier = PRICING_TIERS.find((item) => item.id === "workshop")!;

export const WORKSHOP = {
  name: tier.name,
  price: `${tier.price}${tier.priceSuffix ?? ""}`,
  summary: tier.summary,
} as const;

/** Spec §24 明列的成果。順序照規格 */
export const WORKSHOP_DELIVERABLES = [
  { title: "Requirement Summary", description: "把你講的東西整理成一份看得懂的需求。" },
  { title: "Website Blueprint", description: "這個網站要解決什麼、誰會看、看完要做什麼。" },
  { title: "Section Structure", description: "每一段放什麼、為什麼是這個順序。" },
  { title: "Design Direction", description: "風格、色彩與字體的方向，不是一句「乾淨簡約」。" },
  { title: "Copy Draft", description: "可以直接用的文案初稿，不是佔位文字。" },
  { title: "SiteConfig", description: "整份網站設定，正式建站時直接沿用。" },
  { title: "Live Preview", description: "看得到、可以在手機上打開的預覽。" },
] as const;

/**
 * 免費階段做得到與做不到的事。
 *
 * 兩邊都要寫出來。只列「付費才有」的話，這道門讀起來像在說
 * 「你剛才用的都是試用版」——而免費那半是真的有用的東西。
 */
export const WORKSHOP_BOUNDARY = {
  free: [
    "問服務、流程、價格級距",
    "看作品與模板方向",
    "把需求講清楚，留下來讓真人回覆",
    "自己調預覽：換模板、換風格、換品牌名，或讓 AI 幫你調",
  ],
  paid: [
    "AI 幫你排 Section、決定每一段放什麼",
    "寫完整的文案初稿",
    "多套版面與風格的迭代",
    "AI 直接操作你的網站內容",
  ],
} as const;

/** 折抵（Spec §24：正式委託時 Workshop 費用可折抵） */
export const WORKSHOP_CREDIT_NOTE = "之後正式建站時，這筆費用可以折抵。";
