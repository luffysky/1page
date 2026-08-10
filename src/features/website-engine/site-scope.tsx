import type { CSSProperties } from "react";

import type { ThemeConfig } from "./schema";
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

  return (
    <div
      {...{ [SITE_SCOPE_ATTRIBUTE]: "" }}
      style={vars as CSSProperties}
      className={className}
      // 被預覽的網站有自己的語系設定，不繼承官網的 zh-Hant
      lang={undefined}
    >
      {children}
    </div>
  );
}
