import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getPortfolioRepository()` 的環境判斷。
 *
 * 這組測試是為了一次真實的部署失敗而寫的：
 * 第一版在 production 缺設定時無條件拋錯，結果 `next build` 預先產生
 * `/sitemap.xml` 時撞上它，Zeabur 部署整個掛掉。
 *
 * 建置期拋錯擋掉的不是「展示假資料」，而是「部署本身」——那是過度反應。
 * 需要守住的是執行期：使用者實際看到的畫面。
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PHASE;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function load() {
  return import("./index");
}

describe("有 Supabase 設定時", () => {
  it("一律使用 Supabase 實作", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("NODE_ENV", "production");

    const { getPortfolioRepository } = await load();
    const { supabasePortfolioRepository } = await import("./supabase-repository");

    expect(getPortfolioRepository()).toBe(supabasePortfolioRepository);
  });
});

describe("缺少 Supabase 設定時", () => {
  it("development 退回種子資料並警告", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getPortfolioRepository } = await load();
    const { inMemoryPortfolioRepository } = await import("./in-memory-repository");

    expect(getPortfolioRepository()).toBe(inMemoryPortfolioRepository);
    expect(warn).toHaveBeenCalled();
  });

  it("production 執行期拋錯——絕不對訪客展示不存在的作品", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { getPortfolioRepository } = await load();
    expect(() => getPortfolioRepository()).toThrow(/production 執行期缺少 Supabase 設定/);
  });

  it("production 建置期不拋錯，退回種子資料", async () => {
    // 迴歸測試：Zeabur 部署因此失敗過一次。
    // 建置容器沒有資料庫設定是正常的，不該讓部署掛掉；
    // 那些種子內容也不會出現在使用者面前，因為呈現作品的路由都是動態渲染。
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getPortfolioRepository } = await load();
    const { inMemoryPortfolioRepository } = await import("./in-memory-repository");

    expect(() => getPortfolioRepository()).not.toThrow();
    expect(getPortfolioRepository()).toBe(inMemoryPortfolioRepository);
  });
});
