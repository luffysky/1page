import type { Metadata, Viewport } from "next";

import { BRAND_COLORS } from "@/config/brand-colors";
import { SITE_URL } from "@/config/site";

import { fontBody, fontDisplay } from "@/styles/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "一頁起家｜AI 輔助數位工作室",
  description: "網站、品牌、內容、設計與 AI 自動化。從想法、設計到真正可以使用的產品。",
  metadataBase: new URL(SITE_URL),
  // iOS 不讀 manifest 的部分設定，需要各自宣告
  appleWebApp: { capable: true, title: "一頁起家", statusBarStyle: "default" },
};

/**
 * viewport 與 manifest 分開宣告（Next 的 Metadata API 要求）。
 *
 * themeColor 取 tokens.css 的 --color-brand-bg：安裝後的狀態列與
 * 網站底色一致，開起來才不會有一條突兀的色帶。
 */
export const viewport: Viewport = {
  themeColor: BRAND_COLORS.bg,
  width: "device-width",
  initialScale: 1,
  // 不鎖縮放：鎖住會讓視力不佳的使用者無法放大（Spec §35）
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${fontBody.variable} ${fontDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}
