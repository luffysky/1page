"use client";

import { useId, useState } from "react";

import { DEMO_ASSISTANT_NOTICE } from "@/features/agent/demo-notice";
import { useAgentChat } from "@/features/agent/use-agent-chat";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { site } from "@/features/website-engine/site-classes";

/**
 * 模板內的 AI 客服體驗（CR-003）
 *
 * 訪客可以真的跟「被預覽的那間店」講話。用途是讓潛在客戶知道
 * 「我的網站可以有這個」——講一百句不如讓他打一句試試。
 *
 * ── 三件刻意的事 ──────────────────────────────────────────────
 *
 * 1. **用被預覽網站的顏色，不是我們的。** 整個元件只用 `site.*`
 *    （`--site-*` 變數），一個 `--color-brand-*` 都沒有。
 *    它是在示範「你的網站上的客服長什麼樣子」，不是我們的介面。
 *
 * 2. **必須看得出是示範。** 讓人以為在跟一間真的店講話、之後才發現店是假的，
 *    會讓他連帶懷疑這個網站上其他東西的真假。
 *
 * 3. **與顧問是兩個對話。** 同一頁上兩個對話框，
 *    這個扮演客戶的店，那個是我們的業務。標題要讓人分得出來。
 */
export function PreviewAssistant() {
  const { draft, config } = useSitePreview();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputId = useId();

  const { messages, error, isStreaming, send } = useAgentChat({
    mode: "demo",
    draft: { ...draft },
  });

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    void send(input);
    setInput("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${site.accentBg} ${site.onAccent} ${site.radius} ${site.body} absolute right-4 bottom-4 px-4 py-2.5 text-sm font-bold shadow-lg`}
      >
        跟{config.brand.name}的客服聊聊
      </button>
    );
  }

  return (
    <div
      className={`${site.surface} ${site.text} ${site.radius} ${site.body} absolute right-4 bottom-4 flex w-[min(22rem,calc(100%-2rem))] flex-col shadow-xl`}
    >
      <div className={`${site.border} flex items-start justify-between gap-3 border-b p-3.5`}>
        <div>
          <p className={`${site.heading} text-sm font-bold`}>{config.brand.name} 客服</p>
          <p className={`${site.muted} mt-0.5 text-xs`}>{DEMO_ASSISTANT_NOTICE}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="關閉客服對話"
          className="text-sm"
        >
          ✕
        </button>
      </div>

      <div role="log" aria-live="polite" aria-label={`${config.brand.name} 客服對話`}>
        <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3.5 text-sm">
          {messages.length === 0 ? (
            <li className={site.muted}>試著問問營業時間、有什麼商品，或任何你想問這間店的事。</li>
          ) : null}

          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === "assistant"
                  ? `${site.bg} ${site.radius} max-w-[90%] self-start p-2.5 whitespace-pre-wrap`
                  : `${site.accentBg} ${site.onAccent} ${site.radius} max-w-[90%] self-end p-2.5 whitespace-pre-wrap`
              }
            >
              <span className="sr-only">{message.role === "assistant" ? "客服：" : "你："}</span>
              {message.content || (message.streaming ? "…" : "")}
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <p role="alert" className={`${site.muted} px-3.5 pb-2 text-xs`}>
          {error.message}
        </p>
      ) : null}

      <form
        className={`${site.border} flex gap-2 border-t p-3`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          問這間店
        </label>
        <input
          id={inputId}
          value={input}
          maxLength={200}
          onChange={(event) => setInput(event.target.value)}
          placeholder="想問什麼？"
          className={`${site.border} ${site.radius} ${site.text} w-full border bg-transparent px-2.5 py-1.5 text-sm`}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className={`${site.accentBg} ${site.onAccent} ${site.radius} px-3 py-1.5 text-sm font-bold disabled:opacity-50`}
        >
          送出
        </button>
      </form>
    </div>
  );
}
