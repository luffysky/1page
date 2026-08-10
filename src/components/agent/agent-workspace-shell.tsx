"use client";

import type { HomeGoal } from "@/config/home-goals";

/**
 * Agent Workspace Shell（Spec §16）
 *
 * ⚠️ 這是「殼」。聊天區為靜態範例訊息，輸入框 disabled。
 * Agent 對話邏輯、Intent Router、Conversation Policy 全部屬於 Phase 5。
 *
 * 【禁止假互動】不得用 setTimeout 假裝 AI 在回覆——
 * V3 Demo 就是這樣做的，那會讓人誤以為 Agent 已經可用。
 *
 * 字體注意：Agent 對話一律使用黑體（--font-sans）。
 * 宋體只用於 Editorial Heading；對話框用宋體會像在朗誦民國文學選集。
 */

interface SampleMessage {
  from: "ai" | "user";
  text: string;
}

const SAMPLE_THREAD: SampleMessage[] = [
  { from: "ai", text: "嗨，直接告訴我你想做什麼。你不用先知道該買哪個方案。" },
  { from: "user", text: "我想幫一家甜點店做網站，要有質感但不要太黑。" },
  {
    from: "ai",
    text: "這類需求很適合先從一頁式開始。免費階段可以先聊方向與適合的方案；要我實際排 Section、寫文案並操作網站，就會進入 Website Workshop。",
  },
];

export function AgentWorkspaceShell({ initialIntent }: { initialIntent: HomeGoal }) {
  return (
    <div className="border-brand-line bg-brand-paper rounded-xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-heading-2">一頁 AI 顧問</p>
          <p className="text-caption text-brand-muted mt-1">
            有邊界的自由對話，不是免費 ChatGPT 分店。
          </p>
        </div>
        <p className="border-brand-line text-caption text-brand-muted rounded-pill border px-3 py-1.5">
          initialIntent: {initialIntent}
        </p>
      </div>

      <ol className="mt-6 flex flex-col gap-2.5">
        {SAMPLE_THREAD.map((message, index) => (
          <li
            key={index}
            className={
              message.from === "ai"
                ? "border-brand-line bg-brand-bg text-body-sm max-w-[88%] self-start rounded-lg rounded-bl-sm border p-3.5"
                : "bg-brand-ink text-brand-on-ink text-body-sm max-w-[88%] self-end rounded-lg rounded-br-sm p-3.5"
            }
          >
            {message.text}
          </li>
        ))}
      </ol>

      <fieldset disabled className="mt-6 opacity-55">
        <legend className="text-caption text-brand-muted mb-2.5">對話功能於 Phase 5 啟用</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="agent-shell-input">
            描述你的需求
          </label>
          <input
            id="agent-shell-input"
            placeholder="例如：我開咖啡店，只有 IG 和照片"
            className="border-brand-line text-body-sm w-full rounded-md border px-4 py-3"
          />
          <button
            type="button"
            className="bg-brand-accent text-brand-on-accent text-body-sm rounded-pill px-5 py-3 font-bold whitespace-nowrap"
          >
            問 AI 顧問
          </button>
        </div>
      </fieldset>
    </div>
  );
}
