import { describe, expect, it } from "vitest";

import { FAQ_ENTRIES, searchFaq } from "@/config/faq";
import { PRICING_TIERS } from "@/config/pricing";
import { SERVICE_LINES } from "@/config/services";

import { renderPricingLadder, renderServiceLines } from "./knowledge";
import { AGENT_TOOL_NAMES, AGENT_TOOLS, executeAgentTool, portfolioDisclosure } from "./tools";

/**
 * 5C 的出口條件（Plan）：
 *   「只有 Demo 時必須明說『目前有相關 Concept / Demo』，
 *     不可說成客戶案例（Spec §8.12）——**這條要有測試**。」
 *
 * 規格點名要測試的規則不多，這是其中一條。
 */

describe("Spec §8.12：Demo 不可講成客戶案例", () => {
  it("查出來的東西沒有客戶案例時，工具結果自己帶著揭露指示", () => {
    // 這是整段 5C 的核心。系統提示裡也寫了同一條規則，
    // 但那是一句遠處的通則——隔了十幾輪對話之後份量會被稀釋。
    // 讓指示跟著資料一起送達，而且由程式算出來，不是靠模型自己判斷。
    const disclosure = portfolioDisclosure([
      { projectType: "demo" },
      { projectType: "concept" },
      { projectType: "internal" },
    ]);

    expect(disclosure).toContain("沒有客戶案例");
    expect(disclosure).toContain("Concept");
    expect(disclosure).toContain("Demo");
    expect(disclosure).toContain("不可以講成");
  });

  it("有客戶案例時不會硬加上那句話", () => {
    // 反方向也要對。永遠都說「這些都是 Demo」的話，
    // 真的有客戶案例的那天，我們會把自己的實績講小。
    const disclosure = portfolioDisclosure([{ projectType: "client" }, { projectType: "demo" }]);

    expect(disclosure).not.toContain("沒有客戶案例");
    expect(disclosure).toContain("projectType");
  });

  it("查不到東西時要求直說沒有，而不是拿別的充數", () => {
    expect(portfolioDisclosure([])).toContain("沒有符合");
    expect(portfolioDisclosure([])).toMatch(/充數|直接說/);
  });

  it("實際跑一次 search_portfolio，結果一定含 disclosure 與逐件的來源類型", () => {
    // 只測 portfolioDisclosure 這個函式是不夠的——
    // 它可能寫對了卻沒被接到工具的輸出上。
    return executeAgentTool("search_portfolio", {}).then((result) => {
      expect(result.isError).toBe(false);

      const payload = JSON.parse(result.content);
      expect(payload.disclosure).toBeTruthy();

      for (const project of payload.projects) {
        expect(project.projectType, `${project.title} 沒有標示來源類型`).toBeTruthy();
        expect(project.projectTypeLabel).toBeTruthy();
      }
    });
  });
});

describe("工具白名單（Spec §20）", () => {
  it("每個工具都有名稱、說明與參數 schema", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length, `${tool.name} 的說明太短`).toBeGreaterThan(40);
      expect(tool.input_schema.type).toBe("object");
    }
  });

  it("說明都寫了「什麼時候該叫它」，不是只寫功能", () => {
    // 只說功能的話，模型傾向自己回答而不呼叫工具——
    // 而自己回答的內容就是編的。5B 那組編出來的價格就是這樣來的。
    for (const tool of AGENT_TOOLS) {
      // 「…時呼叫」「…之後呼叫」「…才呼叫」都算——判準是有沒有講觸發條件，
      // 不是有沒有用某個特定的措辭。
      expect(tool.description, `${tool.name} 沒有說何時呼叫`).toMatch(/(時|之後|才)呼叫/);
    }
  });

  it("白名單以外的工具名回傳錯誤，不是靜靜地什麼都沒發生", async () => {
    const result = await executeAgentTool("delete_everything", {});

    expect(result.isError).toBe(true);
    expect(result.content).toContain("沒有名為");
  });

  it("參數不合法時回傳錯誤結果而不是拋例外", async () => {
    // 拋出去的話整輪對話會斷在半路，使用者看到的是回覆突然停住。
    const result = await executeAgentTool("search_faq", { query: "" });

    expect(result.isError).toBe(true);
  });

  it("工具名稱清單與定義同源", () => {
    expect(AGENT_TOOL_NAMES).toEqual(AGENT_TOOLS.map((tool) => tool.name));
  });
});

describe("search_faq", () => {
  it("查得到就照抄，查不到就要求說不確定", async () => {
    const hit = JSON.parse((await executeAgentTool("search_faq", { query: "流程" })).content);
    expect(hit.entries.length).toBeGreaterThan(0);
    expect(hit.hint).toContain("不要加上沒寫的");

    const miss = JSON.parse(
      (await executeAgentTool("search_faq", { query: "你們有賣咖啡豆嗎" })).content,
    );
    expect(miss.entries).toHaveLength(0);
    // 查不到時最危險的行為是自己補一個答案——那等於替工作室做了承諾。
    expect(miss.hint).toContain("不要自己補");
  });

  it("FAQ 答案裡不寫價格數字", () => {
    // 價格只有一個來源：config/pricing.ts。
    // FAQ 再抄一次就會分岔，而分岔的表現是「網站寫 8,800、AI 說 8,000」。
    for (const entry of FAQ_ENTRIES) {
      expect(entry.answer, `${entry.id} 的答案裡有金額`).not.toMatch(/\d{3,}/);
    }
  });

  it("關鍵詞查得到每一條 FAQ", () => {
    // 有條目但查不到，等於沒有那條目。
    for (const entry of FAQ_ENTRIES) {
      const found = searchFaq(entry.keywords[0]!);
      expect(
        found.map((item) => item.id),
        `${entry.id} 用自己的關鍵詞查不到`,
      ).toContain(entry.id);
    }
  });
});

describe("知識段落由 config 產生", () => {
  it("六級價格全部出現，數字與 config 一致", () => {
    // 5B 實測到模型自己編了「幾萬元起」——因為它讀不到真的價格。
    // 這條確認真的價格有進提示詞，而且是從 config 來的不是手抄的。
    const ladder = renderPricingLadder();

    for (const tier of PRICING_TIERS) {
      expect(ladder, `${tier.name} 沒有出現`).toContain(tier.name);
      expect(ladder, `${tier.name} 的價格沒有出現`).toContain(tier.price);
    }
  });

  it("價格段落明說只能用這裡的數字", () => {
    expect(renderPricingLadder()).toContain("不可以自己估");
  });

  it("四條產品線全部出現", () => {
    const lines = renderServiceLines();
    for (const service of SERVICE_LINES) {
      expect(lines).toContain(service.name);
    }
  });
});
