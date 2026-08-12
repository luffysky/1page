import { z } from "zod";

import type { SiteConfig } from "@/features/website-engine/schema";
import type { SiteDraft } from "@/features/website-engine/templates";

/**
 * Tool Registry（Spec §20 白名單 / §22 schema validation / §23 免費付費邊界）
 *
 * ── 為什麼要有這一層 ──────────────────────────────────────────
 *
 * 5C 的工具是「定義一份 JSON schema 給模型看，另外寫一份 zod 驗證輸入」。
 * 那是兩份會分岔的東西：schema 說 category 可以是任意字串、
 * zod 只收列舉裡的那幾個，於是模型照 schema 傳了一個合法但被拒絕的值，
 * 而它看不出自己哪裡錯了。
 *
 * 這裡只留一份：**zod schema 就是給模型看的那一份**，
 * JSON Schema 由 `z.toJSONSchema()` 產生。分岔在結構上不可能發生。
 *
 * ── 白名單 ────────────────────────────────────────────────────
 *
 * 「白名單」的意思是模型只拿得到這裡列出的能力。
 * Spec §20 明文禁止的（shell、code execution、raw query、任意網路搜尋）
 * 不是「有但擋住」，而是**根本沒有實作**——沒有的東西不會因為
 * 提示詞被繞過就冒出來。`tool-registry.test.ts` 守著這件事。
 */

export type AgentToolTier = "free" | "workshop";

/**
 * 要套用到訪客預覽上的變更（Spec §21）。
 *
 * `reset` 是一個旗標而不是一組值：還原成什麼，取決於當下是哪一套模板，
 * 而那個知識在 client（它有 template registry）。server 算一份送過去，
 * 就等於在兩個地方各有一份「原始樣子」的定義。
 */
export type PreviewPatch = Partial<SiteDraft> & { reset?: true };

export interface AgentToolResult {
  content: string;
  isError: boolean;
  /** 有值時，route 會把它串流給 client 套用到預覽上 */
  patch?: PreviewPatch;
}

/**
 * 工具執行時能看到的東西。
 *
 * ⚠️ 刻意很小。工具拿得到的越多，一個寫錯的工具能造成的破壞就越大。
 * 需要什麼再加什麼，而且要說得出為什麼。
 */
export interface AgentToolContext {
  /**
   * 訪客目前的預覽狀態（Spec §21）。
   *
   * 由 client 隨請求送上來，不是 server 存的——預覽的唯一狀態在瀏覽器裡
   * （見 website-engine/preview-context.tsx）。server 存一份就會有兩份，
   * 而兩份可變狀態一定會分歧。
   */
  // Partial：client 送上來的 draft 每個欄位都可能缺，
  // 而工具要能在資訊不全的情況下運作——缺什麼就不用什麼。
  draft?: Partial<SiteDraft>;

  /**
   * 完整的 SiteConfig。只有付費的 Workshop 流程會提供（Phase 7）——
   * 免費階段沒有「一份正在編輯的網站」，只有一份由 draft 算出來的預覽。
   */
  config?: SiteConfig;
}

export interface AgentToolDefinition<Schema extends z.ZodType = z.ZodType> {
  name: string;
  /**
   * Spec §23：聊天免費，開始產生成果時收費。
   *
   *   free      免費顧問就能用：查資料、推薦、調整預覽的品牌與風格
   *   workshop  付費 Website Workshop 才能用：實際編輯網站結構與文案
   *
   * 分級寫在工具上而不是靠呼叫端記得篩選——
   * 忘了篩的表現是「免費就拿到了付費功能」，而那不會有任何錯誤訊息。
   */
  tier: AgentToolTier;
  description: string;
  input: Schema;
  run: (
    input: z.infer<Schema>,
    context: AgentToolContext,
  ) => Promise<AgentToolResult> | AgentToolResult;
}

/** 保留泛型參數，讓 run 的 input 型別能從 schema 推導出來 */
export function defineTool<Schema extends z.ZodType>(
  definition: AgentToolDefinition<Schema>,
): AgentToolDefinition<Schema> {
  return definition;
}

