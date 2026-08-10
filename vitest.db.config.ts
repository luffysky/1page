import { config } from "dotenv";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

// RLS 測試需要真實資料庫連線，故與單元測試分開執行（pnpm test:db）。
// 不併入 pnpm test 是刻意的：安全測試若因缺少環境而靜默跳過，
// 會產生「測試全綠所以邊界沒問題」的錯覺。
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      /*
       * server-only 是給 Next 建置期用的防護：client component 誤引用
       * 伺服器端模組時直接編譯失敗。它的預設入口會在非 react-server 環境
       * 主動拋錯，因此在測試中別名成空模組。
       *
       * 這不是繞過保護——保護的對象是 app 的建置，不是測試執行環境。
       */
      "server-only": resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
