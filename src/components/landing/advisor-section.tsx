"use client";

import { AgentWorkspaceShell } from "@/components/agent/agent-workspace-shell";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Agent CTA 是 Goal Selector 必須同步的四處之一（Plan §6.1）。
 *
 * 若直接把 server 端的 goal 傳進 Shell，使用者切換 goal 時這一區不會更新，
 * 同步就少了一處。goal-aware 的邏輯放在 landing/（頁面組裝層），
 * Shell 本身維持純殼、不認識 Home Context。
 */
export function AdvisorSection() {
  const { goal, definition } = useHomeGoal();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-brand-muted">
        目前會以「{definition.label}」的情境開場（initialIntent：
        <code className="font-mono">{definition.agentInitialIntent}</code>）。
      </p>
      <AgentWorkspaceShell initialIntent={goal} />
    </div>
  );
}
