import type { MetadataRoute } from "next";

/**
 * Plan §11 C.1：開發路由不得污染產品訊號。
 * `/_dev/*` 在 production 本來就會 404，此處再明確 disallow，避免任何殘留連結被抓取。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/_dev/"],
    },
  };
}
