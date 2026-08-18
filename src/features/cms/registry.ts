import { z } from "zod";

import { FAQ_ENTRIES } from "@/config/faq";
import {
  FINAL_CTA_COPY,
  HERO_COPY,
  PROCESS_STEPS,
  PLAYGROUND_COPY,
  PRICING_COPY,
  SECTION_COPY,
  START_COPY,
  WORK_COPY,
  LOGIN_COPY,
  FOOTER_COPY,
} from "@/config/home-copy";
import { HOME_GOALS } from "@/config/home-goals";
import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";
import { SERVICE_LINES } from "@/config/services";

import { defaultHomeLayout, pageLayoutSchema, type PageLayout } from "./page-layout";

/**
 * CMS 文件登記處（CR-004 / Phase B BH + BI）
 *
 * ── 這份 registry 就是「每個 key 都有讀取端」的保證 ───────────
 *
 * 一個 key 要存在，必須在這裡登記；而登記需要一個 zod schema，
 * 而 schema 的唯一用途是給讀取端解析。**沒有讀取端就寫不出 schema**。
 *
 * 反過來的方向由 `registry.test.ts` 顧：
 *   - 資料庫裡有沒有哪個 key 不在這份 registry 裡
 *   - **原始碼裡有沒有哪個 key 沒有任何人讀**（BI 加的，見該檔）
 *
 * ⚠️ 這與「任意頁面產生器」是完全不同的東西。CMS 管的是
 * **既有頁面上的既有欄位**，不是讓人憑空長出一條路由——
 * 那條路會直接撞上 Spec §40 的「完整 CMS 平台」，而且新路由
 * 沒有對應的元件就只是一個 404。
 *
 * ── 文案進來，行為留在程式碼裡 ────────────────────────────────
 *
 * 這條線在 BI 變得很重要，因為現在幾乎每個區塊都可編輯了。
 *
 * 可以改的：標題、說明、按鈕上的字、項目的名稱與描述。
 * 不能改的：goal 對應哪些作品分類、哪一條服務線要 highlight、
 * 路由、以及任何「按下去會發生什麼」。
 *
 * 理由很實際：文案改錯只是難看，行為改錯是壞掉的網站，
 * 而後台不會有人在那裡幫你 code review。
 * 所以 `home.goals` 只收 label 與 description，
 * 而 `workCategories` / `serviceId` 這些留在 `config/home-goals.ts`。
 *
 * ── fallback 不是「備案」，是同一份種子 ───────────────────────
 *
 * 每個 key 的 fallback 就是它原本寫死在 `config/*.ts` 的那份內容。
 * 資料庫沒有那一列時，網站的行為與搬進 CMS 之前**完全一樣**。
 *
 * 這讓每次改動都可以無痛上線：先部署程式碼（行為不變），
 * 之後在後台按存檔，內容才真的開始由資料庫供應。
 */

/* ------------------------------------------------------------------ */
/* 共用的欄位形狀                                                       */
/* ------------------------------------------------------------------ */

/**
 * 純文字。
 *
 * 與 SiteConfig 的 `plainText` 同樣的理由：這些字會被印在公開頁面上，
 * 而 React 雖然會逸出，但讓 `<script>` 這種形狀在驗證階段就被擋下來，
 * 比讓它變成畫面上的一串字好。
 */
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/<[a-zA-Z/!]/.test(value), "內容不得包含 HTML 標籤");

/**
 * 連結。
 *
 * ⚠️ 只收站內路徑與錨點，不收 `https://`。
 *
 * 後台可以改連結的話，最糟的情況是有人把主要 CTA 指到站外——
 * 而那與「內容編輯」是兩件事。要外連就改程式碼，那一步值得有人看過。
 */
