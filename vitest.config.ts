import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 1A 的測試皆為靜態契約檢查（讀檔比對），不需要 DOM。
    // React Testing Library / axe 於 1C、1E 需要時才引入，避免安裝未使用的相依。
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
  },
});
