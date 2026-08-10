import type { Metadata } from "next";

import { fontBody, fontDisplay } from "@/styles/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "一頁起家｜AI 輔助數位工作室",
  description: "網站、品牌、內容、設計與 AI 自動化。從想法、設計到真正可以使用的產品。",
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
