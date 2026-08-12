import {
  AGENT_EFFORT,
  AGENT_ERROR_MESSAGES,
  AGENT_LIMITS,
  AGENT_MODEL,
  type AgentErrorCode,
} from "@/features/agent/config";
import { classifyAgentError } from "@/features/agent/errors";
import { agentRequestSchema, encodeStreamEvent } from "@/features/agent/schema";
import { AGENT_SYSTEM_PROMPT, initialIntentHint } from "@/features/agent/system-prompt";
import { getAnthropicClient } from "@/lib/ai/anthropic";

/**
 * `POST /api/agent` — AI 顧問的串流端點（Spec §16 / §36）
 *
 * 5A 的出口條件：**逾時、中斷、超額都有明確行為，不是無聲失敗。**
 *
 * 失敗有兩條路徑，兩條都必須帶錯誤碼：
 *
 *   串流開始前 → HTTP 狀態碼 + JSON body（前端能用 response.ok 判斷）
 *   串流開始後 → NDJSON 的 error 事件（狀態碼已經送出去了，改不了）
 *
 * 沒有第三條路。任何「就這樣停住」的分支都是這個檔案的 bug。
 */

// 串流回應不可被快取，也不該被靜態化。
export const dynamic = "force-dynamic";

function errorResponse(code: AgentErrorCode, status: number): Response {
  return Response.json(
    { code, message: AGENT_ERROR_MESSAGES[code] },
    // 錯誤回應也不可被快取。這條路徑的內容因請求而異
    // （「太長」是針對這一次的輸入說的），被中間層存起來之後，
    // 下一個人會拿到與自己無關的那句話。
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const client = getAnthropicClient();
  if (!client) {
    // 「還沒接上」與「壞掉了」是兩件事，回不同的碼。
    // 503 而非 500：這不是程式出錯，是這個環境還沒設定金鑰。
    return errorResponse("not_configured", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", 400);
  }

  const parsed = agentRequestSchema.safeParse(body);
  if (!parsed.success) {
    // 把 zod 的失敗對應到具體的碼，讓前端能說出「太長」還是「太多則」，
    // 而不是一句籠統的「格式不正確」。
    const issues = parsed.error.issues.map((issue) => issue.message);
    const code: AgentErrorCode = issues.some((message) => message.includes("超過預算"))
      ? "conversation_exhausted"
      : issues.some((message) => message.includes("則數"))
        ? "too_many_messages"
        : issues.some((message) => message.includes("過長"))
          ? "message_too_long"
          : "invalid_request";

    return errorResponse(code, 400);
  }

  const { messages, initialIntent } = parsed.data;
  const hint = initialIntentHint(initialIntent);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeStreamEvent>[0]) => {
        controller.enqueue(encoder.encode(encodeStreamEvent(event)));
      };

      try {
        const upstream = client.beta.messages.stream(
          {
            model: AGENT_MODEL,
            max_tokens: AGENT_LIMITS.maxOutputTokens,
            output_config: { effort: AGENT_EFFORT },
            /*
             * 安全分類器擋下請求時，改由另一個模型回答，而不是把拒絕丟給訪客。
             * "default" 讓 Anthropic 依拒絕的類別自動挑替代模型——
             * 自己指定一個型號的話，那個型號將來停用時我們得再改一次。
             */
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: [
              {
                type: "text",
                text: AGENT_SYSTEM_PROMPT,
                // 系統提示每一次請求都一樣，快取它。
                // 讀取只要約一成的價格，而這段會出現在每一則訊息上。
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              // 開場情境放在快取點之後：它隨 goal 變動，
              // 寫進系統提示會讓每種 goal 各自成為一份不同的快取前綴。
              ...(hint ? [{ role: "user" as const, content: hint }] : []),
              ...messages,
            ],
          },
          {
            // 訪客關掉分頁或按了停止 → 上游一起中止。
            // 少了這一行，使用者已經走了，token 還在燒。
            signal: request.signal,
          },
        );

        upstream.on("text", (text) => {
          send({ type: "delta", text });
        });

        const final = await upstream.finalMessage();

        if (final.stop_reason === "refusal") {
          send({ type: "error", code: "refused", message: AGENT_ERROR_MESSAGES.refused });
        } else if (final.stop_reason === "max_tokens") {
          // 截斷是一種失敗，但前面已經送出去的內容仍然有用，
          // 所以不是丟掉重來，是把「這段話沒講完」講出來。
          send({ type: "error", code: "truncated", message: AGENT_ERROR_MESSAGES.truncated });
        }

        send({
          type: "done",
          stopReason: final.stop_reason,
          outputTokens: final.usage.output_tokens,
        });
      } catch (error) {
        // 訪客自己中止的，不是錯誤，也沒有人在聽了。
        if (request.signal.aborted) {
          controller.close();
          return;
        }

        const code = classifyAgentError(error);
        send({ type: "error", code, message: AGENT_ERROR_MESSAGES[code] });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // 有些反向代理會緩衝串流回應，表現是「等很久然後一次全部出現」。
      "X-Accel-Buffering": "no",
    },
  });
}
