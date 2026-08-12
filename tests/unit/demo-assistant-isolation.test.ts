import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 客服體驗與我們自己之間的那道牆（CR-003 / Spec §47）
 *
 * Spec §47 寫下兩個硬性要求，兩個都只是路由裡的一行：
 * 零工具、額度分開。一行很好寫，也很好在某次重構裡被順手改掉。
 *
 * ── 為什麼是讀原始碼，不是打路由 ──────────────────────────────
 *
 * 要在測試裡打這支路由，得先把 Anthropic client 換掉；換掉之後
 * 「真的沒送出工具」這件事就變成「我們的假物件收到了空陣列」——
 * 驗的是假物件。這裡要守的東西剛好是一行靜態設定，
 * 那就直接盯著那一行。代價是它認得的是寫法而不是行為：
 * 換一種寫法（例如把三元運算抽成函式）會讓它紅，
 * 那時請跟著改這裡，不要刪掉。
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("客服體驗的隔離", () => {
  it("demo 模式送出的工具是空的", () => {
    // 一個扮演客戶那間店的角色，不該碰得到我們的作品集、價格或 Lead。
    // 靠的不是提示詞裡叮嚀它別用，是根本沒給。
    const route = read("src/app/api/agent/route.ts");

    expect(route).toMatch(/tools:\s*demoConfig\s*\?\s*\[\]\s*:/);
  });

  it("demo 模式用的是另一份系統提示，不是顧問那份", () => {
    const route = read("src/app/api/agent/route.ts");

    expect(route).toMatch(/demoConfig\s*\?\s*buildDemoSystemPrompt\(demoConfig\)\s*:/);
  });

  it("demo 的限流額度與顧問分開計算", () => {
    // 玩預覽的人會一直打——那是它存在的目的——
    // 而那些額度不該吃掉真正想問服務的人的份。
    const route = read("src/app/api/agent/route.ts");

    expect(route).toContain(":demo");
    expect(route).toMatch(/isDemo\s*\?\s*DEMO_RATE_LIMITS/);
  });

  it("客服泡泡只用被預覽網站的顏色，沒有一個是我們的", () => {
    /*
     * 它是在示範「你的網站上的客服長什麼樣子」，不是我們的介面。
     * 用到 --color-brand-* 就會讓客戶的網站長得像我們。
     */
    const component = read("src/components/website-preview/preview-assistant.tsx");
    const code = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/--color-brand-/);
    expect(code).not.toMatch(/\b(?:bg|text|border)-brand-/);
  });

  it("客服泡泡標明自己是示範", () => {
    // 讓人以為在跟一間真的店講話、之後才發現店是假的，
    // 會讓他連帶懷疑這個網站上其他東西的真假。
    const component = read("src/components/website-preview/preview-assistant.tsx");

    expect(component).toContain("DEMO_ASSISTANT_NOTICE");
  });
});
