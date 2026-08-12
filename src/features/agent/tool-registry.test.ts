import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AgentToolRegistry,
  defineTool,
  FORBIDDEN_TOOL_PATTERNS,
  toolResult,
} from "./tool-registry";
import { AGENT_TOOL_DEFINITIONS, AGENT_TOOLS } from "./tools";

/**
 * 6A 出口條件：
 *   「白名單之外的工具不可呼叫；禁止 shell / code execution /
 *     raw query / arbitrary web search（Spec §20）。」
 */

describe("Spec §20 白名單", () => {
  it("沒有任何一個工具是被明文禁止的能力", () => {
    // 「禁止」在這裡的意思是**根本沒有實作**，不是「有但擋住」。
    // 沒有的東西不會因為提示詞被繞過就冒出來。
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      for (const pattern of FORBIDDEN_TOOL_PATTERNS) {
        expect(pattern.test(tool.name), `${tool.name} 命中禁止清單 ${pattern}`).toBe(false);
      }
    }
  });

  it("工具名稱不重複", () => {
    const names = AGENT_TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("同名工具在建構時就炸掉，不是等到某次對話才發現", () => {
    const duplicate = defineTool({
      name: "same",
      tier: "free",
      description: "x",
      input: z.object({}),
      run: () => toolResult({}),
    });

    expect(() => new AgentToolRegistry([duplicate, duplicate])).toThrow();
  });

  it("叫不存在的工具會拿到錯誤，不是靜靜地什麼都沒發生", async () => {
    const result = await AGENT_TOOLS.execute("run_shell", {}, {}, "free");

    expect(result.isError).toBe(true);
    expect(result.content).toContain("沒有名為");
  });
});

describe("Spec §22：schema 就是驗證器", () => {
  it("送給模型的 JSON Schema 由 zod 產生，不是另外手寫的", () => {
    // 手寫兩份的結果是它們會分岔：schema 說可以傳任意字串、
    // zod 只收列舉裡的那幾個，於是模型照 schema 傳了一個被拒絕的值，
    // 而它看不出自己哪裡錯了。
    const registry = new AgentToolRegistry([
      defineTool({
        name: "probe",
        tier: "free",
        description: "測試用",
        input: z.object({
          mode: z.enum(["a", "b"]),
          note: z.string().max(10).optional(),
        }),
        run: () => toolResult({}),
      }),
    ]);

    const [spec] = registry.specs("free");
    const properties = spec!.input_schema.properties as Record<string, { enum?: string[] }>;

    expect(properties.mode?.enum).toEqual(["a", "b"]);
    expect(spec!.input_schema.required).toEqual(["mode"]);
    // $schema 對模型沒有用途，只佔 token——而工具定義每次請求都會送一遍。
    expect(spec!.input_schema.$schema).toBeUndefined();
  });

  it("參數不合 schema 時，錯誤訊息講得出哪一個欄位", async () => {
    const result = await AGENT_TOOLS.execute("set_theme", { theme: "不存在的風格" }, {}, "free");

    expect(result.isError).toBe(true);
    expect(result.content).toContain("theme");
  });
});

describe("Spec §23：免費與付費的分界", () => {
  it("免費身分拿不到 Workshop 的工具", () => {
    const free = AGENT_TOOLS.specs("free").map((spec) => spec.name);

    expect(free).toContain("set_theme");
    // Section 編輯是「開始產生成果」，屬於付費階段。
    expect(free).not.toContain("add_section");
    expect(free).not.toContain("update_section_content");
  });

  it("付費身分拿得到全部，不會反而少功能", () => {
    const workshop = AGENT_TOOLS.specs("workshop").map((spec) => spec.name);

    expect(workshop).toContain("set_theme");
    expect(workshop).toContain("add_section");
    expect(workshop.length).toBeGreaterThan(AGENT_TOOLS.specs("free").length);
  });

  it("就算猜到名字，免費身分也執行不了 Workshop 工具", async () => {
    // 「模型看不到」不是權限控制——它可能從別處學到名字。
    const result = await AGENT_TOOLS.execute("add_section", {}, {}, "free");

    expect(result.isError).toBe(true);
    expect(result.content).toContain("Workshop");
  });

  it("重設預覽留在免費階段", () => {
    // 訪客把預覽調成自己不喜歡的樣子之後沒有回頭路，是很糟的體驗，
    // 而那與付不付費無關。
    expect(AGENT_TOOLS.specs("free").map((spec) => spec.name)).toContain("reset_preview");
  });
});
