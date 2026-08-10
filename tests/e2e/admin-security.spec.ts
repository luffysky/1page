import { expect, type Page, test } from "@playwright/test";

/**
 * 後台授權邊界（Spec §41）
 *
 * > 不要只靠前端隱藏按鈕。
 *
 * 這組測試模擬未登入者與一般訪客，驗證三層防線都真的存在：
 *   1. 密路徑    未設定或猜錯一律 404
 *   2. 身分驗證  未登入被導向登入頁
 *   3. 資料隔離  草稿不會出現在任何公開回應中
 *
 * ⚠️ 這些測試最重要的性質是「不需要知道密路徑也能跑」。
 * 若測試需要真實密路徑才有意義，那就表示密路徑被當成了安全邊界。
 */

const ADMIN_SEGMENT = process.env.ADMIN_SEGMENT?.trim();

test.describe("未授權者", () => {
  test("裸 /admin 一律不存在", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });

  test("裸 /admin/portfolio 一律不存在", async ({ page }) => {
    const response = await page.goto("/admin/portfolio");
    expect(response?.status()).toBe(404);
  });

  test("猜錯的密路徑不存在", async ({ page }) => {
    const response = await page.goto("/console-x7k2/admin");
    expect(response?.status()).toBe(404);
  });

  test("首頁不含後台入口，也不洩漏密路徑", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "後台" })).toHaveCount(0);

    // 整份 HTML 都不該出現密路徑——包含 script、link、data 屬性
    if (ADMIN_SEGMENT) {
      const html = await page.content();
      expect(html).not.toContain(ADMIN_SEGMENT);
    }
  });

  test("robots.txt 不公告後台路徑", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    const body = (await response?.text()) ?? "";

    // robots.txt 是公開檔案，把密路徑寫進 Disallow 等於主動公告
    if (ADMIN_SEGMENT) expect(body).not.toContain(ADMIN_SEGMENT);
  });

  test("sitemap 不含後台路徑", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    const body = (await response?.text()) ?? "";
    expect(body).not.toContain("/admin");
    if (ADMIN_SEGMENT) expect(body).not.toContain(ADMIN_SEGMENT);
  });
});

test.describe("已知密路徑但未登入", () => {
  test.skip(!ADMIN_SEGMENT, "未設定 ADMIN_SEGMENT");

  test("導向登入頁，而非直接顯示後台", async ({ page }) => {
    await page.goto(`/${ADMIN_SEGMENT}/admin`);

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "登入" })).toBeVisible();
  });

  test("後台內頁同樣導向登入", async ({ page }) => {
    await page.goto(`/${ADMIN_SEGMENT}/admin/portfolio`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("公開資料不含草稿", () => {
  test("列表與 API 都看不到未發布作品", async ({ page }) => {
    await page.goto("/work");
    const html = await page.content();
    expect(html).not.toContain("unpublished-draft");
    expect(html).not.toContain("尚未發布的草稿");
  });

  test("直接以 slug 存取草稿回 404", async ({ page }) => {
    const response = await page.goto("/work/unpublished-draft");
    expect(response?.status()).toBe(404);
  });
});

test.describe("登入頁", () => {
  async function submit(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("密碼").fill(password);
    await page.getByRole("button", { name: "登入" }).click();
  }

  test("錯誤帳密給出不可分辨的訊息", async ({ page }) => {
    await submit(page, "nobody@example.invalid", "wrong-password-123");

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();

    // 不得區分「帳號不存在」與「密碼錯誤」——那等於提供帳號列舉的管道
    const text = (await alert.textContent()) ?? "";
    expect(text).not.toMatch(/不存在|沒有此帳號|查無|not found|no user/i);
    expect(text).not.toMatch(/密碼錯誤|wrong password/i);
  });

  test("帶外部網址的 next 參數仍正常渲染，不整頁失敗", async ({ page }) => {
    // 淨化邏輯本身由 src/features/admin/safe-redirect.test.ts 精確涵蓋
    // （//evil.com、反斜線變形、控制字元等）。
    // 這裡只確認頁面不會因為惡意參數而壞掉。
    await page.goto("/login?next=https://evil.example.com");
    await expect(page.getByRole("button", { name: "登入" })).toBeVisible();
  });

  test("登入頁標記為不索引", async ({ page }) => {
    await page.goto("/login");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });
});
