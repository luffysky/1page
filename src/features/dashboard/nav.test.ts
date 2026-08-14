import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ADMIN_NAV, MEMBER_NAV, navItems, type NavGroup } from "./nav";

/**
 * 每一頁都要在導覽裡（CR-004 / Phase B BA）
 *
 * ── 這條守的是這個專案犯過七次的那件事 ────────────────────────
 *
 * 「功能做完了，但畫面上進不去。」
 *
 * `audit:wiring`【8】從 `/` 爬同源連結，抓得到公開頁面；
 * `authed-reachability.spec.ts` 帶著 session 再爬一次，抓得到登入後的。
 * 但那兩支都要跑起一個伺服器。
 *
 * 這一條在單元測試層就先擋一次：**磁碟上有一頁，導覽資料裡沒有它**。
 * 便宜、快，而且在寫程式的當下就會紅。
 *
 * 反過來問，不逐一列舉：新增一頁時它自己會發現。
 */

/** 走磁碟，與 audit:wiring【8】同一套規則 */
function routesUnder(dir: string, urlPath: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
      found.push(...routesUnder(next, `${urlPath}${segment}`));
    } else if (/^page\.tsx?$/.test(entry.name)) {
      found.push(urlPath);
    }
  }

  return found;
}

/**
 * 動態路由不必出現在導覽裡：`/admin/portfolio/[id]` 是從列表點進去的，
 * 不是選單上的一個項目。
 */
const isDynamic = (route: string) => route.includes("[");

/**
 * 刻意不放進導覽的頁面。每一條都要寫理由。
 *
 * ⚠️ 寫不出理由的就是漏接——那正是這條測試存在的原因。
 */
const NOT_IN_NAV: Array<[string, string]> = [
  ["/admin/portfolio/new", "從「作品」列表的『新增』按鈕進入，不是選單上的一個區段"],
];

function missingFromNav(routes: string[], nav: NavGroup[]): string[] {
  const linked = new Set(navItems(nav).map((item) => item.href));
  const excused = new Set(NOT_IN_NAV.map(([route]) => route));

  return routes.filter((route) => !isDynamic(route) && !linked.has(route) && !excused.has(route));
}

describe("導覽資料", () => {
  it("後台每一頁都在 ADMIN_NAV 裡", () => {
    const routes = routesUnder("src/app/admin", "/admin");
    expect(routes.length, "找不到任何後台頁面，這條就證明不了東西").toBeGreaterThan(0);

    const missing = missingFromNav(routes, ADMIN_NAV);
    expect(missing, `這些後台頁面不在導覽裡，畫面上進不去：${missing.join("、")}`).toEqual([]);
  });

  it("會員區每一頁都在 MEMBER_NAV 裡", () => {
    const routes = routesUnder("src/app/account", "/account");
    expect(routes.length).toBeGreaterThan(0);

    const missing = missingFromNav(routes, MEMBER_NAV);
    expect(missing, `這些會員頁面不在導覽裡：${missing.join("、")}`).toEqual([]);
  });

  it("導覽裡的每一項都真的有那一頁", () => {
    /*
     * 反方向也要驗。選單上有一個連到 404 的項目，比少一個項目更糟：
     * 使用者會以為那個功能壞了，而其實是它根本還沒做。
     */
    const admin = routesUnder("src/app/admin", "/admin");
    const member = routesUnder("src/app/account", "/account");
    const onDisk = new Set([...admin, ...member]);

    const dangling = [...navItems(ADMIN_NAV), ...navItems(MEMBER_NAV)]
      .map((item) => item.href)
      .filter((href) => !onDisk.has(href));

    expect(dangling, `導覽裡有連到不存在頁面的項目：${dangling.join("、")}`).toEqual([]);
  });

  it("不放進導覽的例外都寫了理由", () => {
    // 理由是空字串的話，這份清單就退化成「先加進來讓測試綠」
    for (const [route, reason] of NOT_IN_NAV) {
      expect(reason.trim().length, `${route} 沒有寫理由`).toBeGreaterThan(0);
    }
  });
});
