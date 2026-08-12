"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { SiteConfig } from "@/features/website-engine/types";

/**
 * Template Experience → Agent 的交接（Spec §8.15）
 *
 * > Template Experience 底部固定提供：
 * >   「想讓 AI 幫你調整？」→ openAgent({ initialIntent: "template", siteConfig })
 * > 訪客在此累積的 SiteConfig 必須能無損傳入 Agent 與 Project Builder，
 * > 不可要求訪客重新選一次。
 *
 * ── 為什麼是獨立的 context，不併進 SitePreviewProvider ────────
 *
 * 「訪客現在在調的那份設定」與「他決定要交給 Agent 的那份設定」是兩件事。
 * 併在一起的話，他打開 Agent 之後再回去改預覽，Agent 手上的東西會跟著變——
 * 那不是交接，那是共用一個可變狀態。交接的意思是**在那個時間點的快照**。
 *
 * Phase 5 接真的 Agent 時，換掉的是消費端，這個介面不動。
 */

export interface AgentHandoff {
  /** Spec §8.15 的 `initialIntent`。目前唯一的來源是 template experience */
  intent: "template";
  /** 整份設定，不是摘要。無損的意思就是這個 */
  config: SiteConfig;
}

interface AgentHandoffValue {
  handoff: AgentHandoff | null;
  openAgent: (handoff: AgentHandoff) => void;
  clear: () => void;
}

const AgentHandoffContext = createContext<AgentHandoffValue | null>(null);

export function AgentHandoffProvider({ children }: { children: React.ReactNode }) {
  const [handoff, setHandoff] = useState<AgentHandoff | null>(null);

  const value = useMemo<AgentHandoffValue>(
    () => ({
      handoff,
      // 直接存下傳進來的 config。不做欄位挑選——
      // 只挑「Agent 現在用得到的欄位」的話，Phase 5 加一個新欄位時
      // 會在這裡靜默遺失，而表現是「Agent 忘記了訪客選過的東西」。
      openAgent: setHandoff,
      clear: () => setHandoff(null),
    }),
    [handoff],
  );

  return <AgentHandoffContext.Provider value={value}>{children}</AgentHandoffContext.Provider>;
}

export function useAgentHandoff(): AgentHandoffValue {
  const context = useContext(AgentHandoffContext);
  if (!context) {
    throw new Error("useAgentHandoff 必須在 <AgentHandoffProvider> 之內使用");
  }
  return context;
}
