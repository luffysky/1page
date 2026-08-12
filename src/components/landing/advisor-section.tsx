"use client";

import { AgentChat } from "@/components/agent/agent-chat";
import { useAgentHandoff } from "@/features/agent/handoff";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Agent CTA 是 Goal Selector 必須同步的四處之一（Plan §6.1）。
 *
 * goal-aware 的邏輯放在 landing/（頁面組裝層），
 * 對話元件本身不認識 Home Context——它只收 props。
 *
 * 4D 起這裡多接一條線：Template Experience 交接過來的 SiteConfig。
 * 同樣的分工——組裝層知道兩邊的存在，元件只認得自己的 props。
 */
export function AdvisorSection() {
  const { definition } = useHomeGoal();
  const { handoff } = useAgentHandoff();

  return (
    <div className="flex flex-col gap-4">
      {handoff ? (
        <p className="text-body-sm text-brand-muted">
          已帶入你剛才在上面調好的設定，不用重講一次。
        </p>
      ) : (
        <p className="text-body-sm text-brand-muted">目前會以「{definition.label}」的情境開場。</p>
      )}

      <AgentChat
        // 交接過來的對話從 template 情境開場（Spec §8.15），
        // 否則照 Goal Selector 選的那個。
        initialIntent={handoff ? handoff.intent : definition.agentInitialIntent}
        handoff={handoff}
      />
    </div>
  );
}
