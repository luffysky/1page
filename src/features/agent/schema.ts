import { z } from "zod";

import { ACCENT_IDS, THEME_IDS } from "@/features/website-engine/templates";

import { AGENT_LIMITS, type AgentErrorCode } from "./config";

/**
 * Agent 請求與串流事件的形狀（Spec §36 Zod validation）
 *
 * ⚠️ `/api/agent` 是**公開端點**，任何人都能對它送任何東西。
 * 這裡是它唯一的把關點——與 SiteConfig 的 schema 是同一個角色：
 * 型別無法表達不合法的值。
 */

export const agentRoleSchema = z.enum(["user", "assistant"]);

export const agentMessageSchema = z.object({
  role: agentRoleSchema,
  content: z
    .string()
    .trim()
    .min(1, "訊息不可空白")
    .max(AGENT_LIMITS.maxMessageChars, "單則訊息過長"),
});

export type AgentMessage = z.infer<typeof agentMessageSchema>;

export const agentRequestSchema = z
  .object({
    messages: z
      .array(agentMessageSchema)
      .min(1, "至少要有一則訊息")
      .max(AGENT_LIMITS.maxMessages, "訊息則數超過上限"),
    /**
     * 開場情境（Spec §6 `openAgent({ initialIntent })`）。
     *
     * 這是**對話的起始種子**，不是 Spec §17 的 AgentIntent 分類。
     * 兩者恰好都叫 intent，5B 實作分類器時不可混用。
     */
    initialIntent: z.string().max(40).optional(),

    /**
     * 訪客目前的預覽狀態（Spec §21）。
     *
     * 由 client 隨請求送上來，server 不存——預覽的唯一狀態在瀏覽器裡。
     * server 也存一份的話就有兩份可變狀態，而兩份一定會分歧，
     * 表現是「AI 說改好了，畫面沒動」。
     *
     * 全部選填：沒有預覽的情境（例如未來從別的入口開對話）也要能用。
     */
    draft: z
      .object({
        templateId: z.string().max(64).optional(),
        // 用真的列舉而不是任意字串：這份 draft 會直接進工具的 context，
        // 而工具會照它決定要不要沿用目前的主題。收一個不存在的主題 id，
        // 錯誤會在很後面才出現。
        themeId: z.enum(THEME_IDS).optional(),
        accentId: z.enum(ACCENT_IDS).optional(),
        brandName: z.string().max(120).optional(),
        industry: z.string().max(80).optional(),
      })
      .optional(),
  })
  .refine((value) => value.messages[value.messages.length - 1]?.role === "user", {
    message: "最後一則必須是使用者訊息",
    path: ["messages"],
  })
  .refine(
    (value) =>
      value.messages.reduce((total, message) => total + message.content.length, 0) <=
      AGENT_LIMITS.maxConversationChars,
    { message: "整段對話超過預算", path: ["messages"] },
  );

export type AgentRequest = z.infer<typeof agentRequestSchema>;

/* ------------------------------------------------------------------ */
/* 串流協定                                                            */
/* ------------------------------------------------------------------ */

/**
 * NDJSON：一行一個事件。
 *
 * 為什麼不是 SSE：這條路徑必須是 POST（對話內容放在 body，不放網址），
 * 而瀏覽器的 `EventSource` 只支援 GET。既然無論如何都要用
 * `fetch` + ReadableStream 自己讀，那就沒有理由再套一層 SSE 的框格式。
 *
 * ⚠️ `error` 事件與 HTTP 錯誤是**兩條不同的路徑**：
 * 串流一旦開始，狀態碼已經送出去了，之後的失敗只能以事件形式送達。
 * 兩條都必須帶 code——這就是「不是無聲失敗」的具體意思。
 */
export type AgentStreamEvent =
  | { type: "delta"; text: string }
  /** Agent 改了預覽（Spec §21）。client 收到後套用到同一個 preview context */
  | { type: "preview"; patch: Record<string, unknown> }
  /** Agent 問到的需求（Spec §30）。client 存起來讓 /start 不用重填 */
  | { type: "lead"; lead: Record<string, unknown> }
  | { type: "done"; stopReason: string | null; outputTokens: number }
  | { type: "error"; code: AgentErrorCode; message: string };

export function encodeStreamEvent(event: AgentStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * 解析一段串流文字，回傳完整的事件與尚未收完的殘餘。
 *
 * 呼叫端負責把殘餘接到下一塊前面——網路切塊不會剛好落在換行上，
 * 少了這一步就會偶發地漏字，而且只在特定長度的回覆上重現。
 */
export function decodeStreamChunk(buffer: string): {
  events: AgentStreamEvent[];
  rest: string;
} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: AgentStreamEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as AgentStreamEvent);
    } catch {
      // 壞掉的一行就跳過。整段對話因為一行壞資料而中斷，
      // 比少顯示那一行糟糕得多。
    }
  }

  return { events, rest };
}
