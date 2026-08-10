import { defineConfig } from "@playwright/test";

/**
 * Gate 第 5 項「visual review」的載體。
 *
 * 只負責『產生』截圖供人工檢視，不做 pixel diff——Phase 1 版面仍在變動，
 * 像素比對只會製造噪音（見 Implementation Plan §9）。
 *
 * 以 dev server 啟動，因為 /_dev/* 在非開發環境會回 404（見 Plan §11 C）。
 */
export default defineConfig({
  testDir: "./tests",
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
