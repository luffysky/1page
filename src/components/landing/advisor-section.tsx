"use client";

import { AgentWorkspaceShell } from "@/components/agent/agent-workspace-shell";
import { useAgentHandoff } from "@/features/agent/handoff";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Agent CTA 是 Goal Selector 必須同步的四處之一（Plan §6.1）。
 *
 * 若直接把 server 端的 goal 傳進 Shell，使用者切換 goal 時這一區不會更新，
 * 同步就少了一處。goal-aware 的邏輯放在 landing/（頁面組裝層），
 * Shell 本身維持純殼、不認識 Home Context。
 *
 * 4D 起這裡多接一條線：Template Experience 交接過來的 SiteConfig。
 * 同樣的分工——組裝層知道兩邊的存在，Shell 只認得自己的 props。
 */
export function AdvisorSection() {
  const { goal, definition } = useHomeGoal();
  const { handoff } = useAgentHandoff();

  return (
    <div className="flex flex-col gap-4">
      {handoff ? (
        <p className="text-body-sm text-brand-muted">
          已帶入你剛才在上面調好的設定，不用重講一次。
        </p>
      ) : (
        <p className="text-body-sm text-brand-muted">
          目前會以「{definition.label}」的情境開場（initialIntent：
          <code className="font-mono">{definition.agentInitialIntent}</code>）。
        </p>
      )}
      <AgentWorkspaceShell initialIntent={goal} handoff={handoff} />
    </div>
  );
}
