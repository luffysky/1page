import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 1 尚未引入外部圖片來源。Phase 2 接 Supabase Storage 時再設定 remotePatterns。
  reactStrictMode: true,

  // 僅影響開發環境：Playwright 以 127.0.0.1 存取 dev server，Next 16 預設視為
  // 跨來源而以 403 擋下 dev 資產與 HMR，導致頁面 SSR 正常但完全不會 hydrate
  // ——截圖看起來毫無異狀，按鈕卻是死的。不加這行，所有瀏覽器互動測試都會假失敗。
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
