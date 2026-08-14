import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FAQ_ENTRIES } from "@/config/faq";
import {
  FINAL_CTA_COPY,
  FOOTER_COPY,
  HERO_COPY,
  LOGIN_COPY,
  PROCESS_STEPS,
  SECTION_COPY,
  START_COPY,
  WORK_COPY,
} from "@/config/home-copy";
import { HOME_GOALS } from "@/config/home-goals";
import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";
import { SERVICE_LINES } from "@/config/services";
import { renderPricingLadder } from "@/features/agent/knowledge";

import { mergeGoalCopy } from "./merge";
import { CMS_DOCUMENTS, CMS_KEYS, CMS_PAGES, cmsKeysByPage, type CmsKey } from "./registry";

/**
 * CMS 登記處（CR-004 / Phase B BH + BI）
 *
 * ── 這一組守的是「內容改了，但有一半沒跟著改」 ────────────────
 *
 * 價格同時出現在三個地方：首頁的價格區塊、Workshop Gate、
 * 以及**AI 顧問的系統提示**。前兩個改了看得出來，第三個不會——
 * 只有問到價格的那個潛在客戶會發現 AI 講的是舊數字。
 *
 * 那正是 Phase 5「模型自己編價格」那個 bug 的翻版，
 * 只是這次編的人是我們自己。
 *
 * BI 加了兩條更根本的，都是**反過來問**的形式（見 CLAUDE.md）：
 *   - 登記了但沒有任何人讀的 key
 *   - 還留在程式碼裡、沒有搬進 CMS 的區塊文案
 */

/* ------------------------------------------------------------------ */
/* 掃原始碼                                                            */
/* ------------------------------------------------------------------ */

/**
 * 註解要先去掉。
 *
 * ⚠️ 這個專案為了同一個原因造成過一次假通過、一次假失敗：
 * 註解裡提到 `readCmsDocument("faq.list")`，與真的有人呼叫它，
 * 是兩件事。而 `read.ts` 的檔頭正好就寫著 `cms:faq.list`。
 */
const stripComments = (input: string) =>
  input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sourceFiles(next, found);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(next);
  }
  return found;
}

/** 整個 src 的程式碼（不含測試、不含註解） */
const CODE = sourceFiles("src")
  .map((path) => stripComments(readFileSync(path, "utf8")))
  .join("\n");

/* ------------------------------------------------------------------ */

