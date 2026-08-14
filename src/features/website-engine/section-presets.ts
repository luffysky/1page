import { implementedSectionTypes, variantsFor } from "./registry";
import type { SiteSection, SiteSectionType } from "./schema";

/**
 * 新增區塊時的預設內容（CR-003-4 第二段）
 *
 * ── 為什麼要有這一份 ──────────────────────────────────────────
 *
 * 沒有預設內容的話，「新增常見問題」加出來的是一塊**空白**——
 * 使用者按了按鈕、畫面多了一段看不出是什麼的東西，
 * 他會以為功能壞了。有預設文字他才看得懂那是什麼、也才知道要改哪裡。
 *
 * 這些字刻意寫成「明顯是範例、但看得出結構」：
 * 不是 Lorem ipsum（看不出這塊在幹嘛），也不是像真的內容
 * （會有人直接留著它上線）。
 *
 * ⚠️ 這份表的鍵必須跟得上 SECTION_REGISTRY。少一個的後果是
 * 那種區塊加出來是空的——section-presets.test.ts 盯著這件事。
 */

type Preset = { variant: string; content: SiteSection["content"] };

const PRESETS: Partial<Record<SiteSectionType, Preset>> = {
  hero: {
    variant: "centered",
    content: {
      eyebrow: "一句話說明你是誰",
      title: "把這裡換成你想讓人記住的那句話",
      subtitle: "底下這行寫你在做什麼、幫誰解決什麼問題。",
      actions: [{ label: "主要行動" }],
    },
  },
  about: {
    variant: "simple",
    content: { title: "關於我們", body: "這裡寫你的故事：為什麼開始做這件事，跟別人有什麼不同。" },
  },
  services: {
    variant: "list",
    content: {
      title: "服務",
      items: [
        { label: "服務一", text: "一句話說明這項服務在解決什麼。" },
        { label: "服務二", text: "一句話說明這項服務在解決什麼。" },
        { label: "服務三", text: "一句話說明這項服務在解決什麼。" },
      ],
    },
  },
  features: {
    variant: "list",
    content: {
      title: "特色",
      items: [
        { label: "特色一", text: "這一點為什麼對客戶重要。" },
        { label: "特色二", text: "這一點為什麼對客戶重要。" },
      ],
    },
  },
  gallery: {
    variant: "grid",
    content: { title: "作品", captions: ["作品一", "作品二", "作品三"], images: [] },
  },
  portfolio: {
    variant: "grid",
    content: { title: "作品集", captions: ["案例一", "案例二", "案例三"], images: [] },
  },
  pricing: {
    variant: "tiers",
    content: {
      title: "方案",
      items: [
        { label: "基本", text: "適合剛開始的人。" },
        { label: "進階", text: "適合需要更多的人。" },
        { label: "客製", text: "有特殊需求再談。" },
      ],
    },
  },
  testimonials: {
    variant: "quotes",
    content: {
      title: "客戶怎麼說",
      items: [
        { label: "客戶名字／身分", text: "把客戶真的說過的話放這裡。" },
        { label: "客戶名字／身分", text: "把客戶真的說過的話放這裡。" },
      ],
    },
  },
  faq: {
    variant: "list",
    content: {
      title: "常見問題",
      items: [
        { label: "第一個常被問到的問題？", text: "在這裡回答它。" },
        { label: "第二個常被問到的問題？", text: "在這裡回答它。" },
      ],
    },
  },
  process: {
    variant: "steps",
    content: {
      title: "怎麼進行",
      items: [
        { label: "第一步", text: "這一步會發生什麼。" },
        { label: "第二步", text: "這一步會發生什麼。" },
        { label: "第三步", text: "這一步會發生什麼。" },
      ],
    },
  },
  stats: {
    variant: "row",
    content: {
      // label 是數字、text 是它在算什麼——見 sections/proof.tsx
      items: [
        { label: "100+", text: "換成你的數字" },
        { label: "5 年", text: "換成你的數字" },
        { label: "98%", text: "換成你的數字" },
      ],
    },
  },
  team: {
    variant: "grid",
    content: {
      title: "團隊",
      items: [
        { label: "成員名字", text: "職稱或一句話介紹。" },
        { label: "成員名字", text: "職稱或一句話介紹。" },
      ],
    },
  },
  form: {
    variant: "simple",
    content: {
      title: "聯絡我們",
      body: "留下資料，我們會回覆你。",
      items: [
        { label: "姓名", text: "怎麼稱呼你" },
        { label: "聯絡方式", text: "Email 或電話" },
        { label: "想問什麼", text: "簡單描述就好" },
      ],
      submitLabel: "送出",
    },
  },
  embed: {
    variant: "map",
    content: { title: "在這裡", query: "台北101" },
  },
  cta: {
    variant: "banner",
    content: {
      title: "準備好了嗎？",
      subtitle: "把這句話換成你想讓人採取的下一步。",
      actions: [{ label: "聯絡我們" }],
    },
  },
  contact: {
    variant: "simple",
    content: {
      title: "聯絡方式",
      items: [
        { label: "地址", text: "你的地址" },
        { label: "營業時間", text: "你的營業時間" },
        { label: "電話", text: "你的電話" },
      ],
    },
  },
  footer: {
    variant: "simple",
    content: { text: "© 你的品牌" },
  },
};

/** 區塊型別的中文名。工具列、新增選單與螢幕閱讀器共用同一份 */
export const SECTION_LABELS: Record<string, string> = {
  hero: "主視覺",
  about: "關於",
  services: "服務",
  features: "特色",
  gallery: "作品",
  portfolio: "作品集",
  pricing: "方案",
  testimonials: "見證",
  faq: "常見問題",
  process: "流程",
  stats: "數字",
  team: "團隊",
  form: "表單",
  embed: "地圖／影片",
  cta: "行動呼籲",
  contact: "聯絡",
  footer: "頁尾",
};

/** 可以新增的區塊。只列真的有元件的，順序照 registry */
export function addableSectionTypes(): SiteSectionType[] {
  return implementedSectionTypes();
}

/**
 * 產生一個不與現有 id 衝突的區塊。
 *
 * id 只能是小寫英數與連字號（schema 規定），所以用型別名加流水號。
 * 衝突會讓 addSection 直接拒絕，而使用者只會看到「按了沒反應」。
 */
export function newSection(type: SiteSectionType, existingIds: readonly string[]): SiteSection {
  const preset = PRESETS[type];
  const variants = variantsFor(type);

  let id = type as string;
  let counter = 2;
  while (existingIds.includes(id)) {
    id = `${type}-${counter}`;
    counter += 1;
  }

  return {
    id,
    type,
    // 沒有 preset 也要給一個合法的 variant，否則會退化成 registry 的預設
    variant: preset?.variant ?? variants[0] ?? "simple",
    content: preset?.content ?? {},
  };
}
