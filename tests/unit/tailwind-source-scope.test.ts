import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Tailwind 的來源掃描範圍必須限制在 src/。
 *
 * 這條測試存在的原因是一次真實的故障：
 * `docs/worklog/daily_works_0811.md` 裡有一句說明文字
 * 「用 Tailwind 任意值 `bg-[var(--site-*)]`」，
 * Tailwind v4 的自動來源偵測掃到了 docs/，把那串當成真的 class，
 * 產出 `background-color: var(--site-*)`——不是合法的 CSS 值。
 * 整份 stylesheet 解析失敗，**每一頁在 dev 都回 500**。
 *
 * 特別值得記的是：那份文件已經提交好幾個小時，期間 gate 全綠。
 * `pnpm build` 沒有失敗，typecheck、lint、測試都沒有意見。
 * 是後來為了別的事開 dev server 才撞到。
 *
 * 寫文件不該有能力弄壞網站。
 */

const globals = readFileSync("src/app/globals.css", "utf8");

describe("Tailwind 來源掃描範圍", () => {
  it("關閉自動偵測，改為明確指定", () => {
    expect(globals).toMatch(/@import\s+"tailwindcss"\s+source\(none\)/);
  });

  it("只掃 src/，不掃 docs/ 或專案根目錄", () => {
    const sources = [...globals.matchAll(/@source\s+"([^"]+)"/g)].map((match) => match[1]);

    expect(sources.length).toBeGreaterThan(0);

    // globals.css 位於 src/app/，因此 "../" 就是 src/
    for (const source of sources) {
      expect(source, `@source "${source}" 超出 src/ 範圍`).not.toMatch(/\.\.\/\.\./);
    }
  });
});