const internalHref = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(\/[A-Za-z0-9\-._~/#?=&]*|#[A-Za-z0-9\-_]+)$/, "只能填站內路徑（/…）或錨點（#…）");

const linkSchema = z.object({
  label: plainText(40),
  href: internalHref,
});

/**
 * 一個區塊的抬頭。首頁上每一段都長這樣。
 *
 * `kicker` 是那行小字（`01 / Goals`），`lead` 可以留空——
 * 流程那一段本來就沒有 lead。
 */
const sectionSchema = z.object({
  kicker: plainText(60),
  title: plainText(200),
  lead: z.union([plainText(400), z.literal("")]),
});

export type SectionCopy = z.infer<typeof sectionSchema>;

/**
 * 空字串在 zod 這裡要明講。
 *
 * `SECTION_COPY.process` 沒有 lead，而 `plainText` 的 `.min(1)` 會擋掉
 * 未定義與空字串——所以讀進來時統一補成 `""`。
 */
const asSection = (copy: { kicker: string; title: string; lead?: string }): SectionCopy => ({
  kicker: copy.kicker,
  title: copy.title,
  lead: copy.lead ?? "",
});

/* ------------------------------------------------------------------ */
/* 各 key 的內容形狀                                                    */
/* ------------------------------------------------------------------ */

const heroSchema = z.object({
  badge: plainText(60),
  /*
   * 標題是一個陣列，不是一個字串。
   *
   * 中文沒有空格，瀏覽器缺乏詞界資訊，放任自動斷行會出現
   * 「從第一頁，開／始你的生意。」這種把詞拆開的結果。
   * 斷行是內容的一部分，所以編輯的人要能決定它。
   */
  titleLines: z.array(plainText(40)).min(1).max(4),
  lead: plainText(400),
  primaryCta: linkSchema,
  secondaryCta: linkSchema,
});

const goalsSchema = z.object({
  section: sectionSchema,
  /*
   * 只有文案。
   *
   * id 必須是程式碼裡認得的那幾個——它決定選了之後要篩哪些作品、
   * highlight 哪條服務線。那些對應留在 `config/home-goals.ts`。
   */
  items: z
    .array(
      z.object({
        id: z.enum(HOME_GOALS.map((goal) => goal.id) as [string, ...string[]]),
        label: plainText(40),
        description: plainText(200),
      }),
    )
    .max(12),
});

const servicesSchema = z.object({
  section: sectionSchema,
  lines: z
    .array(
      z.object({
        id: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-]+$/, "id 只能是小寫英數與連字號"),
        name: plainText(60),
        summary: plainText(300),
      }),
    )
    .min(1)
    .max(8),
});

const processSchema = z.object({
  section: sectionSchema,
  steps: z
    .array(
      z.object({
        step: plainText(4),
        title: plainText(40),
        summary: plainText(200),
      }),
    )
    .min(1)
    .max(8),
});

const ctaBlockSchema = z.object({
  titleLines: z.array(plainText(40)).min(1).max(4),
  lead: plainText(400),
  cta: linkSchema,
});

/** 只有抬頭的區塊（哲學那一段、以及幾個內頁的頁首） */
const introSchema = z.object({ section: sectionSchema });

const footerSchema = z.object({
  wordmark: plainText(40),
  disclosure: plainText(200),
  copyright: plainText(200),
});

const loginSchema = z.object({
  kicker: plainText(40),
  title: plainText(60),
  lead: plainText(300),
});

const faqSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "id 只能是小寫英數與連字號"),
        question: plainText(200),
        answer: plainText(2000),
        /** 給 `search_faq` 檢索用的關鍵詞，含同義說法 */
        keywords: z.array(plainText(40)).max(20),
      }),
    )
    .max(50),
});

const pricingSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.enum(["clarify", "build"]),
        label: plainText(40),
        description: plainText(200),
      }),
    )
    .max(4),
  tiers: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9-]+$/),
        name: plainText(60),
        /*
         * 價格是字串不是數字，這一點從 config/pricing.ts 就是這樣。
         * 「免費」與「專案報價」不是數字，硬做成數字就要另外加一個
         * 「要不要顯示數字」的旗標——那是兩份真相。
         */
        price: plainText(40),
        priceSuffix: plainText(20).optional(),
        summary: plainText(300),
        group: z.enum(["clarify", "build"]),
        featured: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(12),
});

