import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS } from "@/lib/analytics/track";

/**
 * Spec §31 的事件都要真的有人在送。
 *
 * 7C 出口條件的另一半。「接上 Analytics」很容易變成只換了傳輸層，
 * 而規格列的十九個事件裡有五個從來沒有任何程式碼呼叫過——
 * 那五個永遠不會出現在報表上，而報表看起來一切正常。
 *
 * 這是【8】路由可達性、【9】API 接線的第三個版本：
 * 宣告了一個東西，卻沒有任何地方用到它。
 */

const ROOT = process.cwd();
const SOURCE = join(ROOT, "src");
const TRACK_MODULE = "src/lib/analytics/track.ts";

function collect(dir: string): { path: string; content: string }[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collect(full);
    if (![".ts", ".tsx"].includes(extname(full))) return [];

    return [
      {
        path: relative(ROOT, full).split("\\").join("/"),
        content: readFileSync(full, "utf8"),
      },
    ];
  });
}

const files = collect(SOURCE).filter(
  (file) =>
    file.path !== TRACK_MODULE &&
    !file.path.endsWith(".test.ts") &&
    !file.path.endsWith(".test.tsx"),
);

describe("Spec §31 事件的呼叫點", () => {
  it("每一個事件都至少有一個地方在送", () => {
    const missing = ANALYTICS_EVENTS.filter(
      (event) => !files.some((file) => file.content.includes(`"${event}"`)),
    );

    expect(missing, "這些事件宣告了但沒有任何程式碼呼叫").toEqual([]);
  });

  it("沒有送出規格以外的事件", () => {
    // 型別已經擋住了，但型別只在編譯期存在。
    // 這一條抓的是「有人把事件名稱組字串組出來」的情況。
    const declared = new Set<string>(ANALYTICS_EVENTS);
    const used = new Set<string>();

    for (const file of files) {
      for (const match of file.content.matchAll(/track\(\s*"([a-z_]+)"/g)) {
        used.add(match[1]!);
      }
    }

    expect([...used].filter((event) => !declared.has(event))).toEqual([]);
  });
});

describe("傳輸層", () => {
  const track = readFileSync(join(ROOT, TRACK_MODULE), "utf8");

  it("送出前排除 /_dev/*（Plan §11 C.1）", () => {
    // 開發路由是工具，不是產品內容。混進去的話，
    // 看到的數字裡有一部分是我們自己在測東西。
    expect(track).toContain("/_dev/");
  });

  it("用 sendBeacon，不是普通的 fetch", () => {
    // 最重要的幾個事件（點了 CTA 就跳走、送出表單）都發生在頁面正在離開的瞬間。
    // 用 fetch 的話那些請求會被瀏覽器取消，而且不會有任何錯誤——數字就只是偏低。
    expect(track).toContain("sendBeacon");
  });

  it("沒有硬綁任何一家供應商的 SDK", () => {
    // 綁死之後要換就得回頭改每一個呼叫點，而漏掉的那幾處
    // 會靜靜地繼續送到舊的地方。
    for (const vendor of ["gtag", "mixpanel", "posthog", "amplitude", "segment"]) {
      expect(track.toLowerCase(), `傳輸層綁死了 ${vendor}`).not.toContain(vendor);
    }
  });
});
