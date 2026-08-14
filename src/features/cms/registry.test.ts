import { describe, expect, it } from "vitest";

import { FAQ_ENTRIES } from "@/config/faq";
import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";
import { renderPricingLadder } from "@/features/agent/knowledge";

import { CMS_DOCUMENTS, CMS_KEYS, type CmsKey } from "./registry";

/**
 * CMS 登記處（CR-004 / Phase B BH）
 *
 * ── 這一組守的是「內容改了，但有一半沒跟著改」 ────────────────
 *
 * 價格同時出現在三個地方：首頁的價格區塊、Workshop Gate、
 * 以及**AI 顧問的系統提示**。前兩個改了看得出來，第三個不會——
 * 只有問到價格的那個潛在客戶會發現 AI 講的是舊數字。
 *
 * 那正是 Phase 5「模型自己編價格」那個 bug 的翻版，
 * 只是這次編的人是我們自己。
 */

describe("登記處", () => {
  it("每一份文件都寫了「改了會影響哪裡」", () => {
    /*
     * 少了這句，下一個人打開後台看到一份 JSON，不知道按下儲存
     * 會動到網站的哪裡——於是他不敢改，而 CMS 就白做了。
     */
    for (const key of CMS_KEYS) {
      expect(CMS_DOCUMENTS[key].affects.trim().length, `${key} 沒有寫影響範圍`).toBeGreaterThan(0);
      expect(CMS_DOCUMENTS[key].label.trim().length, `${key} 沒有中文名`).toBeGreaterThan(0);
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
    // `faq.list`、`pricing.tiers`——前綴是區塊、後綴是內容。
    // 沒有規則的話，key 會長成一堆各自為政的字串
    for (const key of CMS_KEYS) {
      expect(key, `${key} 不符合 <區塊>.<內容> 的形式`).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
});

describe("預設值與 config 同一份", () => {
  it("FAQ 的預設值就是 config/faq.ts", () => {
    /*
     * 兩份分岔的話，網站在「還沒用後台改過」的狀態下顯示的東西
     * 會與程式碼裡寫的不一樣——而那時沒有任何地方可以查真相。
     */
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
