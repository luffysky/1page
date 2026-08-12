import type { NextConfig } from "next";

import { buildCsp, SECURITY_HEADERS } from "./src/lib/security/csp";

/*
 * CSP 走 next.config 的 headers() 而不是 proxy.ts。
 *
 * Next 的 nonce 方案要放在 proxy.ts（Next 16 已把 middleware.ts 更名為
 * proxy.ts），但用 nonce 就得讓每一頁變成動態渲染，靜態產生與 CDN 快取全失效。
 * 這份 CSP 不用 nonce，所以也不需要那一層——理由寫在 src/lib/security/csp.ts。
 */
const isDev = process.env.NODE_ENV === "development";

const csp = buildCsp(
  {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    r2DomainUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL,
    r2PublicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
    analyticsEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
  },
  isDev,
);

const nextConfig: NextConfig = {
  // Phase 1 尚未引入外部圖片來源。Phase 2 接 Supabase Storage 時再設定 remotePatterns。
  reactStrictMode: true,

  // 僅影響開發環境：Playwright 以 127.0.0.1 存取 dev server，Next 16 預設視為
  // 跨來源而以 403 擋下 dev 資產與 HMR，導致頁面 SSR 正常但完全不會 hydrate
  // ——截圖看起來毫無異狀，按鈕卻是死的。不加這行，所有瀏覽器互動測試都會假失敗。
  allowedDevOrigins: ["127.0.0.1"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: csp }, ...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
