import { readdirSync } from "node:fs";

/**
 * 公開路由的單一清單（0818 收尾稽核）
 *
 * ── 為什麼抽出來 ──────────────────────────────────────────────
 *
 * 原本 a11y 掃描有一份清單並且有守衛（漏一條會紅），
 * 而八斷點截圖 `tests/visual/shots.spec.ts` 另外有一份**沒有守衛的**清單。
 * 於是 CR-006 新增的 `/pricing` 與 `/playground` 進了前者、沒進後者——
 * 人工視覺 review 從來沒看過那兩頁，而沒有任何東西會說。
 *
 * 兩邊共用同一份之後，漏掉一條就是兩邊一起漏，而守衛會擋下來。
 */

export interface PublicRoute {
  name: string;
  path: string;
}

/** 公開路由。後台與會員中心在 authed-breakpoints.spec.ts（需要登入才進得去） */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { name: "首頁", path: "/" },
  { name: "作品列表", path: "/work" },
  { name: "作品詳細", path: "/work/interior-studio" },
  { name: "登入", path: "/login" },
  { name: "Project Builder", path: "/start" },
  { name: "網站編輯器", path: "/edit" },
  { name: "CRM 設計器", path: "/crm" },
  { name: "價格", path: "/pricing" },
  { name: "試穿", path: "/playground" },
];

/**
 * 不在這份清單裡的，要寫在這裡並附理由。
 *
 * 【8】路由可達性只問「有沒有入口」——`/edit` 有入口，所以它是綠的，
 * 而清單漏了它不會有任何東西說。漏掉一條路由跟那條路由壞掉一樣嚴重，
 * 只是它更安靜。
 */
export const NOT_PUBLIC: Array<[RegExp, string]> = [
  [/^\/admin(\/|$)/, "後台在 authed-breakpoints.spec.ts（需要登入）"],
  [/^\/account(\/|$)/, "會員中心需要登入，同上"],
  [/^\/_dev(\/|$)/, "開發用頁面。截圖那一組另外會拍，a11y 不掃"],
  [/^\/api(\/|$)/, "不是頁面"],
  [/^\/icon-maskable$/, "不是頁面"],
  [/^\/work\/\[slug\]$/, "動態路由，已用 interior-studio 這個實例掃過"],
];

/**
 * 磁碟上實際有哪些路由。
 *
 * 用走檔案系統而不是列清單：問法是反過來的——
 * 「**有沒有哪一條沒人掃**」，而不是「這幾條掃了沒」。
 */
export function routesOnDisk(): string[] {
  const found: string[] = [];
  const walk = (dir: string, urlPath: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
        walk(next, `${urlPath}${segment}`);
      } else if (/^(page|route)\.tsx?$/.test(entry.name)) {
        found.push(urlPath === "" ? "/" : urlPath);
      }
    }
  };
  walk("src/app", "");

  return found;
}

/** 磁碟上有、但這份清單沒收錄也沒排除的路由 */
export function unlistedRoutes(): string[] {
  const listed = new Set(PUBLIC_ROUTES.map((route) => route.path));

  return routesOnDisk().filter(
    (route) => !listed.has(route) && !NOT_PUBLIC.some(([pattern]) => pattern.test(route)),
  );
}
