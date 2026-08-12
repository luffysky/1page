import type { SiteSection } from "../schema";
import { site } from "../site-classes";

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

/**
 * 行動按鈕。
 *
 * ⚠️ 沒有 href 時渲染成 `<span>`，而不是 `<a href="#">`。
 *
 * 原本的寫法是 `href={action.href ?? "#"}`。那在螢幕閱讀器上是一個
 * 「可以按、按了什麼都不會發生」的連結——比沒有連結更糟，因為它承諾了一個動作。
 * 在首頁的 Template Preview 裡還多一個問題：`#` 會把整個官網頁面捲回最上面，
 * 訪客只是想看看按鈕長什麼樣子，結果畫面跳走了。
 *
 * 模板（Phase 4）的預設內容因此一律不帶 href——那些按鈕是**版面示意**。
 * 真正要連去哪裡是 Agent（Phase 6）與 Project Builder（Phase 7）決定的事。
 */
export function ActionButton({ action }: { action: LinkItem }) {
  const className = `${site.accentBg} ${site.onAccent} ${site.radius} inline-flex px-6 py-3 font-bold`;

  if (!action.href) {
    return <span className={className}>{action.label}</span>;
  }

  return (
    <a href={action.href} className={className}>
      {action.label}
    </a>
  );
}
