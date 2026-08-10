import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      /*
       * server-only 的預設入口在非 react-server 環境會主動拋錯。
       * 它保護的是 app 的建置（client component 誤引用伺服器模組時編譯失敗），
       * 測試執行環境不需要，故別名成空模組。這不是繞過保護。
       */
      "server-only": resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    // 預設 node：契約測試只是讀檔比對，不需要 DOM。
    // 需要 DOM 的檔案於檔首標註 `// @vitest-environment jsdom`，
    // 避免所有測試都付出建立 jsdom 的成本。
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
  },
});
