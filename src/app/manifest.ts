import type { MetadataRoute } from "next";

import { BRAND_COLORS } from "@/config/brand-colors";

/**
 * PWA Manifest。
 *
 * 這個站是作品集與銷售頁，不是需要離線使用的工具。因此 PWA 的目標是
 * 「可安裝、開起來像 app」，而不是「離線可用」——
 * 為一個內容會變動的行銷網站做離線快取，只會讓訪客看到過期的作品集。
 *
 * `display: minimal-ui` 而非 `standalone`：保留網址列，
 * 讓使用者看得到自己在哪個站。對一個要建立信任的接案網站，
 * 藏起網址列的代價大於「看起來像 app」的收益。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "一頁起家｜AI 輔助數位工作室",
    short_name: "一頁起家",
    description: "網站、品牌、內容、設計與 AI 自動化。從想法、設計到真正可以使用的產品。",
    start_url: "/",
    display: "minimal-ui",
    background_color: BRAND_COLORS.bg,
    theme_color: BRAND_COLORS.bg,
    lang: "zh-Hant",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
