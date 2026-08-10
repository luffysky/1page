import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
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
