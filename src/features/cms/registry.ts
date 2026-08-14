import { z } from "zod";

import { FAQ_ENTRIES } from "@/config/faq";
import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";

/**
 * CMS 文件登記處（CR-004 / Phase B BH）
 *
 * ── 這份 registry 就是「每個 key 都有讀取端」的保證 ───────────
 *
 * 一個 key 要存在，必須在這裡登記；而登記需要一個 zod schema，
 * 而 schema 的唯一用途是給讀取端解析。**沒有讀取端就寫不出 schema**。
 *
 * 反過來的方向由 `registry.test.ts` 顧：資料庫裡有沒有哪個 key
 * 不在這份 registry 裡（那種列永遠不會被任何人讀到）。
 *
 * ⚠️ 這與「任意頁面產生器」是完全不同的東西。CMS 管的是
 * **既有頁面上的既有欄位**，不是讓人憑空長出一條路由——
 * 那條路會直接撞上 Spec §40 的「完整 CMS 平台」，而且新路由
 * 沒有對應的元件就只是一個 404。
 *
 * ── fallback 不是「備案」，是同一份種子 ───────────────────────
 *
 * 每個 key 的 fallback 就是它原本寫死在 `config/*.ts` 的那份內容。
 * 資料庫沒有那一列時，網站的行為與搬進 CMS 之前**完全一樣**。
 *
 * 這讓這次改動可以無痛上線：先部署程式碼（行為不變），
 * 之後在後台按存檔，內容才真的開始由資料庫供應。
 */

/* ------------------------------------------------------------------ */
/* 各 key 的內容形狀                                                    */
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

/* ------------------------------------------------------------------ */
/* 登記處                                                              */
/* ------------------------------------------------------------------ */

export interface CmsDocumentDefinition<T> {
  /** 後台清單上顯示的名字 */
  label: string;
  /** 一句話說明改了它會影響哪裡。少了這句，下一個人不敢改 */
  affects: string;
  schema: z.ZodType<T>;
  /** 資料庫沒有這一列時用的內容，也就是原本寫死在 config 的那份 */
  fallback: T;
}

export const CMS_DOCUMENTS = {
  "faq.list": {
    label: "常見問題",
    affects: "首頁的常見問題區塊，以及 AI 顧問的 search_faq 工具",
    schema: faqSchema,
    fallback: {
      entries: FAQ_ENTRIES.map((entry) => ({ ...entry, keywords: [...entry.keywords] })),
    },
  } satisfies CmsDocumentDefinition<FaqDocument>,

  "pricing.tiers": {
    label: "價格階梯",
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
