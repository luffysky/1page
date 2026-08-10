import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * 開發工具路由 `/_dev/*`
 *
 * 資料夾名稱為 `%5Fdev` 而非 `_dev`：App Router 中以底線開頭的資料夾是
 * 「私有資料夾」，不會產生路由。Next.js 官方以 %5F 轉義來取得真正以底線
 * 開頭的 URL 區段。實際網址仍是 /_dev/tokens。
 *
 * Plan §11 C / C.1：
 *   - 非開發環境直接 404（不是把導航連結藏起來）
 *   - 不得被 sitemap 收錄（src/app/sitemap.ts）
 *   - robots.txt 明確 disallow（src/app/robots.ts）
 *   - metadata noindex, nofollow（本檔）
 *   - 不得發送任何 Spec §31 analytics 事件
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <div data-dev-route="true">{children}</div>;
}
