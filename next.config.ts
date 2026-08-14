import type { NextConfig } from "next";

import { buildCsp, SECURITY_HEADERS } from "./src/lib/security/csp";
import { allowedImageHosts } from "./src/config/image-sources";

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
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2Bucket: process.env.R2_BUCKET,
  },
  isDev,
);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /*
   * next/image 的遠端來源白名單。
   *
   * ⚠️ 這一段以前不存在，註解寫著「Phase 2 接儲存時再設定」——然後 Phase 2
   * 接了 R2、portfolio-layout 也真的用 `<Image src={cover.url}>` 了，
   * 這裡卻沒有補上。沒爆是因為 portfolio_media 一筆資料都沒有：
   * 上傳第一張封面的那一刻 /work 會直接 500，而看起來會像上傳壞掉。
   *
   * 網域一律從 `allowedImageHosts()` 來，不在這裡再抄一次字串——
   * 抄一次就是第二份真相，而換網域時漏改的那一份不會有人發現。
   */
  images: {
    remotePatterns: allowedImageHosts().map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },

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
