import type Anthropic from "@anthropic-ai/sdk";

import {
  AGENT_EFFORT,
  AGENT_ERROR_MESSAGES,
  AGENT_LIMITS,
  AGENT_MODEL,
  type AgentErrorCode,
} from "@/features/agent/config";
import { classifyAgentError } from "@/features/agent/errors";
import { checkRateLimit, requestIdentifier } from "@/features/agent/rate-limit";
import { agentRequestSchema, encodeStreamEvent } from "@/features/agent/schema";
import { AGENT_SYSTEM_PROMPT, initialIntentHint } from "@/features/agent/system-prompt";
import { AGENT_TOOLS } from "@/features/agent/tools";
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

function errorResponse(
  code: AgentErrorCode,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { code, message: AGENT_ERROR_MESSAGES[code] },
    // 錯誤回應也不可被快取。這條路徑的內容因請求而異
    // （「太長」是針對這一次的輸入說的），被中間層存起來之後，
    // 下一個人會拿到與自己無關的那句話。
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const client = getAnthropicClient();
  if (!client) {
    // 「還沒接上」與「壞掉了」是兩件事，回不同的碼。
    // 503 而非 500：這不是程式出錯，是這個環境還沒設定金鑰。
    return errorResponse("not_configured", 503);
  }

  /*
   * 速率限制放在**驗證之前**（Spec §36）。
   *
   * 直覺上會想先驗格式再限流，但那是錯的：一支狂送格式錯誤請求的腳本
   * 一樣佔用連線與 CPU，而且完全不受限——限流只在「請求合法」時才生效的話，
   * 攻擊者只要故意送壞的就能繞過。
   */
  const limit = checkRateLimit(requestIdentifier(request));
  if (!limit.allowed) {
    return errorResponse("rate_limited", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
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

  const { messages, initialIntent, draft } = parsed.data;
  const hint = initialIntentHint(initialIntent);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeStreamEvent>[0]) => {
        controller.enqueue(encoder.encode(encodeStreamEvent(event)));
      };

      /*
       * 對話串。工具輪次會往這裡追加，因此它是 let 而非 const。
       *
       * 開場情境放在快取點之後：它隨 goal 變動，
       * 寫進系統提示會讓每種 goal 各自成為一份不同的快取前綴。
       */
      const thread: Anthropic.Beta.BetaMessageParam[] = [
        ...(hint ? [{ role: "user" as const, content: hint }] : []),
        ...messages,
      ];

      try {
        let outputTokens = 0;

        /*
         * 工具迴圈。
         *
         * ⚠️ 上限不是防呆，是**成本上限**。沒有上限的話，
         * 一次「模型呼叫工具 → 看了結果又呼叫 → 再呼叫」的來回
         * 可以無限跑下去，而每一輪都是一次完整的請求。
         * 到達上限時把話講出來，不是靜靜地停住。
         */
        for (let round = 0; ; round += 1) {
          if (round >= AGENT_LIMITS.maxToolRounds) {
            send({
              type: "error",
              code: "tool_loop",
              message: AGENT_ERROR_MESSAGES.tool_loop,
            });
            break;
          }

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
              // 免費階段只拿得到 free 分級的工具（Spec §23）。
              // 分級由 registry 過濾，不靠這裡記得篩。
              tools: AGENT_TOOLS.specs("free"),
              system: [
                {
                  type: "text",
                  text: AGENT_SYSTEM_PROMPT,
                  // 系統提示每一次請求都一樣，快取它。
                  // 讀取只要約一成的價格，而這段會出現在每一則訊息上。
                  cache_control: { type: "ephemeral" },
                },
              ],
              messages: thread,
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
          outputTokens += final.usage.output_tokens;

          if (final.stop_reason === "refusal") {
            send({ type: "error", code: "refused", message: AGENT_ERROR_MESSAGES.refused });
          } else if (final.stop_reason === "max_tokens") {
            // 截斷是一種失敗，但前面已經送出去的內容仍然有用，
            // 所以不是丟掉重來，是把「這段話沒講完」講出來。
            send({ type: "error", code: "truncated", message: AGENT_ERROR_MESSAGES.truncated });
          }

          if (final.stop_reason !== "tool_use") {
            send({ type: "done", stopReason: final.stop_reason, outputTokens });
            break;
          }

          // 整段 content 原樣接回去，不是只接文字——
          // tool_use 區塊掉了的話，下一輪的 tool_result 就對不到它的 id。
          thread.push({ role: "assistant", content: final.content });

          const calls = final.content.filter((block) => block.type === "tool_use");

          // 平行執行，但**所有結果放進同一則 user 訊息**。
          // 拆成多則會讓模型慢慢學會不要一次呼叫多個工具。
          const executed = await Promise.all(
            calls.map(async (call) => ({
              call,
              result: await AGENT_TOOLS.execute(call.name, call.input, { draft }, "free"),
            })),
          );

          for (const { result } of executed) {
            // 預覽的變更立刻送出去，不等這一輪講完（Spec §21）。
            // 等講完才更新的話，訪客會先讀到「我幫你換成暖色調了」，
            // 然後盯著沒動的畫面等一兩秒。
            if (result.patch) send({ type: "preview", patch: result.patch });
          }

          thread.push({
            role: "user",
            content: executed.map(({ call, result }) => ({
              type: "tool_result" as const,
              tool_use_id: call.id,
              content: result.content,
              is_error: result.isError,
            })),
          });
        }
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
