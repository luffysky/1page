import { describe, expect, it } from "vitest";

import {
  buildSiteConfig,
  draftFromTemplate,
  getTemplate,
} from "@/features/website-engine/templates";

import { buildDemoSystemPrompt } from "./demo-prompt";

/**
 * 模板內的 AI 客服體驗（CR-003）
 *
 * 這一段的風險不是「答不出來」，是「答了不該答的」：
 * 編造營業時間、或者變成我們的業務。兩件都測。
 */

const config = (id: string) => buildSiteConfig(draftFromTemplate(getTemplate(id)!));

describe("buildDemoSystemPrompt", () => {
  it("知識來源只有那份 SiteConfig 的內容", () => {
    const prompt = buildDemoSystemPrompt(config("local-business"));

    // 模板裡真的寫著的東西要進得去
    expect(prompt).toContain("07:00–21:00");
    expect(prompt).toContain("28 席");
  });

  it("明說沒寫的就是不知道，不要猜", () => {
    // 一個會編造營業時間的客服，比沒有客服糟糕得多。
    const prompt = buildDemoSystemPrompt(config("local-business"));

    expect(prompt).toContain("沒有寫在這裡的事情，你就是不知道");
    expect(prompt).toContain("不要猜、不要編");
  });

  it("明說自己不是一頁起家的顧問", () => {
    // 同一頁上有兩個對話框。這個扮演客戶的店，那個是我們的業務。
    // 混在一起的話，訪客會從客服那裡拿到我們的報價——而它沒有價格資料。
    const prompt = buildDemoSystemPrompt(config("studio"));

    expect(prompt).toContain("你不是「一頁起家」的顧問");
  });

  it("提示詞裡沒有我們自己的價格或服務資料", () => {
    // 結構上的保證：它的系統提示由預覽產生，不含 knowledge.ts 的任何東西。
    const prompt = buildDemoSystemPrompt(config("product"));

    for (const leak of ["8,800", "15,800", "Website Workshop", "Template Build"]) {
      expect(prompt, `客服的提示詞裡出現了 ${leak}`).not.toContain(leak);
    }
  });

  it("每套模板都產得出提示詞", () => {
    for (const id of ["studio", "local-business", "personal", "product"]) {
      const prompt = buildDemoSystemPrompt(config(id));
      expect(prompt.length, `${id} 的提示詞太短`).toBeGreaterThan(200);
    }
  });

  /*
   * describeSections 只認得字串與陣列，其他型別會被靜靜丟掉。
   *
   * 這種掉法沒有任何徵兆：不會報錯、測試照樣綠、客服照樣會講話——
   * 它只是很有自信地不知道那一段。CR-003-2 要加 faq / stats 這些
   * 新的 content 形狀，正是踩進來的時機，所以這裡守的是「有沒有漏」，
   * 而不是「有沒有出現某個字」。
   */
  it("模板裡的每一段文字都真的進得了提示詞", () => {
    const collect = (value: unknown): string[] => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.flatMap(collect);
      if (value && typeof value === "object") return Object.values(value).flatMap(collect);
      return [];
    };

    for (const id of ["studio", "local-business", "personal", "product"]) {
      const siteConfig = config(id);
      const prompt = buildDemoSystemPrompt(siteConfig);

      for (const section of siteConfig.sections) {
        for (const [key, value] of Object.entries(section.content)) {
          for (const text of collect(value)) {
            // 太短的字（圖示、單一符號）不值得追
            if (text.trim().length < 4) continue;
            expect(
              prompt,
              `${id} 的 ${section.type}.${key} 沒進到客服的提示詞：「${text}」`,
            ).toContain(text);
          }
        }
      }
    }
  });
});
