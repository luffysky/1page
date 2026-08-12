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

/**
 * 具名例外。每一項都要寫明理由——
 * 「為什麼這裡可以」不該隨時間流失，也不該有人順手再加一個。
 */
const ALLOWED_VALUE_FILES: Record<string, string> = {
  "src/styles/tokens.css": "設計數值的唯一歸屬地",
  "src/features/website-engine/schema.ts":
    "驗證器：必須列出 rgb()/hsl() 等函式名稱才能檢查 SiteConfig 的色彩值，本身不含任何設計數值",
  "src/config/brand-colors.ts":
    "tokens.css 的鏡像。PWA manifest 與動態圖示拿不到 CSS 變數，一致性由 brand-colors.test.ts 保證",
  "src/app/%5Fdev/theme/page.tsx":
    "Theme Engine 驗證頁（dev only）：色碼是示範用的「客戶網站主題」內容，不是本站的設計數值",
  "src/features/website-engine/templates/themes.ts":
    "Template 的主題預設集：色碼屬於「被預覽的客戶網站」，與本站設計數值是兩個系統。對比度由 templates.test.ts 實算",
};

/**
 * 測試檔不在此規則範圍內。
 *
 * 規則的原文是「元件與樣式中不得出現硬編色碼」——測試檔兩者皆非。
 * 而且驗證色彩相關邏輯（例如 SiteConfig 的 CSS 注入防護）本來就必須
 * 寫出各種色彩字面值，包含刻意惡意的那些。
 */
function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

function isExempt(path: string): boolean {
  return path in ALLOWED_VALUE_FILES || isTestFile(path);
}

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
      .filter((file) => !isExempt(file.path))
      .flatMap((file) => {
        const matches = file.content.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
        return matches.map((match) => `${file.path}: ${match}`);
      });

    expect(offenders).toEqual([]);
  });

  it("不得出現 rgb() / rgba() / hsl() 字面值", () => {
    const offenders = files
      .filter((file) => !isExempt(file.path))
      .flatMap((file) => {
        const matches = file.content.match(/\b(rgba?|hsla?)\(/g) ?? [];
        return matches.map((match) => `${file.path}: ${match}`);
      });

    expect(offenders).toEqual([]);
  });

  it("TSX 中不得使用 inline style", () => {
    // Spec §45.2 明列 inline style 為 Demo 不可移植的原因之一。
    //
    // 比對 `style={` 而非 `style={{`：後者只抓得到物件字面值，
    // `style={someVar}` 會整個漏掉——而那正是主題注入實際的寫法。
    // 這個漏洞是在 3B 加入 SiteScope 時才發現的。
    //
    // 例外採「具名清單」而非放寬規則：每一個例外都要寫明理由，
    // 這樣「為什麼這裡可以」不會隨時間流失，也不會有人順手再加一個。
    const ALLOWED_INLINE_STYLE: Record<string, string> = {
      // 上傳進度條的寬度是執行期計算的百分比，無法用 Tailwind class 表達。
      // 這不是「懶得寫 class」，是 CSS 類別本質上表達不了連續變化的值。
      "src/app/admin/portfolio/media-manager.tsx": "上傳進度條寬度（執行期百分比）",
      // 全站唯一允許注入主題變數的地方（Plan §3）。
      // 用 inline style 而非 <style> 或 class 的理由見該檔說明。
      "src/features/website-engine/site-scope.tsx": "--site-* 主題變數注入點",
      // 示範 Section 元件如何只使用 --site-* 變數。僅開發環境存在。
      "src/app/%5Fdev/theme/page.tsx": "Theme Engine 視覺驗證頁（dev only）",
      // ImageResponse（Satori）在伺服器端算圖，完全不處理 Tailwind class，
      // 只認 inline style。這不是選擇，是那個渲染器的唯一輸入方式。
      "src/app/icon.tsx": "ImageResponse 只支援 inline style",
      "src/app/icon-maskable/route.tsx": "ImageResponse 只支援 inline style",
    };

    const offenders = files
      .filter((file) => file.path.endsWith(".tsx"))
      .filter((file) => /style=\{/.test(file.content))
      .filter((file) => !(file.path in ALLOWED_INLINE_STYLE))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it("inline style 的例外清單不得包含已不再使用它的檔案", () => {
    // 例外清單腐爛的方向通常是「留著沒人記得為什麼」。
    // 這條讓過期的例外被主動清掉，而不是無限累積。
    const allowed = [
      "src/app/admin/portfolio/media-manager.tsx",
      "src/features/website-engine/site-scope.tsx",
      "src/app/%5Fdev/theme/page.tsx",
      "src/app/icon.tsx",
      "src/app/icon-maskable/route.tsx",
    ];
    const stale = allowed.filter((path) => {
      const file = files.find((item) => item.path === path);
      return file && !/style=\{/.test(file.content);
    });

    expect(stale).toEqual([]);
  });
});
