import type { CSSProperties } from "react";

import type { ThemeConfig } from "./schema";
import { site } from "./site-classes";
import { themeToCssVars } from "./theme";
import { SITE_SCOPE_ATTRIBUTE } from "./types";

/**
 * Preview 的樣式作用域容器（Plan §3）。
 *
 * 1C 就先把這個容器放進 TemplateExperienceShell（當時是空殼），
 * 3B 才真正注入主題。當初刻意先放容器的理由就是這個——
 * 若等到現在才想「主題要注入到哪裡」，很容易順手寫進 `:root`。
 *
 * ⚠️ 這是全站唯一允許把主題變數寫成 inline style 的地方。
 *
 * 為什麼是 inline style 而不是 <style> 標籤或 CSS class：
 *   - inline style 天然 scoped 到這個元素與其子孫，不需要選擇器
 *   - <style> 需要產生唯一選擇器，而選擇器字串本身又成為新的注入面
 *   - class 表達不了執行期才決定的任意色值
 *
 * 值的安全性由兩層把關：3A 的 schema（進入系統時）
 * 與 theme.ts 的 isSafeCssValue（離開系統時）。
 */
export function SiteScope({
  theme,
  className,
  children,
}: {
  theme: ThemeConfig;
  className?: string;
  children: React.ReactNode;
}) {
  const vars = themeToCssVars(theme);

  /*
   * scope 容器同時是被預覽網站的「文件根」，因此要負責基底樣式。
   *
   * 沒有這一行的話，任何沒有明確掛上 site.body 的元素都會**繼承官網的字體**——
   * 4A 實測到的就是這個：標題用了主題的 Georgia，按鈕文字卻還是官網的 Inter。
   * 一份預覽混著兩套字，看起來只是「怪怪的」，很難指出哪裡不對。
   *
   * 放在 className 之前，呼叫端仍可覆寫。
   *
   * ── @container ────────────────────────────────────────────────
   *
   * Section 元件的斷點一律是 container query（`@3xl:` 而非 `md:`），
   * 而這裡是那些查詢的參照容器。
   *
   * 為什麼不用視窗斷點：Preview 是頁面裡的一塊，不是整個視窗。
   * 用 `md:` 的話，在 1440px 的螢幕上把預覽切成「手機」，
   * 裡面的排版仍然是三欄——因為視窗還是 1440px。
   * 那就變成 Spec §45.1 那種「看起來有切換、其實沒有」的假功能。
   *
   * 容器查詢讓 4C 的裝置切換只需要改容器寬度，內容自己會反應。
   */
  const base = `@container ${site.bg} ${site.text} ${site.body}`;

  return (
    <div
      {...{ [SITE_SCOPE_ATTRIBUTE]: "" }}
      style={vars as CSSProperties}
      className={className ? `${base} ${className}` : base}
      // 被預覽的網站有自己的語系設定，不繼承官網的 zh-Hant
      lang={undefined}
    >
      {children}
    </div>
  );
}
