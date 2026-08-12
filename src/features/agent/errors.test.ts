import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { classifyAgentError } from "./errors";

/**
 * 5A 的出口條件是「逾時、中斷、超額都有明確行為」。
 * 這組測試守的是「明確」那兩個字：每一種上游失敗都要對應到自己的碼，
 * 而不是全部落進同一個籮筐。
 *
 * 用 `Object.create(Prototype)` 而不是呼叫建構子：這裡驗的是
 * `instanceof` 的分派順序，不是 SDK 怎麼組錯誤物件。
 */
const as = <T>(prototype: object, extra: Record<string, unknown> = {}): T =>
  Object.assign(Object.create(prototype) as object, extra) as T;

describe("classifyAgentError", () => {
  it("逾時不會被誤判成一般連線失敗", () => {
    // APIConnectionTimeoutError 是 APIConnectionError 的子類。
    // 判斷順序寫反的話，逾時永遠不會被認出來——
    // 而畫面上會顯示「服務暫時無法回應」，把「太慢」講成「壞了」。
    expect(classifyAgentError(as(Anthropic.APIConnectionTimeoutError.prototype))).toBe("timeout");
  });

  it("限流回 rate_limited", () => {
    expect(classifyAgentError(as(Anthropic.RateLimitError.prototype, { status: 429 }))).toBe(
      "rate_limited",
    );
  });

  it("連線失敗回 upstream_unavailable", () => {
    expect(classifyAgentError(as(Anthropic.APIConnectionError.prototype))).toBe(
      "upstream_unavailable",
    );
  });

  it("5xx 回 upstream_unavailable，4xx 回 invalid_request", () => {
    // 這一條的意義是「該不該重試」。混在一起的話，
    // 我們會對著一個永遠不會成功的 400 一直重試。
    expect(classifyAgentError(as(Anthropic.APIError.prototype, { status: 503 }))).toBe(
      "upstream_unavailable",
    );
    expect(classifyAgentError(as(Anthropic.APIError.prototype, { status: 400 }))).toBe(
      "invalid_request",
    );
  });

  it("完全未知的東西也有碼，不會回傳 undefined", () => {
    expect(classifyAgentError(new Error("誰知道"))).toBe("upstream_unavailable");
    expect(classifyAgentError(null)).toBe("upstream_unavailable");
  });
});
