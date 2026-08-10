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
  primaryCta: { label: "看看你的網站可以長怎樣", href: "#try" },
  secondaryCta: { label: "看看我們做過什麼", href: "#work" },
} as const;

export const FINAL_CTA_COPY = {
  /** 轉換前最後一句話，斷點依句意而非依剩餘寬度 */
  titleLines: ["你不需要", "先知道怎麼做。"],
  lead: "只需要告訴我們，你想完成什麼。",
  cta: { label: "開始一個專案", href: "#contact" },
} as const;
