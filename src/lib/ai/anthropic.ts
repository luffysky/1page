import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { AGENT_LIMITS } from "@/features/agent/config";

/**
 * Anthropic client（Spec §16）
 *
 * ⚠️ `ANTHROPIC_API_KEY` 沒有 `NEXT_PUBLIC_` 前綴，也絕不可以加。
 * 那把鑰匙等同於一張可以無限刷的帳單；出現在瀏覽器端的 JS 裡，
 * 任何人都能拿去用，而帳單記在我們頭上。
 *
 * `server-only` 讓「不小心從 client component 引用」在**建置時**就失敗，
 * 而不是等到某次部署後才發現金鑰躺在 chunk 裡。
 */

let client: Anthropic | null = null;

/**
 * 取得 client。**沒有設定金鑰時回傳 null，不是拋錯也不是假裝可用。**
 *
 * 這是刻意的：呼叫端要能區分「AI 服務出問題」與「這個環境還沒接上 AI」，
 * 前者該重試，後者重試一百次也一樣。訪客看到的訊息也不同。
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  client ??= new Anthropic({
    apiKey,
    // TypeScript SDK 的 timeout 單位是毫秒（Python 是秒，別照抄）。
    timeout: AGENT_LIMITS.requestTimeoutMs,
    // 預設會重試 2 次。對串流對話來說那代表使用者要等三倍的時間才知道失敗，
    // 而 429／5xx 在這個情境下重試一次就夠了。
    maxRetries: 1,
  });

  return client;
}

export function isAgentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
