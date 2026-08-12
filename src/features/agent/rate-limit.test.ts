import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, requestIdentifier, resetRateLimits } from "./rate-limit";

/**
 * 匿名速率限制（Spec §36 / §37）
 *
 * 這是全站唯一一個「每次被呼叫都要付錢」的端點前面的閘門。
 * 它壞掉的表現不是網站掛掉，是月底的帳單。
 */

const rules = [
  { windowMs: 1_000, max: 2 },
  { windowMs: 10_000, max: 3 },
];

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("額度內放行，超過就擋", () => {
    const now = 1_000_000;

    expect(checkRateLimit("a", rules, now).allowed).toBe(true);
    expect(checkRateLimit("a", rules, now).allowed).toBe(true);
    expect(checkRateLimit("a", rules, now).allowed).toBe(false);
  });

  it("不同來源各自計數", () => {
    // 一個人打滿不該讓其他人也送不出去。
    const now = 1_000_000;

    checkRateLimit("a", rules, now);
    checkRateLimit("a", rules, now);
    checkRateLimit("a", rules, now);

    expect(checkRateLimit("b", rules, now).allowed).toBe(true);
  });

  it("短視窗過了會恢復", () => {
    // 長視窗刻意給足額度，否則測到的是長視窗擋下來，
    // 而不是「短視窗恢復了」——第一版就是這樣寫錯的。
    const roomy = [
      { windowMs: 1_000, max: 2 },
      { windowMs: 10_000, max: 10 },
    ];
    const now = 1_000_000;

    checkRateLimit("a", roomy, now);
    checkRateLimit("a", roomy, now);
    expect(checkRateLimit("a", roomy, now).allowed).toBe(false);

    expect(checkRateLimit("a", roomy, now + 1_500).allowed).toBe(true);
  });

  it("長視窗擋得住「慢慢刷」", () => {
    // 只有短視窗的話，每分鐘打滿也能一天打幾千次。
    // 這裡每次都等短視窗過去，但長視窗仍然會攔下來。
    const start = 1_000_000;

    expect(checkRateLimit("a", rules, start).allowed).toBe(true);
    expect(checkRateLimit("a", rules, start + 2_000).allowed).toBe(true);
    expect(checkRateLimit("a", rules, start + 4_000).allowed).toBe(true);
    expect(checkRateLimit("a", rules, start + 6_000).allowed).toBe(false);
  });

  it("被擋時說得出還要等幾秒", () => {
    // 「請稍後再試」而不說多久，使用者只能一直重按——
    // 而每一次重按都會再撞一次限制。
    const now = 1_000_000;

    checkRateLimit("a", rules, now);
    checkRateLimit("a", rules, now);
    const blocked = checkRateLimit("a", rules, now);

    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("requestIdentifier", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("https://example.test/api/agent", { headers });

  it("優先採用 x-forwarded-for 的第一個位址", () => {
    expect(requestIdentifier(withHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  it("退回 x-real-ip", () => {
    expect(requestIdentifier(withHeaders({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("完全拿不到位址時所有人共用一份額度，而不是所有人都不受限", () => {
    // 這是刻意的取捨。共用額度的最壞情況是「太嚴」；
    // 每個請求各給一份新額度的最壞情況是限流形同虛設，
    // 而且不會有任何跡象——直到帳單來。
    const a = requestIdentifier(withHeaders({}));
    const b = requestIdentifier(withHeaders({}));

    expect(a).toBe(b);
  });
});
