/**
 * Analytics call site（Spec §31 / Plan §7）
 *
 * Phase 1 只留呼叫點，實作為 no-op。接供應商是 Phase 7 的事。
 * 事件名稱先定好，之後換的是傳輸層，不是散落各處的呼叫。
 *
 * ⚠️ `/_dev/*` 不得發送任何事件（Plan §11 C.1）——
 * 開發路由是工具，不是產品內容。
 */

/** Spec §31 列出的事件 */
export type AnalyticsEvent =
  | "hero_cta_clicked"
  | "goal_selected"
  | "portfolio_viewed"
  | "portfolio_filtered"
  | "portfolio_project_opened"
  | "portfolio_live_demo_clicked"
  | "agent_opened"
  | "agent_message_sent"
  | "template_viewed"
  | "template_switched"
  | "theme_switched"
  | "preview_device_switched"
  | "template_to_agent_clicked"
  | "preview_modified"
  | "workshop_gate_shown"
  | "workshop_cta_clicked"
  | "lead_started"
  | "lead_submitted"
  | "pricing_viewed";

export function track(event: AnalyticsEvent, payload?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;

  // 開發路由不上報（Plan §11 C.1）
  if (window.location.pathname.startsWith("/_dev/")) return;

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, payload ?? {});
  }

  // Phase 7 在此接上供應商。
}
