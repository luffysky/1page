import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "./safe-redirect";

/**
 * 開放轉址（open redirect）防護。
 *
 * 這組測試的價值在於它涵蓋了「看起來像站內路徑、其實不是」的幾種寫法——
 * 那些正是實務上真的被利用的形式，而不是明顯的 https://evil.com。
 */

describe("接受站內路徑", () => {
  it.each(["/", "/admin", "/work/abc", "/a/b?c=d#e", "/work?category=web"])("%s", (path) => {
    expect(sanitizeNextPath(path)).toBe(path);
  });
});

describe("拒絕站外目標", () => {
  it.each([
    ["https://evil.example.com", "完整外部網址"],
    ["http://evil.example.com", "完整外部網址（http）"],
    ["//evil.example.com", "協定相對網址——瀏覽器視為外部，卻很像站內路徑"],
    ["///evil.example.com", "多重斜線"],
    ["/\\evil.example.com", "反斜線變形，部分瀏覽器等同 //"],
    ["javascript:alert(1)", "腳本協定"],
    ["data:text/html,<script>", "data 協定"],
    ["evil.example.com", "沒有斜線開頭"],
    ["", "空字串"],
  ])("%s（%s）", (input) => {
    expect(sanitizeNextPath(input)).toBe("/");
  });

  it("含控制字元的路徑一律拒絕", () => {
    expect(sanitizeNextPath("/\tevil")).toBe("/");
    expect(sanitizeNextPath("/\nevil")).toBe("/");
    expect(sanitizeNextPath("/\u0000evil")).toBe("/");
  });
});

describe("型別防禦", () => {
  it("非字串一律回退", () => {
    expect(sanitizeNextPath(undefined)).toBe("/");
    expect(sanitizeNextPath(null)).toBe("/");
    expect(sanitizeNextPath(42)).toBe("/");
    expect(sanitizeNextPath({})).toBe("/");
  });

  it("重複參數取第一個", () => {
    expect(sanitizeNextPath(["/admin", "https://evil.example.com"])).toBe("/admin");
    expect(sanitizeNextPath(["https://evil.example.com", "/admin"])).toBe("/");
  });

  it("可指定 fallback", () => {
    expect(sanitizeNextPath("https://evil.example.com", "/login")).toBe("/login");
  });
});
