import "server-only";

import { AGENT_RATE_LIMITS } from "./config";

/**
 * 匿名速率限制（Spec §36 rate limiting / §37 Anonymous Agent Limits）
 *
 * ── 這是什麼、不是什麼 ────────────────────────────────────────
 *
 * 這是**單一實例的記憶體計數器**。它擋得住的是最常見的那一種濫用：
 * 一個人（或一支腳本）從一個 IP 連續打，把我們的帳單推上去。
 *
 * 它擋不住的：多台實例各自計數（每台各放行一份額度）、
 * 換 IP 重來、實例重啟後歸零。
 *
 * 選它而不是 Redis 或資料庫計數器，是因為 V1 只有一個容器在跑，
 * 而多一個外部依賴就多一個會掛掉的東西——那時的表現會是
 * 「限流服務掛了，所以整個 Agent 不能用」。等真的水平擴充時再換，
 * 屆時這個模組的介面不用動。
 *
 * ⚠️ 這件事寫在待辦裡。上線前若改成多實例，這裡必須跟著換。
 */

export interface RateLimitResult {
  allowed: boolean;
  /** 還剩幾次（本視窗內） */
  remaining: number;
  /** 幾秒後恢復 */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** 記憶體不能無限長大。每次檢查順手掃掉過期的 key，不另外開計時器 */
function sweep(now: number) {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  identifier: string,
  rules: readonly RateLimitRule[] = AGENT_RATE_LIMITS,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  let allowed = true;
  let remaining = Number.POSITIVE_INFINITY;
  let retryAfterSeconds = 0;

  for (const [index, rule] of rules.entries()) {
    const key = `${identifier}:${index}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      remaining = Math.min(remaining, rule.max - 1);
      continue;
    }

    bucket.count += 1;

    if (bucket.count > rule.max) {
      allowed = false;
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((bucket.resetAt - now) / 1000));
    }

    remaining = Math.min(remaining, Math.max(0, rule.max - bucket.count));
  }

  return { allowed, remaining, retryAfterSeconds };
}

/** 測試用。正式路徑不會呼叫——狀態歸零的權力不該存在於請求處理中 */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * 取得請求方的識別。
 *
 * 依序看反向代理的標頭，最後退回一個共用的 key。
 *
 * ⚠️ 退回共用 key 是刻意的：拿不到 IP 時**所有人共用一份額度**，
 * 而不是每個人都不受限。前者的最壞情況是「太嚴」，
 * 後者的最壞情況是限流形同虛設——而且不會有人發現。
 */
export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
