import type { SiteSection } from "../schema";

import type { AccentId, ThemeId } from "./themes";

/**
 * Template Engine 型別（Spec §12）
 *
 * Spec §12 定義 Template 由這五者組成：
 *   Layout + Section Composition + Section Variants + Theme + Default Content Schema
 *
 * 對應到這裡：
 *   Layout / Section Composition   sections 的順序與 type
 *   Section Variants               每個 section 的 variant
 *   Theme                          defaultTheme（指向 themes.ts 的預設集）
 *   Default Content Schema         每個 section 的 content
 *
 * ⚠️ 全部是資料，不是元件。
 *
 * 4A 出口條件寫的「不是硬寫的頁面」指的就是這件事：
 * 若模板是一個 React 元件，Agent（Phase 6）就只能整個換掉，
 * 無法「把 hero 換個排法」或「改一句標題」——那才是 Spec §44
 * 「Agent 不生成程式碼，只操作結構化 SiteConfig」真正的意思。
 */

/**
 * 模板的 section 定義。
 *
 * 結構與 `SiteSection` 完全相同，是刻意的：
 * 模板就是一份「填好預設內容的 sections 陣列」，套用時不需要任何形狀轉換。
 * 唯一的差別是 content 裡可能含有下方的佔位符。
 */
export type TemplateSectionConfig = SiteSection;

/**
 * 預設內容中的佔位符。
 *
 * 套用模板時由 `buildSiteConfig` 代換。用 `{}` 而不是 `${}`：
 * 後者在 TypeScript 原始碼裡看起來像 template literal，
 * 容易被誤以為是程式碼漏了跳脫。
 */
export const PLACEHOLDER = {
  brand: "{brand}",
  industry: "{industry}",
} as const;

export interface WebsiteTemplate {
  id: string;
  name: string;
  /** 給訪客看的一句話說明，不是內部註解 */
  description: string;
  /** Home Goal 的 templateCategories 以此篩選（見 config/home-goals.ts） */
  category: string[];
  recommendedIndustries: string[];
  defaultTheme: ThemeId;
  defaultAccent: AccentId;
  /** 訪客尚未輸入品牌名稱時的預設值，同時也是佔位符的代換來源 */
  defaultBrandName: string;
  defaultIndustry: string;
  sections: TemplateSectionConfig[];
}