export type FaqDocument = z.infer<typeof faqSchema>;
export type PricingDocument = z.infer<typeof pricingSchema>;
export type GoalsDocument = z.infer<typeof goalsSchema>;
export type ServicesDocument = z.infer<typeof servicesSchema>;
export type ProcessDocument = z.infer<typeof processSchema>;
export type HeroDocument = z.infer<typeof heroSchema>;
export type CtaBlockDocument = z.infer<typeof ctaBlockSchema>;
export type IntroDocument = z.infer<typeof introSchema>;
export type FooterDocument = z.infer<typeof footerSchema>;
export type LoginDocument = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ */
/* 登記處                                                              */
/* ------------------------------------------------------------------ */

/**
 * 後台清單的分組。
 *
 * 「我要改首頁那句話」是編輯的人真正的問法，
 * 而不是「我要改 home.hero」——所以清單照頁面分組，不是照 key 排。
 */
export const CMS_PAGES = {
  home: { label: "首頁", path: "/" },
  work: { label: "作品頁", path: "/work" },
  pricing: { label: "價格頁", path: "/pricing" },
  playground: { label: "試穿頁", path: "/playground" },
  start: { label: "開始一個專案", path: "/start" },
  login: { label: "登入頁", path: "/login" },
  shared: { label: "全站共用", path: null },
} as const;

export type CmsPage = keyof typeof CMS_PAGES;

export interface CmsDocumentDefinition<T> {
  /** 後台清單上顯示的名字 */
  label: string;
  /** 屬於哪一頁。後台照這個分組 */
  page: CmsPage;
  /** 一句話說明改了它會影響哪裡。少了這句，下一個人不敢改 */
  affects: string;
  schema: z.ZodType<T>;
  /** 資料庫沒有這一列時用的內容，也就是原本寫死在 config 的那份 */
  fallback: T;
}