/**
 * Spec §20 明文禁止的能力。
 *
 * 這份清單只有一個用途：測試。它不是執行期的過濾器——
 * 執行期的保證來自「沒有實作」，而不是「有實作但擋住」。
 */
export const FORBIDDEN_TOOL_PATTERNS = [
  /shell/i,
  /\bexec\b/i,
  /code_execution/i,
  /raw_query/i,
  /\bsql\b/i,
  /web_search/i,
  /\bfetch_url\b/i,
] as const;

export function toolResult(payload: unknown): AgentToolResult {
  return { content: JSON.stringify(payload), isError: false };
}

export function toolError(message: string): AgentToolResult {
  return { content: JSON.stringify({ error: message }), isError: true };
}

/* ------------------------------------------------------------------ */
/* 組裝                                                                */
/* ------------------------------------------------------------------ */

/** 送給模型的形狀。`input_schema` 由 zod 產生，不是另外手寫的 */
export interface AnthropicToolSpec {
  name: string;
  description: string;
  // `type: "object"` 是 SDK 型別要求的欄位，而 z.toJSONSchema 本來就會產出它——
  // 明確寫進型別，讓「schema 不是物件」在編譯期就擋下來。
  input_schema: { type: "object"; [key: string]: unknown };
}

export function toAnthropicTool(definition: AgentToolDefinition): AnthropicToolSpec {
  // io: "input" —— 我們要的是「模型該送什麼進來」的形狀，
  // 不是「驗證後會變成什麼」。有預設值的欄位兩者不同。
  const schema = z.toJSONSchema(definition.input, { io: "input" }) as Record<string, unknown>;

  // $schema 對模型沒有用途，只佔 token；而工具定義會出現在每一次請求裡。
  delete schema.$schema;

  return {
    name: definition.name,
    description: definition.description,
    input_schema: { ...schema, type: "object" },
  };
}

export class AgentToolRegistry {
  private readonly byName: Map<string, AgentToolDefinition>;

  constructor(private readonly definitions: readonly AgentToolDefinition[]) {
    this.byName = new Map(definitions.map((tool) => [tool.name, tool]));

    if (this.byName.size !== definitions.length) {
      // 同名工具會讓後面的覆蓋前面的，而覆蓋掉的那個從此不會被呼叫。
      // 這是啟動時就該炸掉的錯，不是等到某次對話才發現。
      throw new Error("工具名稱重複");
    }
  }

  list(tier: AgentToolTier): AgentToolDefinition[] {
    // free 只拿 free；workshop 拿全部——付費了不會反而少功能。
    return this.definitions.filter((tool) => tier === "workshop" || tool.tier === "free");
  }

  specs(tier: AgentToolTier): AnthropicToolSpec[] {
    return this.list(tier).map(toAnthropicTool);
  }

  /**
   * 執行。
   *
   * ⚠️ 三種情況都回傳 `isError` 的結果，**都不拋例外**：
   * 名字不在白名單、參數不合 schema、執行時出錯。
   * 拋出去的話整輪對話會斷在半路，而使用者看到的是回覆突然停住。
   */
  async execute(
    name: string,
    input: unknown,
    context: AgentToolContext,
    tier: AgentToolTier,
  ): Promise<AgentToolResult> {
    const tool = this.byName.get(name);

    if (!tool) {
      // 模型偶爾會發明工具名。要讓它知道那個工具不存在，
      // 而不是靜靜地什麼都沒發生。
      return toolError(`沒有名為 ${name} 的工具`);
    }

    if (tier === "free" && tool.tier !== "free") {
      // Spec §23。這條在正常情況不會走到——free 的模型根本看不到這個工具——
      // 但「模型看不到」不是權限控制，它可能猜到名字。
      return toolError(`${name} 需要 Website Workshop，免費階段不提供`);
    }

    const parsed = tool.input.safeParse(input);
    if (!parsed.success) {
      // 把 zod 的訊息帶回去。模型看得到哪裡不對才改得動，
      // 只說「參數不正確」它只會原樣再送一次。
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("；");
      return toolError(`參數不正確 —— ${detail}`);
    }

    try {
      return await tool.run(parsed.data, context);
    } catch {
      return toolError("執行時發生問題，這次沒有結果");
    }
  }
}
