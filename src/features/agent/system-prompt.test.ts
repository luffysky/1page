import { describe, expect, it } from "vitest";

import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";

import { AGENT_INTENTS } from "./scope";
import { buildAgentSystemPrompt, initialIntentHint } from "./system-prompt";

/*
 * 系統提示現在是一個函式，因為價格從 CMS 來（Phase B BH）。
 * 這裡用程式碼裡的預設值建一份——測的是提示的**組成規則**，
 * 不是「今天資料庫裡的價格是多少」那種會變的事實。
 */
const AGENT_SYSTEM_PROMPT = buildAgentSystemPrompt({
  groups: PRICING_GROUPS,
  tiers: PRICING_TIERS,
});

/**
 * 系統提示是由好幾個模組拼起來的（scope、knowledge、格式與界線）。
 * 拼裝出錯的表現不是崩潰，是**少了一段規則**——而模型會忠實地照少了那段的版本走。
 *
 * 這組測試只驗一件事：該進去的都進去了。
 */

describe("AGENT_SYSTEM_PROMPT", () => {
  it("兩條不能違反的規則都在", () => {
    // 這兩條錯了不是體驗差，是對潛在客戶說了不實的話、或給出做不到的承諾。
    expect(AGENT_SYSTEM_PROMPT).toContain("不可以講成");
    expect(AGENT_SYSTEM_PROMPT).toContain("不給正式報價");
  });

  it("12 種 intent 全部進了提示詞", () => {
    for (const intent of AGENT_INTENTS) {
      expect(AGENT_SYSTEM_PROMPT, `${intent} 沒有進提示詞`).toContain(intent);
    }
  });

  it("六級價格全部進了提示詞", () => {
    // 5B 實測到模型自己編價格，就是因為它讀不到這些數字。
    for (const tier of PRICING_TIERS) {
      expect(AGENT_SYSTEM_PROMPT, `${tier.name} 沒有進提示詞`).toContain(tier.price);
    }
  });

  it("明說回覆是純文字，不要用 Markdown 粗體", () => {
    // 5E 在瀏覽器裡實際看到的問題：模型回了 `**Template Build**`，
    // 而畫面沒有 Markdown 轉譯，那兩個星號原樣出現在對話框裡。
    //
    // 修在提示詞而不是加一個 Markdown 轉譯器：那會把 HTML 帶進
    // 一條目前完全沒有 HTML 的路徑，而 Spec §36 明文禁止 arbitrary HTML。
    expect(AGENT_SYSTEM_PROMPT).toContain("純文字");
    expect(AGENT_SYSTEM_PROMPT).toContain("粗體");
  });

  it("提示詞夠長，會進 prompt cache", () => {
    // Opus 5 的最小可快取前綴是 512 token。中文一字約一 token 以上，
    // 所以字數低於 512 時快取根本不會建立——而且不會有任何錯誤，
    // 只會每次都付全額。
    expect(AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(1_000);
  });
});

describe("initialIntentHint", () => {
  it("認得的情境給一句話，不認得的給 null", () => {
    expect(initialIntentHint("website")).toContain("網站");
    expect(initialIntentHint("template")).toContain("預覽");
    expect(initialIntentHint(undefined)).toBeNull();
    // 不認得的值不該憑空造一句話塞給模型。
    expect(initialIntentHint("某個不存在的情境")).toBeNull();
  });
});
