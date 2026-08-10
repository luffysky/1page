/**
 * 首頁文案（Spec §5 Hero / §30 Final CTA）
 *
 * Spec 明訂這些字串，集中一處避免各元件各自複寫而漂移。
 * V3 Demo 把次要 CTA 誤植為「瀏覽所有服務」，導向服務而非作品，
 * 與「作品集是陌生客戶建立信任的重要證據」的策略相反（Spec §45.1）。
 */

export const HERO_COPY = {
  badge: "AI-assisted · Human-reviewed",
  /**
   * 全站最重要的一行，斷行不交給瀏覽器猜。
   *
   * 中文沒有空格，瀏覽器缺乏詞界資訊，放任自動斷行會出現
   * 「從第一頁，開／始你的生意。」這種把詞拆開的結果。
   * Spec §5 的原文本身就是兩句，照句意斷。
   */
  titleLines: ["從第一頁，", "開始你的生意。"],
  lead: "網站、品牌、內容、設計與 AI 自動化。從想法、設計到真正可以使用的產品。",
  primaryCta: { label: "看看你的網站可以長怎樣", href: "/#advisor" },
  secondaryCta: { label: "看看我們做過什麼", href: "/#work" },
} as const;

/** Spec §4 IA 中各 Section 的標題文案 */
export const SECTION_COPY = {
  goals: {
    kicker: "01 / Goals",
    title: "你今天想完成什麼？",
    lead: "不用先學會網站術語。告訴我們你的目標，我們再把它拆成能執行的工作。",
  },
  work: {
    kicker: "Selected Work",
    title: "不只說我們會做，直接給你看。",
    lead: "Demo、內部產品與真實客戶案會明確標示，不混在一起。",
  },
  template: {
    kicker: "02 / Template Experience",
    title: "不想聊天，也可以自己先試穿。",
    lead: "選產業、換 Theme、切裝置。想讓 AI 接手時再叫它，Agent 不是唯一入口。",
  },
  advisor: {
    kicker: "03 / AI Website Advisor",
    title: "先聊需求，再讓網站長出來。",
    lead: "免費階段負責理解需求、推薦方案與基礎試穿。當 AI 開始替你規劃架構、寫內容、操作網站，就進入可付費的 Website Workshop。",
  },
  philosophy: {
    kicker: "04 / AI Philosophy",
    title: "會用 AI，跟能用 AI 做出產品，是兩回事。",
    lead: "我們不隱瞞 AI，也不販賣 AI。你付的不是生成費，而是完成費。",
  },
  services: {
    kicker: "05 / Services",
    title: "需要的是成果，不是一長串工具名稱。",
    lead: "四條產品線依專案組合，不讓首頁變成數位菜市場。",
  },
  pricing: {
    kicker: "06 / Product Ladder",
    title: "先試，再決定要做到多深。",
    lead: "價格依責任範圍與客製程度，不按「只有一頁」亂算。",
  },
  process: {
    kicker: "07 / Process",
    title: "合作流程，別搞得像解支線任務。",
  },
} as const;

/** Spec §43 Phase 1 未指定流程文案，此處採與 Demo 一致的四步 */
export const PROCESS_STEPS = [
  { step: "01", title: "需求", summary: "告訴我們想完成什麼。" },
  { step: "02", title: "方向與報價", summary: "確認 Scope、工期與費用。" },
  { step: "03", title: "製作與 Review", summary: "設計、開發、測試與修改。" },
  { step: "04", title: "上線", summary: "正式交付，後續需要再進維護。" },
] as const;

export const FINAL_CTA_COPY = {
  /** 轉換前最後一句話，斷點依句意而非依剩餘寬度 */
  titleLines: ["你不需要", "先知道怎麼做。"],
  lead: "只需要告訴我們，你想完成什麼。",
  cta: { label: "開始一個專案", href: "/#contact" },
} as const;
