import type { PortfolioDetail } from "./detail";

/**
 * 詳細頁的暫時資料。2D 由 Supabase 供應。
 *
 * ⚠️ 刻意做成「詳盡程度不一」：
 *   interior-studio      完整 Case Study + 連結 + AI 揭露
 *   yipage-identity      部分區塊（無 thinking / result）
 *   ai-website-workshop  只有 summary，無 Case Study
 *
 * Spec §8.10 要求「沒有完整 Case Study 資料時只顯示存在的區塊，
 * 不要顯示空 Section」。全部資料都填滿的種子驗證不了這條規則——
 * 就像 2A 的 seed 必須放一筆 draft 才驗得了 RLS。
 *
 * 同樣沒有任何一筆 `client`（Spec §8.2、§29）。
 */
const DETAILS: PortfolioDetail[] = [
  {
    id: "interior-studio",
    slug: "interior-studio",
    title: "山序設計 / Interior Studio",
    kicker: "Premium Brand Landing Page",
    summary: "以乾淨的比例、材質與光線，讓每個空間都有自己的節奏。",
    projectType: "demo",
    categories: ["web", "ui-ux"],
    tags: ["Landing Page", "Luxury", "Minimal"],
    services: ["web", "brand-design"],
    industry: "室內設計",
    year: 2026,
    placeholderTone: "cream",
    caseStudy: {
      problem:
        "室內設計工作室的作品照片很好，但散落在 Instagram，潛在客戶看完不知道下一步該做什麼，也判斷不出這間工作室擅長哪一類空間。",
      goal: "把分散的作品收攏成一個能建立信任的入口，並讓「預約諮詢」成為自然的下一步，而不是頁面底部一個孤立的按鈕。",
      thinking:
        "高單價服務的網站不需要說服訪客「我們很專業」，而是要讓他們自己看出來。因此把版面留給作品本身，文字只負責串接與定位，並在瀏覽節奏的每個停頓點自然出現聯絡動線。",
      solution:
        "一頁式結構：以滿版作品開場，中段用 Editorial 排版說明取向與流程，尾段收束成單一明確的諮詢動線。全站僅一組強調色，其餘交給留白與材質感的中性色。",
      result:
        "這是概念示範，不是已上線的客戶案。用途是展示我們在高端服務業網站上的取向與結構判斷。",
    },
    media: [],
    links: { demo: "/work/interior-studio" },
    aiDisclosure: {
      used: true,
      description: "AI 協助文案草稿與版面探索，視覺方向與最終排版由人工決定與調整。",
    },
  },
  {
    id: "yipage-identity",
    slug: "yipage-identity",
    title: "一頁起家",
    kicker: "Identity / System",
    summary: "自家品牌識別與設計系統。",
    projectType: "internal",
    categories: ["brand", "web", "internal-product"],
    tags: ["Design System", "Editorial"],
    services: ["brand-design", "web"],
    year: 2026,
    placeholderTone: "accent",
    caseStudy: {
      problem: "自家品牌若每個頁面看起來像不同公司，就沒有資格跟客戶談品牌一致性。",
      solution:
        "建立一套 Design Token 系統作為全站唯一數值來源，色彩、字級、間距、圓角、陰影、斷點與動態全部集中管理，並以自動化測試確保元件內不出現硬寫的色碼。",
    },
    media: [],
    links: {},
    aiDisclosure: { used: true, description: "AI 協助程式開發與文件整理，設計決策由人工判斷。" },
  },
  {
    id: "ai-website-workshop",
    slug: "ai-website-workshop",
    title: "AI Website Workshop",
    kicker: "Agent + Website Engine",
    summary:
      "AI Agent 不生成網站程式碼，而是生成與修改結構化的 SiteConfig，再由 Website Engine 渲染成網站。",
    projectType: "demo",
    categories: ["ai", "automation", "internal-product"],
    tags: ["Agent", "SiteConfig"],
    services: ["ai-automation", "web"],
    year: 2026,
    placeholderTone: "ink",
    // 刻意沒有 Case Study：驗證「不顯示空 Section」
    caseStudy: {},
    media: [],
    links: {},
  },
  {
    id: "dessert-brand",
    slug: "dessert-brand",
    title: "暮光甜室",
    kicker: "Brand Identity / Packaging",
    summary: "手作甜點品牌的識別與包裝概念。",
    projectType: "concept",
    categories: ["brand", "graphic"],
    tags: ["Logo", "Packaging"],
    services: ["brand-design"],
    industry: "餐飲",
    year: 2026,
    placeholderTone: "cream",
    caseStudy: {
      goal: "在不使用大量深色的前提下做出精品感，避免甜點品牌常見的「一做高級就變全黑」。",
    },
    media: [],
    links: {},
  },
  {
    id: "cafe-social-kit",
    slug: "cafe-social-kit",
    title: "小山咖啡 社群素材組",
    kicker: "Social / Advertising Creative",
    summary: "社群貼文與廣告素材的版型組合。",
    projectType: "concept",
    categories: ["social", "advertising", "content"],
    tags: ["Instagram", "Campaign"],
    services: ["content-growth"],
    industry: "餐飲",
    year: 2026,
    placeholderTone: "accent",
    caseStudy: {},
    media: [],
    links: {},
  },
  {
    id: "ops-automation",
    slug: "ops-automation",
    title: "接案流程自動化",
    kicker: "Internal Workflow / Agent",
    summary: "把重複的專案行政工作交給流程，人只處理需要判斷的部分。",
    projectType: "internal",
    categories: ["automation", "ai", "internal-product"],
    tags: ["Workflow", "Agent"],
    services: ["ai-automation"],
    year: 2026,
    placeholderTone: "ink",
    caseStudy: {
      problem: "報價、合約、交付檢查表每次都重做一遍，錯誤都發生在最無聊的環節。",
      solution: "把固定流程模板化並串起來，AI 只負責整理與草擬，決策點仍保留人工確認。",
    },
    media: [],
    links: {},
  },
];

export const DETAIL_BY_SLUG = new Map(DETAILS.map((detail) => [detail.slug, detail]));

export const ALL_DETAILS = DETAILS;
