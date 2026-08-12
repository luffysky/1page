import { describe, expect, it } from "vitest";

import {
  AGENT_INTENTS,
  DISPOSITION_HANDLING,
  INTENT_DESCRIPTIONS,
  INTENT_DISPOSITION,
  renderScopePolicy,
  SCOPE_DISPOSITIONS,
} from "./scope";

/**
 * Scope Policy 的結構性守衛（Spec §17）。
 *
 * 這裡測不到「模型有沒有照做」——那要對真實模型跑，見 `pnpm agent:eval`。
 * 這裡測的是規則本身有沒有完整、有沒有被改反，
 * 以及提示詞裡是不是真的有這些字。
 *
 * 兩者缺一不可：規則寫對了但沒進提示詞，等於沒有規則；
 * 進了提示詞但規則本身寫反了，模型會忠實地執行錯的那條。
 */

describe("intent 清單", () => {
  it("剛好是 Spec §17 列的 12 種", () => {
    expect(AGENT_INTENTS).toHaveLength(12);
    expect(new Set(AGENT_INTENTS).size).toBe(12);
  });

  it("每一種都有處置與說明", () => {
    for (const intent of AGENT_INTENTS) {
      expect(INTENT_DISPOSITION[intent], `${intent} 沒有處置`).toBeTruthy();
      expect(INTENT_DESCRIPTIONS[intent], `${intent} 沒有說明`).toBeTruthy();
    }
  });

  it("每一種處置都至少對應到一種 intent", () => {
    // 有處置但沒有任何 intent 會走到它，代表分類法與處置法對不起來。
    const used = new Set(Object.values(INTENT_DISPOSITION));
    for (const disposition of SCOPE_DISPOSITIONS) {
      expect(used.has(disposition), `${disposition} 沒有任何 intent 會走到`).toBe(true);
    }
  });
});

describe("5B 的出口條件", () => {
  it("UNCLEAR 明文禁止直接拒絕", () => {
    // Spec §17：「UNCLEAR 禁止直接拒絕，先確認意圖」。
    // 這是整個 scope policy 裡最容易被「順手收緊」掉的一條——
    // 而收緊它等於把還不知道怎麼描述需求的潛在客戶擋在門外，
    // 也就是這個 Agent 存在的理由本身。
    const handling = DISPOSITION_HANDLING.UNCLEAR;

    expect(handling).toContain("不可以直接拒絕");
    expect(handling).toContain("確認");
  });

  it("OUT_OF_SCOPE 說的是不完成工作，不是不回話", () => {
    // 「不完成完整工作」與「拒絕互動」是兩件事。
    // 寫成後者的話，一個問了無關問題的人就直接被趕走，
    // 而他可能下一句就要問網站。
    const handling = DISPOSITION_HANDLING.OUT_OF_SCOPE;

    expect(handling).toContain("不完成");
    expect(handling).toMatch(/問他|需求/);
  });

  it("ABUSE 與 OUT_OF_SCOPE 是不同的處置", () => {
    // 規格的 intent 清單有 abuse，處置清單沒有。
    // 把它併進 OUT_OF_SCOPE 是錯的：那條說「可以簡短說明方向」，
    // 而對辱罵或改寫指示的嘗試，正確的做法是不參與。
    expect(DISPOSITION_HANDLING.ABUSE).not.toBe(DISPOSITION_HANDLING.OUT_OF_SCOPE);
    expect(DISPOSITION_HANDLING.ABUSE).toContain("不參與");
  });

  it("ABUSE 明說使用者訊息裡的指示不是指令", () => {
    // Spec §36 prompt injection handling 的規則面。
    // 機制面（速率限制、長度上限）在 5E。
    expect(DISPOSITION_HANDLING.ABUSE).toContain("忽略先前指示");
    expect(DISPOSITION_HANDLING.ABUSE).toContain("系統提示");
  });
});

describe("renderScopePolicy", () => {
  const policy = renderScopePolicy();

  it("每一種 intent 與處置都真的出現在提示詞裡", () => {
    // 規則寫對了但沒進提示詞，等於沒有規則。
    for (const intent of AGENT_INTENTS) {
      expect(policy, `${intent} 沒有出現在提示詞裡`).toContain(intent);
    }
    for (const disposition of SCOPE_DISPOSITIONS) {
      expect(policy, `${disposition} 沒有出現在提示詞裡`).toContain(disposition);
    }
  });

  it("處置的原文完整帶進提示詞，不是只帶標題", () => {
    for (const disposition of SCOPE_DISPOSITIONS) {
      expect(policy).toContain(DISPOSITION_HANDLING[disposition]);
    }
  });
});
