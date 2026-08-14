import { readdirSync } from "node:fs";

/**
 * 磁碟上有哪些路由
 *
 * 與 `scripts/audit-wiring.mjs`【8】同一套規則，刻意抽成共用的一份：
 * 兩邊各寫一次的話，其中一邊漏掉 `(group)` 或 `%5F` 的處理，
 * 就會安靜地少檢查幾條路由——而「少檢查」看起來與「全部通過」一模一樣。
 */
export function routesOnDisk(root = "src/app"): string[] {
  const found: string[] = [];

  const walk = (dir: string, urlPath: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        /*
         * (group) 不影響網址；@slot 是平行路由。
         * 資料夾名稱可能是百分比編碼：Next 把 `_` 開頭的資料夾視為私有，
         * 要產生 /_dev 這種網址，資料夾必須命名為 `%5Fdev`。
         */
        const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
        walk(next, `${urlPath}${segment}`);
      } else if (/^(page|route)\.tsx?$/.test(entry.name)) {
        found.push(urlPath === "" ? "/" : urlPath);
      }
    }
  };

  walk(root, "");
  return [...new Set(found)];
}

/** 動態路由在磁碟上是 /work/[slug]，爬到的是 /work/interior-studio */
export function matchesRoute(route: string, visited: readonly string[]): boolean {
  const pattern = new RegExp(
    `^${route.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}$`,
  );
  return visited.some((path) => pattern.test(path));
}
