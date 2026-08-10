import { Inter, Noto_Serif_TC } from "next/font/google";

/**
 * 字型策略（Implementation Plan §4「字型實作」/ 裁決 A）
 *
 *   宋體  僅限 Editorial Heading（H1 / H2 / 大型引言）
 *   黑體  內文、導航、按鈕、表單、價格、Agent 對話等所有功能性文字
 *
 * ⚠️ Phase 1 頭號效能風險：中文襯線字型體積龐大，且正好落在 LCP 元素（H1）上。
 *
 * 緩解方式：
 *   1. 只載入單一字重（700），不整套字族塞進來
 *   2. 刻意「不指定 subsets」。Google Fonts 對 Noto Serif TC 只提供
 *      cyrillic / latin / latin-ext / vietnamese 四個具名 subset——中文字元
 *      並不在具名 subset 內，而是以 unicode-range 分片提供。
 *      若寫成 subsets: ["latin"]，next/font 只會自託管拉丁分片，
 *      中文標題會整批掉回 fallback，等於這個字型決策白做。
 *      省略 subsets 才會拿到完整的 unicode-range 分片組。
 *   3. preload: false ─ 不預載任何分片（省略 subsets 時亦為必要條件）。
 *      瀏覽器只會抓標題實際用到的那幾片；若開啟 preload，等同把整套
 *      中文字型拖進首屏，LCP 必炸。
 *   4. display: "swap" ─ 字型未到時先以 fallback 顯示，不阻塞渲染
 *   5. fallback 堆疊在 tokens.css 的 --font-display 明確列出
 */
export const fontDisplay = Noto_Serif_TC({
  weight: ["700"],
  display: "swap",
  preload: false,
  variable: "--font-brand-serif",
});

/**
 * 拉丁字母與數字使用 Inter（Latin subset，體積可接受，可預載）。
 * 中文內文則交給 tokens.css --font-sans 中的系統字體堆疊，零下載。
 */
export const fontBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand-inter",
});
