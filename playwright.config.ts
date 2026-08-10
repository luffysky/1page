import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

// 測試行程本身也要讀 .env.local。
// 少了這行，需要 ADMIN_SEGMENT 的後台安全測試會「靜默跳過」——
// 測試報告全綠，但那幾條根本沒跑過。

/**
 * Gate 第 5 項「visual review」的載體。
 *
 * 只負責『產生』截圖供人工檢視，不做 pixel diff——Phase 1 版面仍在變動，
 * 像素比對只會製造噪音（見 Implementation Plan §9）。
 *
 * 以 dev server 啟動，因為 /_dev/* 在非開發環境會回 404（見 Plan §11 C）。
 */
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  testDir: "./tests",
  // 只收 *.spec.ts。預設的 testMatch 也吃 *.test.ts，
  // 那會讓裸跑 `playwright test` 去載 vitest 的單元測試然後炸掉。
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results",
  reporter: [["list"]],
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