describe("登記處", () => {
  it("每一份文件都寫了「改了會影響哪裡」", () => {
    /*
     * 少了這句，下一個人打開後台看到一份內容，不知道按下儲存
     * 會動到網站的哪裡——於是他不敢改，而 CMS 就白做了。
     */
    for (const key of CMS_KEYS) {
      expect(CMS_DOCUMENTS[key].affects.trim().length, `${key} 沒有寫影響範圍`).toBeGreaterThan(0);
      expect(CMS_DOCUMENTS[key].label.trim().length, `${key} 沒有中文名`).toBeGreaterThan(0);
      expect(CMS_PAGES[CMS_DOCUMENTS[key].page], `${key} 的 page 不是認得的頁面`).toBeDefined();
    }
  });

  it("每一份預設值都通得過自己的 schema", () => {
    /*
     * 預設值就是原本寫死在 config 的那份內容。它驗不過的話，
     * 資料庫沒有那一列時**整個網站會退回一份驗不過的東西**——
     * 而讀取端只會在伺服器 log 裡留一行，畫面上看起來正常。
     */
    for (const key of CMS_KEYS) {
      const definition = CMS_DOCUMENTS[key];
      const result = definition.schema.safeParse(definition.fallback);

      expect(result.success, `${key} 的預設值不合法：${result.error?.issues[0]?.message}`).toBe(
        true,
      );
    }
  });

  it("key 的形式一致，看得出屬於哪一塊", () => {
    // `home.hero`、`pricing.tiers`——前綴是頁面或區塊、後綴是內容。
    // 沒有規則的話，key 會長成一堆各自為政的字串
    for (const key of CMS_KEYS) {
      expect(key, `${key} 不符合 <區塊>.<內容> 的形式`).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
});

describe("每一個 key 都有讀取端", () => {
  it("登記了卻沒有任何程式碼讀它的 key，一個都不能有", () => {
    /*
     * ⚠️ 這是整份測試最重要的一條。
     *
     * 這個專案犯過七次「宣告了一個東西，卻沒有任何地方用到它」。
     * CMS 特別容易犯：後台清單直接讀 registry，所以**登記了就看得到、
     * 就編得了、就存得進資料庫**——完全不需要有人讀它。
     *
     * 於是失敗的樣子是：編輯的人打開後台，改了一段文案，按下儲存，
     * 畫面說「存好了」，而網站上什麼都沒變。沒有任何錯誤訊息。
     *
     * 反過來問，不逐一列舉：下一次有人加 key 時它自己會發現。
     */
    const unread = CMS_KEYS.filter((key) => !CODE.includes(`readCmsDocument("${key}")`));

    expect(
      unread,
      `這些 key 登記了但沒有任何地方讀，後台改了不會有任何效果：${unread.join("、")}`,
    ).toEqual([]);
  });

  it("後台清單分組後仍然涵蓋全部的 key", () => {
    // 分組漏掉一份的話，那份文件在後台就進不去——做好了但沒有入口
    const grouped = cmsKeysByPage().flatMap((group) => group.keys);
    expect([...grouped].sort()).toEqual([...CMS_KEYS].sort());
  });
});

describe("還沒搬進 CMS 的區塊", () => {
  it("首頁的每一段抬頭都可以在後台改", () => {
    /*
     * 反過來問：`SECTION_COPY` 裡有沒有哪一段還沒有對應的 CMS 文件。
     *
     * 逐一列「goals 要有」「work 要有」的話，下次加一段新的 Section
     * 要記得回來補一行——而那正是會忘的事。
     * 從 `SECTION_COPY` 算出來就不會忘。
     */
    const covered = new Set(
      CMS_KEYS.filter((key) => key.startsWith("home.")).map((key) => key.slice("home.".length)),
    );

    const missing = Object.keys(SECTION_COPY).filter((section) => !covered.has(section));

    expect(missing, `首頁這幾段的文案還寫死在程式碼裡，後台改不到：${missing.join("、")}`).toEqual(
      [],
    );
  });
});

describe("預設值與 config 同一份", () => {
  /*
   * 兩份分岔的話，網站在「還沒用後台改過」的狀態下顯示的東西
   * 會與程式碼裡寫的不一樣——而那時沒有任何地方可以查真相。
   */

  it("FAQ 的預設值就是 config/faq.ts", () => {
    const fallback = CMS_DOCUMENTS["faq.list"].fallback;
    expect(fallback.entries.map((entry) => entry.id)).toEqual(FAQ_ENTRIES.map((entry) => entry.id));
  });

  it("價格的預設值就是 config/pricing.ts", () => {
    const fallback = CMS_DOCUMENTS["pricing.tiers"].fallback;

    expect(fallback.tiers.map((tier) => tier.id)).toEqual(PRICING_TIERS.map((tier) => tier.id));
    expect(fallback.tiers.map((tier) => tier.price)).toEqual(
      PRICING_TIERS.map((tier) => tier.price),
    );
    expect(fallback.groups.map((group) => group.id)).toEqual(
      PRICING_GROUPS.map((group) => group.id),
    );
  });

  it("首頁文案的預設值就是 config/home-copy.ts", () => {
    expect(CMS_DOCUMENTS["home.hero"].fallback.titleLines).toEqual([...HERO_COPY.titleLines]);
    expect(CMS_DOCUMENTS["home.hero"].fallback.lead).toBe(HERO_COPY.lead);
    expect(CMS_DOCUMENTS["home.final-cta"].fallback.cta.href).toBe(FINAL_CTA_COPY.cta.href);
    expect(CMS_DOCUMENTS["home.process"].fallback.steps.map((step) => step.title)).toEqual(
      PROCESS_STEPS.map((step) => step.title),
    );
    expect(CMS_DOCUMENTS["home.goals"].fallback.section.title).toBe(SECTION_COPY.goals.title);
    expect(CMS_DOCUMENTS["work.intro"].fallback.section.title).toBe(WORK_COPY.title);
    expect(CMS_DOCUMENTS["start.intro"].fallback.section.title).toBe(START_COPY.title);
    expect(CMS_DOCUMENTS["login.intro"].fallback.lead).toBe(LOGIN_COPY.lead);
    expect(CMS_DOCUMENTS["shared.footer"].fallback.copyright).toBe(FOOTER_COPY.copyright);
  });

  it("四條產品線的預設值就是 config/services.ts", () => {
    expect(CMS_DOCUMENTS["home.services"].fallback.lines.map((line) => line.id)).toEqual(
      SERVICE_LINES.map((line) => line.id),
    );
  });

  it("目標的預設值就是 config/home-goals.ts", () => {
    expect(CMS_DOCUMENTS["home.goals"].fallback.items.map((item) => item.id)).toEqual(
      HOME_GOALS.map((goal) => goal.id),
    );
  });
});

describe("mergeGoalCopy", () => {
  it("後台改了字就用新的字", () => {
    const merged = mergeGoalCopy({
      section: CMS_DOCUMENTS["home.goals"].fallback.section,
      items: [{ id: "website", label: "我要做官網", description: "改過的說明" }],
    });

    expect(merged.find((goal) => goal.id === "website")?.label).toBe("我要做官網");
  });

  it("後台刪掉一項，按鈕不會消失", () => {
    /*
     * ⚠️ 這一條驗的是「壞掉的方式要是安全的那一種」。
     *
     * 直接用 CMS 那份清單的話，刪掉一項的結果是
     * `?goal=brand` 這個網址仍然有效、首頁仍然被篩過，
     * 但畫面上沒有任何按鈕對應它——使用者取消不掉。
     *
     * 所以筆數與順序由程式碼決定，刪掉只是回到預設文案。
     */
    const merged = mergeGoalCopy({
      section: CMS_DOCUMENTS["home.goals"].fallback.section,
      items: [],
    });

    expect(merged.map((goal) => goal.id)).toEqual(HOME_GOALS.map((goal) => goal.id));
    expect(merged[0]!.label).toBe(HOME_GOALS[0]!.label);
  });
});

describe("AI 顧問看到的價格", () => {
  it("系統提示裡的價格來自同一份內容", () => {
    /*
     * ⚠️ 這條是整個 BH 最重要的一條。
     *
     * 價格從 CMS 讀之後，`renderPricingLadder` 若還讀常數，
     * 表現會是：後台改了價格 → 首頁是新的 → **AI 顧問講的是舊的**。
     * 沒有任何地方會報錯。
     *
     * 所以這裡拿一份「被改過的」價格餵進去，確認提示裡出現的是新數字，
     * 而且**舊數字不見了**。只驗新數字有出現是不夠的——
     * 兩份都在的話那條也會綠。
     */
    const changed = {
      groups: PRICING_GROUPS.map((group) => ({ ...group })),
      tiers: PRICING_TIERS.map((tier) => ({ ...tier, price: `${tier.price}-改過` })),
    };

    const ladder = renderPricingLadder(changed.groups, changed.tiers);

    for (const tier of changed.tiers) {
      expect(ladder, `${tier.name} 的新價格沒有出現`).toContain(tier.price);
    }

    // 舊的那份完全沒有被讀到
    for (const tier of PRICING_TIERS) {
      expect(ladder.includes(`${tier.price}　`), `${tier.name} 的舊價格還在`).toBe(false);
    }
  });
});

describe("CMS_KEYS", () => {
  it("與登記處的鍵完全一致", () => {
    // 兩者分岔的話，後台的清單會少一份文件——做好了但進不去
    expect([...CMS_KEYS].sort()).toEqual((Object.keys(CMS_DOCUMENTS) as CmsKey[]).sort());
  });
});
