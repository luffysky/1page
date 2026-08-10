import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 1A 出口條件：「tokens.css 為唯一數值來源，元件中無 hard-coded 色碼／字級」
 *
 * V3 Demo 失敗的根因之一就是 inline style 與散落的色碼（Spec §45.2）。
 * 這個測試讓同樣的事在 Phase 1 直接 fail，而不是靠 code review 的自制力。
 */

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, "src");

/** tokens.css 是數值的合法歸屬地，其餘檔案都不是 */
const ALLOWED_VALUE_FILES = new Set(["src/styles/tokens.css"]);

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectFiles(full);
    return [".ts", ".tsx", ".css"].includes(extname(full)) ? [full] : [];
  });
}

const files = collectFiles(SCAN_DIR).map((file) => ({
  path: relative(ROOT, file).split("\\").join("/"),
  content: readFileSync(file, "utf8"),
}));

describe("設計數值只能來自 tokens.css", () => {
  it("元件與樣式中不得出現 hard-coded hex 色碼", () => {
    const offenders = files
      .filter((file) => !ALLOWED_VALUE_FILES.has(file.path))
      .flatMap((file) => {
        const matches = file.content.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
        return matches.map((match) => `${file.path}: ${match}`);
      });

    expect(offenders).toEqual([]);
  });

  it("不得出現 rgb() / rgba() / hsl() 字面值", () => {
    const offenders = files
      .filter((file) => !ALLOWED_VALUE_FILES.has(file.path))
      .flatMap((file) => {
        const matches = file.content.match(/\b(rgba?|hsla?)\(/g) ?? [];
        return matches.map((match) => `${file.path}: ${match}`);
      });

    expect(offenders).toEqual([]);
  });

  it("TSX 中不得使用 style={{ ... }} inline style", () => {
    // Spec §45.2 明列 inline style 為 Demo 不可移植的原因之一。
    // 例外：Phase 3 的 SiteRenderer 需以 inline style 注入 --site-* 至
    // [data-site-scope]，屆時在此加入具名例外，而非直接放寬規則。
    const offenders = files
      .filter((file) => file.path.endsWith(".tsx"))
      .filter((file) => /style=\{\{/.test(file.content))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });
});
