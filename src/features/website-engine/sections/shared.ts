import type { SiteSection } from "../schema";

/**
 * Section 元件共用的取值輔助。
 *
 * `content` 的型別是 `Record<string, ContentValue>`——3A 已限制成一層扁平結構，
 * 但欄位是否存在、是不是字串，各 variant 不同。
 *
 * ⚠️ 這些函式一律**回傳預設值而非拋錯**。
 *
 * 理由：Spec §36 要求「非法 config 有明確錯誤而非崩潰」，而 Agent（Phase 6）
 * 會直接產生這些內容。一個少填的欄位不該讓整個 Preview 白掉——
 * 那會讓使用者以為是自己把網站弄壞了。缺欄位的正確表現是那一塊沒東西，
 * 其餘照常呈現。
 */

export type SectionProps = { section: SiteSection };

export function text(section: SiteSection, key: string, fallback = ""): string {
  const value = section.content[key];
  return typeof value === "string" ? value : fallback;
}

export function list(section: SiteSection, key: string): string[] {
  const value = section.content[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export interface LinkItem {
  label: string;
  href?: string;
  text?: string;
}

export function items(section: SiteSection, key: string): LinkItem[] {
  const value = section.content[key];
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is LinkItem =>
      typeof item === "object" && item !== null && typeof (item as LinkItem).label === "string",
  );
}
