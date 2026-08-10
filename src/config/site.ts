/**
 * 站台基本資訊（Spec §32 SEO）
 *
 * canonical 與 OG 需要絕對網址。部署環境以 NEXT_PUBLIC_SITE_URL 覆寫，
 * 本機開發不設定時退回 localhost——退回 production 網域會讓開發時的
 * OG 預覽指向線上頁面，比沒有更誤導。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const SITE_NAME = "一頁起家";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
