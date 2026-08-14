import { PLACEHOLDER, type WebsiteTemplate } from "./types";

/**
 * Template V1（Spec §13）
 *
 * Spec §13 建議先做 3～6 套，並列出 Studio / Local Business / Personal /
 * Premium Brand / Product。Plan 的 4A 只列了前三套。
 *
 * ⚠️ 這裡做了四套，多的是 Product——這不是順手多做，是補一個接線缺口：
 * `config/home-goals.ts` 的「我要導入 AI」goal 對應的
 * `templateCategories` 是 `["product"]`。只做前三套的話，
 * 訪客在首頁選了那個 goal，模板區塊會是空的。
 *
 * 這正是上一班補【8】路由可達性時記下的那類問題：
 * 設定檔裡寫了一個分類，卻沒有任何東西屬於它，而沒有人在檢查這件事。
 * 4A 的測試因此包含「每個 goal 的 templateCategories 都至少有一套模板」。
 *
 * ── 內容為什麼用佔位符 ────────────────────────────────────────
 *
 * `{brand}` / `{industry}` 在套用時代換（見 index.ts 的 buildSiteConfig）。
 * 訪客改品牌名稱時，改的是一個字串，整份 SiteConfig 重新產生，
 * 而不是去 DOM 裡找哪幾個節點要換字——Spec §8.15 禁止的就是後者。
 */

const { brand, industry } = PLACEHOLDER;

const STUDIO: WebsiteTemplate = {
  id: "studio",
  name: "Studio",
  description: "作品優先的工作室版型。適合設計、顧問與企業服務。",
  category: ["web"],
  recommendedIndustries: ["設計工作室", "品牌顧問", "建築事務所", "行銷公司"],
  defaultTheme: "minimal",
  defaultAccent: "ink",
  defaultBrandName: "光合設計",
  defaultIndustry: "設計工作室",
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "editorial",
      content: {
        eyebrow: industry,
        title: "把想法，做成看得懂的樣子。",
        subtitle: `${brand}是一間從策略談起、把品牌一路做到能上線的工作室。`,
        actions: [{ label: "看看我們的作品" }],
      },
    },
    {
      id: "about",
      type: "about",
      variant: "simple",
      content: {
        title: `關於 ${brand}`,
        body: "我們不從版型開始，從問題開始。先弄清楚你要說服的是誰、他在猶豫什麼，再決定要用什麼樣子把話說出來。",
      },
    },
    {
      id: "services",
      type: "services",
      variant: "list",
      content: {
        title: "我們提供",
        items: [
          { label: "品牌識別", text: "命名、標誌、色彩與應用規範。" },
          { label: "網站設計", text: "從資訊架構到可以交付的介面。" },
          { label: "內容與影像", text: "文案、攝影與社群素材。" },
        ],
      },
    },
    {
      id: "work",
      type: "gallery",
      variant: "grid",
      content: {
        title: "近期作品",
        captions: ["餐飲品牌重塑", "醫療診所形象網站", "選物店電商改版"],
        images: [],
      },
    },
    {
      id: "process",
      type: "process",
      variant: "steps",
      content: {
        title: "怎麼進行",
        items: [
          { label: "談需求", text: "先搞清楚要解決什麼，不急著談畫面。" },
          { label: "提案", text: "方向與範圍寫清楚，含時程與費用。" },
          { label: "執行", text: "分階段交付，每一段都能看得到。" },
          { label: "交付", text: "含後續調整與素材原始檔。" },
        ],
      },
    },
    {
      id: "voices",
      type: "testimonials",
      variant: "quotes",
      content: {
        title: "合作過的人怎麼說",
        items: [
          {
            label: "林小姐／餐飲品牌",
            text: "他們問的問題比我自己想過的還多，最後出來的東西我一看就知道是我們家的。",
          },
          {
            label: "陳先生／診所",
            text: "時程抓得很準，中間要改的地方也講得清楚為什麼要改。",
          },
        ],
      },
    },
    {
      id: "cta",
      type: "cta",
      variant: "banner",
      content: {
        title: "有一個還沒開始的專案？",
        subtitle: "先聊聊現在卡在哪，不一定要馬上決定做什麼。",
        actions: [{ label: "聊聊你的需求" }],
      },
    },
    {
      id: "footer",
      type: "footer",
      variant: "simple",
      content: { text: `© ${brand}｜${industry}` },
    },
  ],
};

