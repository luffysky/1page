"use client";

import { useId, useState } from "react";

import { WorkshopGate } from "@/components/workshop/workshop-gate";

import type { AgentHandoff } from "@/features/agent/handoff";
import { AGENT_LIMITS } from "@/features/agent/config";
import { useAgentChat } from "@/features/agent/use-agent-chat";
import { track } from "@/lib/analytics/track";

/**
 * AI 顧問對話（Spec §16 / §35 / §37）
 *
 * 取代 1C 的 AgentWorkspaceShell。那個殼存在的理由是「寧可讓按鈕不能按，
 * 也不要讓它假裝會動」——現在它真的會動了，所以殼下架。
 *
 * ── a11y（Spec §35）──────────────────────────────────────────
 *
 * 對話的難處在於**內容是逐字長出來的**。螢幕閱讀器需要知道有新內容，
 * 但每一個字都播報一次會變成無法忍受的噪音。
 * 因此串流中的訊息不放進 live region，串流結束後才整段宣告。
 *
 * ── 字體（Spec §3 / Plan）─────────────────────────────────────
 *
 * 對話一律黑體。宋體只用於 Editorial Heading——
 * 對話框用宋體會像在朗誦民國文學選集。
 */
export function AgentChat({
  initialIntent,
  handoff = null,
  previewDraft,
  onPreviewPatch,
  onLeadContext,
}: {
  initialIntent?: string;
  /** Template Experience 交接過來的設定（Spec §8.15） */
  handoff?: AgentHandoff | null;
  /** 目前的預覽狀態。Agent 要知道現在長什麼樣子才改得動（Spec §21）。
   *  刻意不叫 draft——元件裡的 draft 是輸入框的草稿，兩個混在一起會很難讀。 */
  previewDraft?: Record<string, unknown>;
  /** Agent 改了預覽時呼叫 */
  onPreviewPatch?: (patch: Record<string, unknown>) => void;
  /** Agent 問到需求時呼叫（Spec §30） */
  onLeadContext?: (lead: Record<string, unknown>) => void;
}) {
  const { messages, error, isStreaming, remainingMessages, send, stop } = useAgentChat({
    initialIntent,
    draft: previewDraft,
    onPreviewPatch,
    onLeadContext,
  });

  const [draft, setDraft] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const inputId = useId();

  const atLimit = remainingMessages <= 0;
  const tooLong = draft.length > AGENT_LIMITS.maxMessageChars;
  const canSend = draft.trim().length > 0 && !isStreaming && !atLimit && !tooLong;

  const submit = () => {
    if (!canSend) return;
    // Spec §31
    track("agent_message_sent", { length: draft.trim().length });
    void send(draft);
    setDraft("");
  };

  return (
    <div className="border-brand-line bg-brand-paper font-sans rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-heading-2">一頁 AI 顧問</p>
          <p className="text-caption text-brand-muted mt-1">
            有邊界的自由對話，不是免費 ChatGPT 分店。
          </p>
        </div>
        <p className="border-brand-line text-caption text-brand-muted rounded-pill border px-3 py-1.5">
          還可以送 {remainingMessages} 則
        </p>
      </div>

      {handoff ? (
        <dl className="border-brand-line bg-brand-bg mt-5 grid gap-x-6 gap-y-2 rounded-lg border p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <p className="text-caption text-brand-muted">已從 Template Experience 帶入</p>
          </div>
          <div>
            <dt className="text-caption text-brand-muted">品牌名稱</dt>
            <dd className="text-body-sm mt-0.5">{handoff.config.brand.name}</dd>
          </div>
          <div>
            <dt className="text-caption text-brand-muted">產業</dt>
            <dd className="text-body-sm mt-0.5">{handoff.config.brand.industry ?? "未填"}</dd>
          </div>
          <div>
            <dt className="text-caption text-brand-muted">區塊</dt>
            <dd className="text-body-sm mt-0.5">{handoff.config.sections.length} 個</dd>
          </div>
        </dl>
      ) : null}

      {/*
       * 訊息串。
       *
       * `role="log"` + `aria-live="polite"`：新訊息會被宣告，但不會打斷
       * 使用者正在聽的內容。串流中的那一則以 aria-busy 標記，
       * 讓輔助技術知道「這段還沒完」，不要現在就唸。
       */}
      {/*
       * ⚠️ log 與 list 是**兩層**，不是同一個元素。
       *
       * 第一版寫成 `<ol role="log">`，那會把 ol 的隱含 list 角色蓋掉，
       * 於是裡面的 li 變成「不在清單裡的清單項目」——
       * axe 直接判 serious。role 覆寫掉的東西不會有任何提示，
       * 是 a11y 掃描才抓出來的。
       */}
      <div role="log" aria-live="polite" aria-label="與 AI 顧問的對話">
        <ol className="mt-6 flex flex-col gap-2.5">
          {messages.length === 0 ? (
            <li className="text-body-sm text-brand-muted">
              直接說你想做什麼。你不用先知道該買哪個方案。
            </li>
          ) : null}

          {messages.map((message, index) => (
            <li
              key={index}
              aria-busy={message.streaming ? true : undefined}
              className={
                message.role === "assistant"
                  ? "border-brand-line bg-brand-bg text-body-sm max-w-[88%] self-start rounded-lg rounded-bl-sm border p-3.5 whitespace-pre-wrap"
                  : "bg-brand-ink text-brand-on-ink text-body-sm max-w-[88%] self-end rounded-lg rounded-br-sm p-3.5 whitespace-pre-wrap"
              }
            >
              <span className="sr-only">{message.role === "assistant" ? "AI 顧問：" : "你："}</span>
              {message.content}
              {message.streaming && message.content.length === 0 ? "…" : null}
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        /*
         * 錯誤用 role="alert" 即時宣告——它不是對話內容，
         * 而且不講的話使用者只會看到回覆停住，以為是自己網路的問題。
         */
        <p
          role="alert"
          className="border-brand-accent-strong text-body-sm mt-4 rounded-lg border-l-2 py-1 pl-3"
        >
          {error.message}
        </p>
      ) : null}

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          描述你的需求
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            value={draft}
            disabled={atLimit}
            maxLength={AGENT_LIMITS.maxMessageChars}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={atLimit ? "這段對話已達則數上限" : "例如：我開咖啡店，只有 IG 和照片"}
            className="border-brand-line text-body-sm w-full rounded-md border px-4 py-3"
          />

          {isStreaming ? (
            // 停止是一個真的動作：它會中止上游的請求，不只是不再顯示。
            // 少了這顆按鈕，使用者唯一的中止方式是關掉分頁，而那時 token 還在燒。
            <button
              type="button"
              onClick={stop}
              className="border-brand-ink text-body-sm rounded-pill border px-5 py-3 font-bold whitespace-nowrap"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="bg-brand-accent-strong text-brand-on-accent text-body-sm rounded-pill px-5 py-3 font-bold whitespace-nowrap disabled:opacity-50"
            >
              問 AI 顧問
            </button>
          )}
        </div>

        <div className="border-brand-line mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
          {/*
           * Spec §23 的界線做成一個看得到的入口，而不是等訪客撞牆。
           * 撞牆的版本是：他要求「幫我把文案寫好」，AI 說不行，
           * 而他不知道那件事到底能不能做、要多少錢。
           */}
          <p className="text-body-sm text-brand-muted">想讓 AI 直接開始排版面、寫文案？</p>
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            className="border-brand-ink text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink border px-4 py-2 font-bold transition-colors"
          >
            看 Website Workshop
          </button>
        </div>

        <WorkshopGate open={gateOpen} onClose={() => setGateOpen(false)} />

        <p className="text-caption text-brand-muted mt-2">
          {tooLong
            ? `太長了，請縮短到 ${AGENT_LIMITS.maxMessageChars} 字以內。`
            : `單則上限 ${AGENT_LIMITS.maxMessageChars} 字。這是免費的顧問對話，需要時會請真人接手。`}
        </p>
      </form>
    </div>
  );
}
