import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_COLORS } from "./brand-colors";

/**
 * 鏡像與來源的一致性。
 *
 * `brand-colors.ts` 是 tokens.css 的鏡像，存在的理由是 PWA manifest 與
 * 動態圖示拿不到 CSS 變數。允許重複，但不允許無聲分歧——
 * 改了 tokens.css 卻忘了改鏡像，症狀是「安裝後的狀態列顏色跟網站對不上」，
 * 那種細節沒人會主動去查。
 */

const tokens = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function tokenValue(name: string): string | null {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(tokens);
  return match ? match[1]!.trim() : null;
}

describe("品牌色鏡像與 tokens.css 一致", () => {
  it.each([
    ["--color-brand-bg", BRAND_COLORS.bg],
    ["--color-brand-ink", BRAND_COLORS.ink],
    ["--color-brand-paper", BRAND_COLORS.paper],
    ["--color-brand-accent", BRAND_COLORS.accent],
  ])("%s", (token, mirrored) => {
    const source = tokenValue(token);
    expect(source, `tokens.css 找不到 ${token}`).not.toBeNull();
    expect(source).toBe(mirrored);
  });

  it("鏡像只包含真正需要在 TS 端取用的色彩", () => {
    // 鏡像越大越容易分歧。只放 manifest 與圖示用得到的四個。
    expect(Object.keys(BRAND_COLORS).sort()).toEqual(["accent", "bg", "ink", "paper"]);
  });
});
