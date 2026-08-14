import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * next/image 認不認得我們自己的媒體網域
 *
 * ── 為什麼需要這一條 ──────────────────────────────────────────
 *
 * `next/image` 對外部主機是**白名單**制：不在 `images.remotePatterns`
 * 裡的網域，它不會退回去畫一張普通的 img，而是直接丟例外
 * 「hostname is not configured under images」——整頁 500。
 *
 * `r2.ts` 有一個 `allowedImageHosts()`，註解寫著「供 next.config 與測試取得」，
 * 而 next.config **從來沒有呼叫它**。同時 portfolio-layout.tsx 用的是
 * `<Image src={item.cover.url}>`，src 正是 R2 的公開網址。
 *
 * 這件事一直沒爆是因為 `portfolio_media` 一筆資料都沒有。
 * 上傳第一張封面的那一刻 `/work` 就會壞掉——而那時看起來會像是
 * 「上傳功能有問題」，不是「一年前的設定漏了一行」。
 *
 * 又是同一種毛病：宣告了一個東西，卻沒有任何地方用到它。
 *
 * ── 為什麼用假的環境變數，而不是讀 .env.local ─────────────────
 *
 * 這條要驗的是**兩邊出自同一個來源**，不是「今天的 .env 剛好填了什麼」。
 * 讀真實設定的話，在沒有 R2 設定的環境裡 allowedImageHosts() 回空陣列，
 * 「每一個網域都在白名單裡」就會空洞地通過——一個名不副實的綠燈。
 */

const R2_ENV = {
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-key",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
  NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL: "media.example.test",
  NEXT_PUBLIC_R2_PUBLIC_URL: "https://legacy.r2.dev",
};

async function loadWithR2Env() {
  vi.resetModules();
  for (const [key, value] of Object.entries(R2_ENV)) vi.stubEnv(key, value);

  const [{ allowedImageHosts }, { default: nextConfig }] = await Promise.all([
    import("@/config/image-sources"),
    import("../../next.config"),
  ]);

  const patterns = nextConfig.images?.remotePatterns ?? [];
  const configured = patterns.map((pattern) =>
    typeof pattern === "string" ? pattern : (pattern.hostname ?? ""),
  );

  return { allowedImageHosts, configured };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("next/image 的遠端來源白名單", () => {
  it("每一個媒體網域都在 remotePatterns 裡", async () => {
    const { allowedImageHosts, configured } = await loadWithR2Env();

    // 先確認前提成立，否則下面那句會空洞地通過
    expect(allowedImageHosts().length, "假環境沒被讀到，這條驗不到東西").toBe(2);

    const missing = allowedImageHosts().filter((hostname) => !configured.includes(hostname));
    expect(missing, `這些網域上的圖片會讓頁面直接 500：${missing.join("、")}`).toEqual([]);
  });

  it("白名單只放我們自己的網域", async () => {
    /*
     * 反過來也要對。remotePatterns 放寬到別人的網域，等於讓任何能寫入
     * SiteConfig 的人（Agent、匯入的草稿）叫我們的伺服器去代抓那張圖，
     * 而請求是從我們的機器發出去的。
     */
    const { allowedImageHosts, configured } = await loadWithR2Env();
    const allowed = allowedImageHosts();

    expect(configured.filter((hostname) => !allowed.includes(hostname))).toEqual([]);
  });
});
