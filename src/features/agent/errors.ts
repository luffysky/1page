import Anthropic from "@anthropic-ai/sdk";

import type { AgentErrorCode } from "./config";

/**
 * 上游例外 → 我們自己的錯誤碼。
 *
 * ⚠️ 用 SDK 的型別化例外類別，**不比對錯誤訊息字串**。
 * 訊息文字會隨 SDK 版本改寫，而字串比對壞掉時不會有人發現——
 * 它不會報錯，只是靜靜地把所有東西都歸進「其他」那一類，
 * 然後每一種失敗在畫面上都顯示同一句話。
 *
 * 順序由具體到一般：`APIConnectionTimeoutError` 是
 * `APIConnectionError` 的子類，反過來寫的話逾時永遠不會被認出來。
 */
export function classifyAgentError(error: unknown): AgentErrorCode {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.APIConnectionError) return "upstream_unavailable";

  if (error instanceof Anthropic.APIError) {
    // 5xx 是對方的問題，重試有意義；4xx 是我們送錯了，重試一百次也一樣。
    return error.status && error.status >= 500 ? "upstream_unavailable" : "invalid_request";
  }

  return "upstream_unavailable";
}
