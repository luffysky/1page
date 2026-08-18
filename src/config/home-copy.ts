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

/**
 * 各 Section 的標題文案。
 *
 * ⚠️ **kicker 只放名字，不放編號。**
 *
 * 編號由 `page.tsx` 依實際渲染順序算出來（`blockNumbers`）。
 * 寫死在這裡的話，後台拖動任何一塊就會對不上——而 BJ-2 之後
 * 順序正是後台可以排的。0818 依 CR-005 把 services 提前之後
 * 就發生過一次：畫面上出現「作品之後是 05 / SERVICES」。
 *
 * 這也是為什麼 `numberedKicker` 會先把既有的 `NN / ` 拔掉：
 * 有人在後台照著舊樣子打了編號時，位置仍然說了算。
 */
export const SECTION_COPY = {
  goals: {
    kicker: "Goals",
    title: "你今天想完成什麼？",
    lead: "不用先學會網站術語。告訴我們你的目標，我們再把它拆成能執行的工作。",
  },
  work: {
    kicker: "Selected Work",
    title: "不只說我們會做，直接給你看。",
    lead: "Demo、內部產品與真實客戶案會明確標示，不混在一起。",
  },
  template: {
    kicker: "Template Experience",
    title: "不想聊天，也可以自己先試穿。",
    lead: "選產業、換 Theme、切裝置。想讓 AI 接手時再叫它，Agent 不是唯一入口。",
  },
  advisor: {
    kicker: "AI Website Advisor",
    title: "先聊需求，再讓網站長出來。",
    lead: "免費階段負責理解需求、推薦方案與基礎試穿。當 AI 開始替你規劃架構、寫內容、操作網站，就進入可付費的 Website Workshop。",
  },
  philosophy: {
    kicker: "AI Philosophy",
    title: "會用 AI，跟能用 AI 做出產品，是兩回事。",
    lead: "我們不隱瞞 AI，也不販賣 AI。你付的不是生成費，而是完成費。",
  },
  services: {
    kicker: "Services",
    title: "需要的是成果，不是一長串工具名稱。",
    lead: "四條產品線依專案組合，不讓首頁變成數位菜市場。",
  },
  pricing: {
    kicker: "Product Ladder",
    title: "先試，再決定要做到多深。",
    lead: "價格依責任範圍與客製程度，不按「只有一頁」亂算。",
  },
  process: {
    kicker: "Process",
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

/**
 * `/work` 的頁首（CR-004 / BI）
 *
 * ⚠️ 這三句原本直接寫在 `app/work/page.tsx` 裡，而且與
 * `SECTION_COPY.work` **一字不差**——也就是同一句話有兩份。
 * 改了其中一份的人不會知道另一份還在，於是首頁與作品頁開始講不同的話。
 *
 * 搬出來之後兩邊各自可編輯：它們本來就可能想講不同的話，
 * 只是不該「以為改了一個就等於改了兩個」。
 */
/**
 * `/pricing` 的頁首（CR-006）。
 *
 * 與 `SECTION_COPY.pricing`（首頁那段精簡入口）刻意分開：
 * 首頁那句是「先試，再決定要做到多深」——一句邀請；
 * 這一頁的讀者已經決定要看價錢了，要的是責任範圍怎麼分。
 */
export const PRICING_COPY = {
  kicker: "Product Ladder",
  title: "價格依責任範圍，不按頁數算。",
  lead: "從免費的需求釐清，到我們把整件事扛下來。六級之間沒有斷層——這正是它們存在的理由。",
} as const;

/** `/playground` 的頁首（CR-006）。首頁那段是預告，這一頁才是完整的試穿間 */
export const PLAYGROUND_COPY = {
  kicker: "Website Playground",
  title: "你的網站，可以先試穿。",
  lead: "換版型、換配色、換裝置，都在這裡。不用登入，也不用先跟任何人講話。",
} as const;

export const WORK_COPY = {
  kicker: "Selected Work",
  title: "不只說我們會做，直接給你看。",
  lead: "Demo、內部產品與真實客戶案會明確標示，不混在一起。",
} as const;

/** `/start` 的頁首。標題原本寫死在頁面裡，斷行用 `<br />` */
export const START_COPY = {
  kicker: "Project Builder",
  title: "你不需要先知道怎麼做。",
  lead: "只需要告訴我們，你想完成什麼。空著的欄位不影響送出——我們寧可先接到一份不完整的需求，也不要你為了填完而放棄。",
} as const;

/**
 * 登入頁。
 *
 * ⚠️ 原本寫的是「此頁供工作人員使用。」——CR-002 之後那句話不成立了：
 * 這是**所有人**的登入頁，一般會員也從這裡進會員中心。
 * 一句過期的說明會讓真的想登入的人以為自己走錯地方。
 */
export const LOGIN_COPY = {
  kicker: "一頁起家",
  title: "登入",
  lead: "會員從這裡進入自己的後台，管理存下來的網站與送出的需求。",
} as const;

/** 頁尾。版權歸 SnowRealm——一頁起家是斯諾瑞姆企業社旗下的產品 */
export const FOOTER_COPY = {
  wordmark: "一頁起家",
  disclosure:
    "我們會合理使用 AI 協助研究、內容整理、設計探索與程式開發。AI 是生產工具，正式交付成果仍經人工判斷、測試與品質確認。",
  copyright: "SnowRealm 斯諾瑞姆企業社",
} as const;

export const FINAL_CTA_COPY = {
  /** 轉換前最後一句話，斷點依句意而非依剩餘寬度 */
  titleLines: ["你不需要", "先知道怎麼做。"],
  lead: "只需要告訴我們，你想完成什麼。",
  // 指向 Project Builder（Spec §30）。7B 之前這裡指回 #contact 自己，
  // 也就是「按了什麼都沒發生」——那條連結存在的目的正是要有下一步。
  cta: { label: "開始一個專案", href: "/start" },
} as const;