export const CMS_DOCUMENTS = {
  /* ── 首頁 ──────────────────────────────────────────────── */

  "home.hero": {
    label: "首屏",
    page: "home",
    affects: "首頁最上方的大標、副標與兩顆按鈕",
    schema: heroSchema,
    fallback: {
      badge: HERO_COPY.badge,
      titleLines: [...HERO_COPY.titleLines],
      lead: HERO_COPY.lead,
      primaryCta: { ...HERO_COPY.primaryCta },
      secondaryCta: { ...HERO_COPY.secondaryCta },
    },
  } satisfies CmsDocumentDefinition<HeroDocument>,

  "home.goals": {
    label: "你今天想完成什麼",
    page: "home",
    affects: "首頁的目標選擇區塊。**只有字**——選了之後要篩哪些作品由程式碼決定",
    schema: goalsSchema,
    fallback: {
      section: asSection(SECTION_COPY.goals),
      items: HOME_GOALS.map((goal) => ({
        id: goal.id,
        label: goal.label,
        description: goal.description,
      })),
    },
  } satisfies CmsDocumentDefinition<GoalsDocument>,

  "home.work": {
    label: "精選作品（抬頭）",
    page: "home",
    affects: "首頁作品區塊的小字、標題與說明。作品本身在「作品」那一頁管",
    schema: introSchema,
    fallback: { section: asSection(SECTION_COPY.work) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "home.template": {
    label: "自己試穿（抬頭）",
    page: "home",
    affects: "首頁模板體驗區塊的抬頭",
    schema: introSchema,
    fallback: { section: asSection(SECTION_COPY.template) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "home.advisor": {
    label: "AI 顧問（抬頭）",
    page: "home",
    affects: "首頁 AI 顧問區塊的抬頭。顧問講的話由 pricing.tiers 與 faq.list 供應",
    schema: introSchema,
    fallback: { section: asSection(SECTION_COPY.advisor) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "home.philosophy": {
    label: "我們怎麼看 AI",
    page: "home",
    affects: "首頁的 AI 理念區塊（這一段只有抬頭，沒有內容）",
    schema: introSchema,
    fallback: { section: asSection(SECTION_COPY.philosophy) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "home.services": {
    label: "服務項目",
    page: "home",
    affects: "首頁的四條產品線，以及作品頁的服務篩選名稱",
    schema: servicesSchema,
    fallback: {
      section: asSection(SECTION_COPY.services),
      lines: SERVICE_LINES.map((line) => ({ ...line })),
    },
  } satisfies CmsDocumentDefinition<ServicesDocument>,

  "home.pricing": {
    label: "價格（抬頭）",
    page: "home",
    affects: "首頁價格區塊的抬頭。價格本身在「價格階梯」那一份",
    schema: introSchema,
    fallback: { section: asSection(SECTION_COPY.pricing) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "home.process": {
    label: "合作流程",
    page: "home",
    affects: "首頁流程區塊的抬頭與四個步驟",
    schema: processSchema,
    fallback: {
      section: asSection(SECTION_COPY.process),
      steps: PROCESS_STEPS.map((step) => ({ ...step })),
    },
  } satisfies CmsDocumentDefinition<ProcessDocument>,

  "home.final-cta": {
    label: "最後那一段",
    page: "home",
    affects: "首頁與作品頁最下方的深色行動區塊",
    schema: ctaBlockSchema,
    fallback: {
      titleLines: [...FINAL_CTA_COPY.titleLines],
      lead: FINAL_CTA_COPY.lead,
      cta: { ...FINAL_CTA_COPY.cta },
    },
  } satisfies CmsDocumentDefinition<CtaBlockDocument>,

  /*
   * 版面。
   *
   * ⚠️ 與其他文件不同，這一份不是「字」，是**順序、開關與背景**。
   * 它在後台有自己的介面（拖曳），不走那個照形狀長出來的表單——
   * 一個 JSON 陣列的順序沒有人排得動。
   */
  "home.layout": {
    label: "首頁版面",
    page: "home",
    affects: "首頁每一段的順序、要不要顯示、以及各自的背景",
    schema: pageLayoutSchema,
    fallback: defaultHomeLayout(),
  } satisfies CmsDocumentDefinition<PageLayout>,

  /* ── 其他頁 ────────────────────────────────────────────── */

  "pricing.intro": {
    label: "價格頁頁首",
    page: "pricing",
    affects: "/pricing 最上方的小字、標題與說明。價格本身在「價格階梯」那一份",
    schema: introSchema,
    fallback: { section: asSection(PRICING_COPY) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "playground.intro": {
    label: "試穿頁頁首",
    page: "playground",
    affects: "/playground 最上方的小字、標題與說明",
    schema: introSchema,
    fallback: { section: asSection(PLAYGROUND_COPY) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "work.intro": {
    label: "作品頁頁首",
    page: "work",
    affects: "/work 最上方的小字、標題與說明",
    schema: introSchema,
    fallback: { section: asSection(WORK_COPY) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "start.intro": {
    label: "需求表單頁首",
    page: "start",
    affects: "/start 最上方的小字、標題與說明",
    schema: introSchema,
    fallback: { section: asSection(START_COPY) },
  } satisfies CmsDocumentDefinition<IntroDocument>,

  "login.intro": {
    label: "登入頁文案",
    page: "login",
    affects: "/login 的標題與說明",
    schema: loginSchema,
    fallback: { ...LOGIN_COPY },
  } satisfies CmsDocumentDefinition<LoginDocument>,

  /* ── 全站共用 ──────────────────────────────────────────── */

  "shared.footer": {
    label: "頁尾",
    page: "shared",
    affects: "每一頁最下方的字號、AI 揭露與版權宣告",
    schema: footerSchema,
    fallback: { ...FOOTER_COPY },
  } satisfies CmsDocumentDefinition<FooterDocument>,

  /*
   * ⚠️ 下面這兩份的 key 前綴是「內容」不是「頁面」，與上面不同。
   *
   * 那是刻意的：它們不屬於任何一頁。價格同時出現在首頁、Workshop Gate
   * 與 **AI 顧問的系統提示**；FAQ 同時餵首頁與 `search_faq`。
   * 硬塞進某一頁的分組，改的人會以為只影響那一頁。
   */
  "faq.list": {
    label: "常見問題",
    page: "shared",
    affects: "AI 顧問的 search_faq 工具（以及之後任何顯示 FAQ 的地方）",
    schema: faqSchema,
    fallback: {
      entries: FAQ_ENTRIES.map((entry) => ({ ...entry, keywords: [...entry.keywords] })),
    },
  } satisfies CmsDocumentDefinition<FaqDocument>,

  "pricing.tiers": {
    label: "價格階梯",
    page: "shared",
    affects: "首頁的價格區塊、Workshop Gate、以及 **AI 顧問的系統提示**",
    schema: pricingSchema,
    fallback: {
      groups: PRICING_GROUPS.map((group) => ({ ...group })),
      tiers: PRICING_TIERS.map((tier) => ({ ...tier })),
    },
  } satisfies CmsDocumentDefinition<PricingDocument>,
} as const;

export type CmsKey = keyof typeof CMS_DOCUMENTS;

export const CMS_KEYS = Object.keys(CMS_DOCUMENTS) as CmsKey[];

export function isCmsKey(value: unknown): value is CmsKey {
  return typeof value === "string" && (CMS_KEYS as string[]).includes(value);
}

/** 後台清單用：照頁面分組，順序照 CMS_PAGES */
export function cmsKeysByPage(): { page: CmsPage; keys: CmsKey[] }[] {
  return (Object.keys(CMS_PAGES) as CmsPage[]).map((page) => ({
    page,
    keys: CMS_KEYS.filter((key) => CMS_DOCUMENTS[key].page === page),
  }));
}

/* ------------------------------------------------------------------ */
/* 欄位名稱的中文                                                       */
/* ------------------------------------------------------------------ */

/**
 * 後台的表單照著內容的形狀長出來，欄位名就是 JSON 的鍵。
 *
 * `kicker` 對編輯的人沒有意義，所以這裡給它一個中文名。
 * **查不到就顯示原本的鍵**——那仍然是可用的，只是不好看。
 *
 * ⚠️ 這份對照表刻意不是必填。做成必填的話它就變成第二份 schema，
 * 而第二份 schema 遲早與 zod 那份分歧——分歧的表現是
 * 「表單上有的欄位存不進去」。查不到就退回原鍵，不會有那種洞。
 */
export const CMS_FIELD_LABELS: Record<string, string> = {
  section: "區塊抬頭",
  kicker: "小字",
  title: "標題",
  titleLines: "標題（一行一句，斷行位置自己決定）",
  lead: "說明",
  badge: "徽章",
  label: "名稱",
  href: "連結",
  cta: "按鈕",
  primaryCta: "主要按鈕",
  secondaryCta: "次要按鈕",
  items: "項目",
  lines: "產品線",
  steps: "步驟",
  step: "編號",
  summary: "說明",
  entries: "問答",
  question: "問題",
  answer: "回答",
  keywords: "關鍵詞",
  groups: "分組",
  tiers: "方案",
  name: "名稱",
  price: "價格",
  priceSuffix: "價格後綴",
  group: "所屬分組",
  featured: "強調顯示",
  description: "描述",
  wordmark: "字號",
  disclosure: "AI 揭露",
  copyright: "版權宣告",
  id: "識別碼（不要改）",
};
