import { config } from "dotenv";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

// RLS 測試需要真實資料庫連線，故與單元測試分開執行（pnpm test:db）。
// 不併入 pnpm test 是刻意的：安全測試若因缺少環境而靜默跳過，
// 會產生「測試全綠所以邊界沒問題」的錯覺。
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
