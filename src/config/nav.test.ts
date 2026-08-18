import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { homeNav, isExcusedFromNav, NOT_IN_PUBLIC_NAV, PUBLIC_NAV } from "./nav";

/**
 * 公開導覽列（CR-006）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 「做完了，但畫面上進不去」——這個專案犯過七次。
 * `audit:wiring`【8】從首頁爬連結對帳磁碟路由，但它需要跑起來的伺服器；
 * 這一條在單元測試層就問同一件事，而且**問的是資料而不是渲染結果**。
 *
 * ⚠️ 形式是「反過來問」：不列「/pricing 要在導覽裡」，
 * 而是問「磁碟上有沒有哪一條公開路由沒有人放進導覽」。
 * 前者每加一條路由都要記得補，後者自己會發現下一次。
 */

/** 磁碟上的公開路由（排除後台、會員區、API 這些不是「公開頁面」的） */
function publicRoutesOnDisk(): string[] {
  const found: string[] = [];

  const walk = (dir: string, urlPath: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        // (group) 不影響網址；`%5F` 是 Next 對 `_` 開頭資料夾的編碼
        const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
        walk(next, `${urlPath}${segment}`);
      } else if (/^page\.tsx?$/.test(entry.name)) {
        found.push(urlPath === "" ? "/" : urlPath);
      }
    }
  };

  walk("src/app", "");

  return found.filter(
    (route) =>
      !route.startsWith("/admin") && !route.startsWith("/account") && !route.startsWith("/api"),
  );
}

describe("公開導覽列", () => {
  const inNav = new Set(
    PUBLIC_NAV.map((link) => link.href.replace(/^\/#.*/, "/")).filter((href) => href !== "/"),
  );

  it("每一條公開路由都在導覽裡，或列出了不放的理由", () => {
    const orphans = publicRoutesOnDisk().filter(
      (route) => !inNav.has(route) && !isExcusedFromNav(route),
    );

    expect(
      orphans,
      `這幾條公開路由沒有任何導覽入口：${orphans.join("、")}。` +
        `要嘛加進 PUBLIC_NAV，要嘛加進 NOT_IN_PUBLIC_NAV 並寫下理由`,
    ).toEqual([]);
  });

  it("導覽裡沒有連到不存在的頁面", () => {
    // 反方向：改了路由名稱而忘了改導覽，畫面上是一個 404
    const routes = new Set(publicRoutesOnDisk());
    const dead = [...inNav].filter((href) => !routes.has(href));

    expect(dead, `導覽指向不存在的頁面：${dead.join("、")}`).toEqual([]);
  });

  it("每一條例外都寫了理由", () => {
    for (const [route, reason] of NOT_IN_PUBLIC_NAV) {
      expect(reason.trim().length, `${route} 列成例外但沒寫理由`).toBeGreaterThan(4);
    }
  });

  it("例外清單裡沒有已經不存在的路由", () => {
    // 過期的例外會讓下一個人以為某條路由是刻意不連的，
    // 而它其實早就被刪掉了
    const routes = new Set(publicRoutesOnDisk());
    const stale = NOT_IN_PUBLIC_NAV.map(([route]) => route)
      // 前綴例外只要底下還有任何一條路由就算有效
      .filter((pattern) =>
        pattern.endsWith("/*")
          ? ![...routes].some((route) => route.startsWith(pattern.slice(0, -1)))
          : !routes.has(pattern),
      );

    expect(stale, `例外清單裡這幾條已經不存在：${stale.join("、")}`).toEqual([]);
  });

  it("首頁版本把站內錨點變成純錨點，其餘不動", () => {
    const home = homeNav();

    expect(home).toHaveLength(PUBLIC_NAV.length);
    for (const [index, link] of home.entries()) {
      const original = PUBLIC_NAV[index]!;
      expect(link.label).toBe(original.label);
      expect(link.href).toBe(
        original.href.startsWith("/#") ? original.href.slice(1) : original.href,
      );
    }
  });

  it("homeNav 不會改到原本那份", () => {
    // 回傳同一組物件參照的話，呼叫端改一個 href 會連原始清單一起改，
    // 而那會在「另一頁的導覽突然變了」時才被發現
    const before = JSON.stringify(PUBLIC_NAV);
    homeNav().forEach((link) => {
      link.href = "/mutated";
    });
    expect(JSON.stringify(PUBLIC_NAV)).toBe(before);
  });
});