const LOCAL_BUSINESS: WebsiteTemplate = {
  id: "local-business",
  name: "Local Business",
  description: "以來店資訊為主的版型。適合餐飲、美容、咖啡店與工作室。",
  category: ["web"],
  recommendedIndustries: ["咖啡店", "餐廳", "美容沙龍", "瑜珈教室"],
  defaultTheme: "warm",
  defaultAccent: "clay",
  defaultBrandName: "晴日咖啡",
  defaultIndustry: "咖啡店",
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "centered",
      content: {
        eyebrow: industry,
        title: "今天也為你留了位子。",
        subtitle: `${brand}每天現烘，從早上七點開到晚上九點。`,
        actions: [{ label: "查看今日供應" }],
      },
    },
    {
      id: "about",
      type: "about",
      variant: "simple",
      content: {
        title: "我們在做的事",
        body: "一間店能待多久，看的不是裝潢，是回來的人多不多。所以我們把力氣放在每天都會被喝到的那一杯上。",
      },
    },
    {
      id: "menu",
      type: "services",
      variant: "list",
      content: {
        title: "供應",
        items: [
          { label: "手沖單品", text: "每週更換三支產區豆。" },
          { label: "義式與拿鐵", text: "自家配方，可調整濃度。" },
          { label: "當日甜點", text: "早上出爐，賣完為止。" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      variant: "list",
      content: {
        title: "常見問題",
        items: [
          { label: "可以帶寵物嗎？", text: "戶外座位可以，室內因為有廚房作業區所以不行。" },
          { label: "有內用時間限制嗎？", text: "平日沒有；假日客滿時會請你留意一下後面排隊的人。" },
          { label: "可以久坐工作嗎？", text: "可以，有插座的位子在靠窗那一排。" },
        ],
      },
    },
    {
      id: "team",
      type: "team",
      variant: "grid",
      content: {
        title: "店裡的人",
        items: [
          { label: "阿哲", text: "烘豆與手沖，開店就在了。" },
          { label: "小雨", text: "甜點，每天早上四點進廚房。" },
        ],
      },
    },
    {
      id: "contact",
      type: "contact",
      variant: "simple",
      content: {
        title: "怎麼找到我們",
        items: [
          { label: "地址", text: "台北市大安區和平東路二段 100 號" },
          { label: "營業時間", text: "每日 07:00–21:00，週二公休" },
          { label: "電話", text: "02-2700-0000" },
          { label: "座位", text: "28 席，可接受 6 人以內訂位" },
        ],
      },
    },
    {
      id: "map",
      type: "embed",
      variant: "map",
      content: {
        title: "在這裡",
        query: "台北市大安區和平東路二段 100 號",
      },
    },
    {
      id: "cta",
      type: "cta",
      variant: "banner",
      content: {
        title: "要不要先訂個位子？",
        subtitle: "假日建議提前一天。",
        actions: [{ label: "我要訂位" }],
      },
    },
    {
      id: "footer",
      type: "footer",
      variant: "simple",
      content: { text: `© ${brand}｜${industry}` },
    },
  ],
};

const PERSONAL: WebsiteTemplate = {
  id: "personal",
  name: "Personal",
  description: "留白多、作品說話的個人版型。適合創作者、攝影師與獨立顧問。",
  category: ["web"],
  recommendedIndustries: ["攝影師", "插畫家", "自由接案", "獨立顧問"],
  defaultTheme: "luxury",
  defaultAccent: "plum",
  defaultBrandName: "陳亦芝",
  defaultIndustry: "攝影師",
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "minimal",
      content: {
        title: brand,
        subtitle: `${industry}．長期拍攝人與空間之間的關係。`,
      },
    },
    {
      id: "about",
      type: "about",
      variant: "simple",
      content: {
        title: "簡介",
        body: "接案十年，拍過的多半是不擅長被拍的人。我的工作是讓他們在鏡頭前忘記鏡頭。",
      },
    },
    {
      id: "work",
      type: "gallery",
      variant: "grid",
      content: {
        title: "作品選輯",
        captions: ["人像・2025", "空間・2024", "紀實・2023"],
        images: [],
      },
    },
    {
      id: "contact",
      type: "contact",
      variant: "simple",
      content: {
        title: "合作與聯繫",
        items: [
          { label: "接案類型", text: "人像、空間、活動紀錄" },
          { label: "檔期", text: "通常需要提前三週" },
          { label: "地區", text: "台北為主，其他縣市可談" },
        ],
      },
    },
    {
      id: "footer",
      type: "footer",
      variant: "simple",
      content: { text: `© ${brand}` },
    },
  ],
};

