/**
 * Analytics（Spec §31 / Plan §7）
 *
 * ── 7C 換的是傳輸層，不是散落各處的呼叫 ──────────────────────
 *
 * Phase 1 就把呼叫點放好、實作留 no-op，理由在這一段兌現了：
 * 現在接上傳輸只改這一個檔案，十九個呼叫點一行都不用動。
 * 反過來做的話——先用某家供應商的 SDK，之後要換就得回去改每一處，
 * 而漏掉的那幾處會靜靜地繼續送到舊的地方。
 *
 * ── 為什麼沒有綁定任何一家供應商 ──────────────────────────────
 *
 * 目前還沒有選定的分析服務。與其先裝一套 SDK 佔著位置，
 * 不如送到一個**自己的端點**：設了 `NEXT_PUBLIC_ANALYTICS_ENDPOINT`
 * 就送，沒設就什麼都不做。之後不論選誰，換的是那個端點後面的東西。
 *
 * ⚠️ `/_dev/*` 不上報（Plan §11 C.1）——開發路由是工具，不是產品內容。
 * 混進去的話，看到的數字裡有一部分是我們自己在測東西。
 */

/** Spec §31 列出的事件。一個不多一個不少 */
export const ANALYTICS_EVENTS = [
  "hero_cta_clicked",
  "goal_selected",
  "portfolio_viewed",
  "portfolio_filtered",
  "portfolio_project_opened",
  "portfolio_live_demo_clicked",
  "agent_opened",
  "agent_message_sent",
  "template_viewed",
  "template_switched",
  "theme_switched",
  "preview_device_switched",
  "template_to_agent_clicked",
  "preview_modified",
  "workshop_gate_shown",
  "workshop_cta_clicked",
  "lead_started",
  "lead_submitted",
  "pricing_viewed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsPayload = Record<string, string | number | boolean>;

const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();

export function track(event: AnalyticsEvent, payload?: AnalyticsPayload) {
  if (typeof window === "undefined") return;

  // 開發路由不上報（Plan §11 C.1）
  if (window.location.pathname.startsWith("/_dev/")) return;

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, payload ?? {});
  }

  if (!endpoint) return;

  const body = JSON.stringify({
    event,
    ...payload,
    path: window.location.pathname,
    // 時間由 client 帶，因為 sendBeacon 可能在關閉分頁之後才真的送出去——
    // 用收到的時間記，「離開頁面」那一類事件會全部擠在同一秒。
    at: new Date().toISOString(),
  });

  try {
    /*
     * sendBeacon 而非 fetch：它在頁面正在卸載時仍然會送出去，
     * 而最重要的幾個事件（點了 CTA 就跳走、送出表單）正好都發生在那個瞬間。
     * 用 fetch 的話，那些事件會在導覽開始時被瀏覽器取消——
     * 而且不會有任何錯誤，數字就只是偏低。
     */
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch(endpoint, { method: "POST", body, keepalive: true }).catch(() => {
      // 分析送不出去不該影響使用者手上的操作。
    });
  } catch {
    // 同上。這是全站最不重要的一條路徑，它不可以讓任何東西壞掉。
  }
}
