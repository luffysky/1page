"use client";

import { useCallback, useRef, useState } from "react";

import { AGENT_ERROR_MESSAGES, AGENT_LIMITS, type AgentErrorCode } from "./config";
import { decodeStreamChunk, type AgentMessage } from "./schema";

/**
 * Agent 對話的狀態（Spec §16 / §36）
 *
 * 邏輯放在 hook、畫面放在元件，是因為這裡真正難的部分是**串流與中止**，
 * 而那與 JSX 無關。分開之後這段可以單獨測，不用先渲染一個對話框。
 */

export interface ChatMessage extends AgentMessage {
  /** 串流中的助理訊息。用來決定要不要顯示游標與停止鈕 */
  streaming?: boolean;
}

export interface AgentChatState {
  messages: ChatMessage[];
  /** 目前的錯誤。null 代表沒有錯誤——不是「錯誤訊息是空字串」 */
  error: { code: AgentErrorCode; message: string } | null;
  isStreaming: boolean;
  /** 還能送幾則。到 0 時輸入框關閉，並說明為什麼 */
  remainingMessages: number;
  send: (text: string) => Promise<void>;
  stop: () => void;
}

export function useAgentChat(
  options: {
    initialIntent?: string;
    /** advisor（預設）或 demo（模板內的客服體驗，CR-003） */
    mode?: "advisor" | "demo";
    /** 目前的預覽狀態。Agent 需要知道現在長什麼樣子才改得動（Spec §21） */
    draft?: Record<string, unknown>;
    /** Agent 改了預覽時呼叫。套用的動作由呼叫端做——狀態的擁有者是 preview context */
    onPreviewPatch?: (patch: Record<string, unknown>) => void;
    /** Agent 問到的需求（Spec §30）。呼叫端負責存起來讓 /start 帶入 */
    onLeadContext?: (lead: Record<string, unknown>) => void;
  } = {},
): AgentChatState {
  const { initialIntent, draft, mode, onPreviewPatch, onLeadContext } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<AgentChatState["error"]>(null);
  const [isStreaming, setStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((current) =>
      current.map((message) => (message.streaming ? { ...message, streaming: false } : message)),
    );
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || abortRef.current) return;

      setError(null);

      // 先把使用者的訊息放上去，再送出。
      // 等回應才顯示的話，按下送出到畫面有反應之間會有一段空白，
      // 那段空白讓人以為沒送出去，於是再按一次。
      const outgoing: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(outgoing);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: outgoing.map(({ role, content: value }) => ({ role, content: value })),
            ...(initialIntent ? { initialIntent } : {}),
            ...(draft ? { draft } : {}),
            ...(mode ? { mode } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as {
            code?: AgentErrorCode;
            message?: string;
          } | null;

          const code = payload?.code ?? "upstream_unavailable";
          setError({ code, message: payload?.message ?? AGENT_ERROR_MESSAGES[code] });
          return;
        }

        setMessages((current) => [...current, { role: "assistant", content: "", streaming: true }]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          // 殘餘要接到下一塊前面——網路切塊不會剛好落在換行上。
          const chunk = decodeStreamChunk(buffer + decoder.decode(value, { stream: true }));
          buffer = chunk.rest;

          for (const event of chunk.events) {
            if (event.type === "delta") {
              setMessages((current) => {
                const next = [...current];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: last.content + event.text };
                }
                return next;
              });
            } else if (event.type === "preview") {
              // 預覽的變更立刻套用，不等這一輪講完——
              // 等講完的話，訪客會先讀到「我幫你換成暖色調了」，
              // 然後盯著沒動的畫面等一兩秒。
              onPreviewPatch?.(event.patch);
            } else if (event.type === "lead") {
              onLeadContext?.(event.lead);
            } else if (event.type === "error") {
              // 串流中的錯誤不會清掉已經收到的字：那些內容仍然有用。
              // 錯誤另外顯示，讓人知道後面沒有了。
              setError({ code: event.code, message: event.message });
            }
          }
        }
      } catch (cause) {
        // 使用者自己按停止的，不是錯誤。
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError({
            code: "upstream_unavailable",
            message: AGENT_ERROR_MESSAGES.upstream_unavailable,
          });
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setMessages((current) =>
          current.map((message) =>
            message.streaming ? { ...message, streaming: false } : message,
          ),
        );
      }
    },
    [draft, initialIntent, messages, mode, onLeadContext, onPreviewPatch],
  );

  return {
    messages,
    error,
    isStreaming,
    // 上限是整段對話的則數，含助理的回覆——與 server 的檢查同一份數字。
    remainingMessages: Math.max(0, AGENT_LIMITS.maxMessages - messages.length),
    send,
    stop,
  };
}
