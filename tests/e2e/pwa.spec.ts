import { expect, test } from "@playwright/test";

/**
 * PWA 那一半有沒有真的接上（0818 收尾稽核）
 *
 * ── 為什麼需要這一組 ──────────────────────────────────────────
 *
 * 收尾清查時發現：`layout.tsx` 宣告了 `appleWebApp: { capable: true }`，
 * 而整個專案沒有 `apple-icon`——iOS **不讀 manifest 的 icons**，
 * 使用者「加到主畫面」拿到的會是一張網頁截圖當圖示。
 *
 * 那件事在桌機上完全看不出來，build 也不會說。
 * 這與 `icon-maskable` 那次是同一種錯：第一版寫成 `app/icon-maskable.tsx`，
 * 而慣例只認固定檔名，於是 manifest 指過去直接 404。
 *
 * 宣告了一個東西，卻沒有任何地方接上它——這是同一種病的第五次。
 */

test("manifest 拿得到，而且該有的欄位都在", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);

  const manifest = await response.json();

  // 這五個少任何一個，瀏覽器就不會認為它可安裝
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBeTruthy();
  expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
});

test("⚠️ manifest 指的每一個圖示都真的拿得到", async ({ request }) => {
  /*
   * icon-maskable 踩過：manifest 指向一個不存在的路徑，
   * 而那只有在真機安裝時才看得出來——manifest 本身仍然是合法 JSON。
   */
  const manifest = await (await request.get("/manifest.webmanifest")).json();

  for (const icon of manifest.icons as { src: string; purpose?: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status(), `${icon.src} 拿不到`).toBe(200);
    expect(response.headers()["content-type"], `${icon.src} 不是圖片`).toContain("image/");
  }
});

test("⚠️ maskable 圖示要存在——Android 會把圖示裁成各種形狀", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  const purposes = (manifest.icons as { purpose?: string }[]).map((icon) => icon.purpose ?? "any");

  // 只有 any 的話，Android 會把整張圖塞進遮罩裡，邊角連同內容一起被裁掉
  expect(purposes, "沒有 maskable 圖示").toContain("maskable");
});

test("⚠️ iOS 的 apple-touch-icon 要在", async ({ page, request }) => {
  /*
   * iOS 不讀 manifest 的 icons。少了這一個，「加到主畫面」
   * 拿到的是一張網頁截圖——而宣告 appleWebApp.capable 的意思是
   * 我們說了它可以加到主畫面。
   */
  await page.goto("/");

  const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect(href, "首頁沒有 apple-touch-icon").toBeTruthy();

  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/");
});

test("theme-color 與 manifest 一致", async ({ page, request }) => {
  // 兩邊不一致的話，安裝後的狀態列顏色與啟動畫面會是兩個顏色
  await page.goto("/");
  const meta = await page.locator('meta[name="theme-color"]').first().getAttribute("content");
  const manifest = await (await request.get("/manifest.webmanifest")).json();

  expect(meta?.toLowerCase()).toBe(String(manifest.theme_color).toLowerCase());
});
