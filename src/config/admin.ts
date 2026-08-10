import "server-only";

/**
 * 後台設定（Spec §41）
 *
 * ⚠️ `ADMIN_SEGMENT` 刻意**不加 `NEXT_PUBLIC_` 前綴**。
 *
 * 加了前綴的環境變數會被打包進瀏覽器端的 JavaScript，
 * 也就是任何訪客打開 devtools 都能讀到後台路徑——那等於自己把密路徑貼出去。
 * 此模組另加 `server-only` 匯入，任何 client component 誤引用會直接編譯失敗。
 *
 * ── 密路徑不是安全邊界 ────────────────────────────────────────
 * 它只是讓自動掃描器找不到後台，減少被暴力嘗試的機會。
 * 真正的邊界是登入 + `admin_users` 名單 + RLS，三者缺一不可。
 * 如果哪天密路徑外流，網站也不該因此被攻破。
 */

export const ADMIN_SEGMENT = process.env.ADMIN_SEGMENT?.trim() ?? "";

/** 後台是否啟用。未設定 ADMIN_SEGMENT 時整個後台不存在（連 404 都不必特別處理） */
export function isAdminEnabled(): boolean {
  return ADMIN_SEGMENT.length > 0;
}

/** 對外可見的後台網址前綴，例如 `/k3f9x2/admin` */
export function adminBasePath(): string {
  return `/${ADMIN_SEGMENT}/admin`;
}

/** 把內部路徑（/admin/xxx）轉成對外的密路徑 */
export function toAdminUrl(internalPath: string): string {
  const suffix = internalPath.replace(/^\/admin/, "");
  return `${adminBasePath()}${suffix}`;
}

export const ADMIN_ROLES = ["owner", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** 目前兩個角色都能進後台。差別在於能否異動成員名單（見 migration 0004 的 RLS） */
export function canEnterAdmin(role: AdminRole | null): boolean {
  return role !== null;
}

export function isOwnerRole(role: AdminRole | null): boolean {
  return role === "owner";
}
