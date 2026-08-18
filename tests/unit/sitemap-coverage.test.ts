import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NOT_PUBLIC, PUBLIC_ROUTES, routesOnDisk } from "../../tests/support/public-routes";

/**
 * 每一條公開路由都在 sitemap 裡（0818 收尾稽核）
 *
 * ── 為什麼需要這一份 ──────────────────────────────────────────
 *
 * `sitemap.ts` 的註解寫著「白名單比黑名單不容易漏」。
 * 那句話只在**有人記得加**的時候成立——收尾清查時發現
 * CR-006 搬出去的 `/pricing`、`/playground` 與 CR-003-5 的 `/crm`、`/edit`
 * 四條全都不在 sitemap 裡。
 *
 * 四條公開頁面，Google 從 sitemap 找不到，而沒有任何東西會說。
 * 這是「宣告了一個東西，卻沒有任何地方用到它」的第六次。
 *
 * ── 問法是反過來的 ────────────────────────────────────────────
 *
 * 不列「sitemap 應該有哪幾條」，而是問「**公開路由裡有沒有哪一條不在**」。
 * 不收錄的要寫進 `NOT_IN_SITEMAP` 並說明理由。
 */

const source = readFileSync("src/app/sitemap.ts", "utf8");

/** 不收錄的公開路由。每一條都要說得出為什麼 */
const NOT_IN_SITEMAP: Record<string, string> = {
  "/login": "登入頁本來就標記 noindex（見 admin-security.spec.ts）",
  "/work/interior-studio": "作品詳細由 listPublished 動態展開，不寫死在這裡",
};

describe("sitemap 的覆蓋率", () => {
  it("讀得到 sitemap 原始碼（守衛本身沒有空轉）", () => {
    expect(source).toContain("absoluteUrl");
    expect(routesOnDisk().length).toBeGreaterThan(20);
  });

  it("⚠️ 每一條公開路由都在 sitemap 裡，或寫明了為什麼不收錄", () => {
    const missing = PUBLIC_ROUTES.filter(
      (route) =>
        !source.includes(`absoluteUrl("${route.path}")`) && !(route.path in NOT_IN_SITEMAP),
    ).map((route) => route.path);

    expect(
      missing,
      "這些公開頁面不在 sitemap 裡。要嘛加進 sitemap.ts，要嘛加進 NOT_IN_SITEMAP 並寫理由",
    ).toEqual([]);
  });

  it("例外清單不會留下已經不存在的路由", () => {
    // 留著的話，下一次有人新增一條同名路由，它會自動被放行
    const known = new Set(PUBLIC_ROUTES.map((route) => route.path));
    const stale = Object.keys(NOT_IN_SITEMAP).filter((path) => !known.has(path));
    expect(stale, "NOT_IN_SITEMAP 裡有已經不在公開清單上的路由").toEqual([]);
  });

  it("⚠️ sitemap 不含後台、會員中心與 _dev", () => {
    /*
     * Plan §11 C.1：`/_dev/*` 不得被收錄。
     * 後台的密路徑更不能——sitemap 是公開檔案，寫進去等於公告。
     */
    for (const [pattern] of NOT_PUBLIC) {
      const leaked = routesOnDisk().filter(
        (route) => pattern.test(route) && source.includes(`absoluteUrl("${route}")`),
      );
      expect(leaked, `sitemap 收錄了不該收錄的路由（${pattern}）`).toEqual([]);
    }
  });
});