const PRODUCT: WebsiteTemplate = {
  id: "product",
  name: "Product",
  description: "說清楚一個產品在解什麼問題的版型。適合 SaaS 與新產品上線。",
  // 同時屬於 web：SaaS 的 Landing Page 本來就是網站。
  // 這讓「我要一個網站」看得到四套，「我要導入 AI」收斂到這一套。
  category: ["product", "web"],
  recommendedIndustries: ["SaaS", "軟體服務", "AI 工具", "內部系統"],
  defaultTheme: "minimal",
  defaultAccent: "moss",
  defaultBrandName: "Tallyflow",
  defaultIndustry: "團隊記帳工具",
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "centered",
      content: {
        eyebrow: industry,
        title: "把每個月的對帳，縮成一次確認。",
        subtitle: `${brand} 自動比對收據與帳戶明細，剩下真正需要判斷的部分才交給你。`,
        actions: [{ label: "免費試用 14 天" }, { label: "看實際畫面" }],
      },
    },
    {
      id: "features",
      type: "features",
      variant: "list",
      content: {
        title: `為什麼團隊會換到 ${brand}`,
        items: [
          { label: "自動對帳", text: "收據上傳後自動配對，剩下例外才提醒。" },
          { label: "權限分明", text: "誰能看報表、誰只能送單，一開始就分清楚。" },
          { label: "匯出即用", text: "會計要的格式直接產出，不用再整理一次。" },
        ],
      },
    },
    {
      id: "screens",
      type: "gallery",
      variant: "grid",
      content: {
        title: "實際畫面",
        captions: ["月結總覽", "例外清單", "匯出設定"],
        images: [],
      },
    },
    {
      id: "stats",
      type: "stats",
      variant: "row",
      content: {
        // label 是數字、text 是它在算什麼——理由見 sections/proof.tsx
        items: [
          { label: "3,200+", text: "使用中的團隊" },
          { label: "92%", text: "自動配對成功率" },
          { label: "4 分鐘", text: "平均月結時間" },
          { label: "99.9%", text: "近一年服務可用率" },
        ],
      },
    },
    {
      id: "pricing",
      type: "pricing",
      variant: "tiers",
      content: {
        title: "方案",
        items: [
          { label: "入門", text: "5 人以內，基本對帳與匯出。" },
          { label: "團隊", text: "不限人數，加上權限分組與稽核紀錄。" },
          { label: "企業", text: "單一登入、專屬窗口、客製匯出格式。" },
        ],
      },
    },
    {
      id: "trial",
      type: "form",
      variant: "simple",
      content: {
        title: "留個信箱，我們開通試用",
        body: "不需要信用卡，隨時可以把資料匯出帶走。",
        items: [
          { label: "公司名稱", text: "例：晴日有限公司" },
          { label: "聯絡信箱", text: "你收得到信的那個" },
          { label: "團隊人數", text: "大概就好" },
        ],
        submitLabel: "開始試用",
      },
    },
    {
      id: "cta",
      type: "cta",
      variant: "banner",
      content: {
        title: "先用一個月看看？",
        subtitle: "不需要信用卡，隨時可以把資料匯出帶走。",
        actions: [{ label: "開始試用" }],
      },
    },
    {
      id: "footer",
      type: "footer",
      variant: "simple",
      content: { text: `© ${brand}｜${industry}` },
    },
  ],
};

/** 順序即首頁模板清單的預設順序 */
export const TEMPLATE_DEFINITIONS: readonly WebsiteTemplate[] = [
  STUDIO,
  LOCAL_BUSINESS,
  PERSONAL,
  PRODUCT,
];
