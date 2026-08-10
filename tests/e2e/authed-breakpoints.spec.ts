import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { VIEWPORTS } from "../visual/viewports";

/**
 * 登入頁與後台的 RWD + a11y 斷點檢查（Spec §34 / §35）
 *
 * 到 Phase 3 收尾為止，八斷點檢查只涵蓋 `/`、`/work`、`/work/[slug]`——
 * 全都是不需要登入的頁面。理由是「後台是內部工具」，
 * 但**後台也是人在用的，而且是每天用**：
 * 手機上打不開的後台等於出門就不能改東西。
 *
 * 這組測試補上需要登入的那一半。
 *
 * 這裡不會靜默跳過：缺少 ADMIN_EMAIL / ADMIN_PASSWORD 直接讓測試失敗。
 * 2E 有過教訓——兩條後台安全測試因為 Playwright 沒載入 .env.local 而
 * 靜默跳過，報告全綠了好一陣子。
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const segment = process.env.ADMIN_SEGMENT?.trim();

/*
 * 測試自己開一個拋棄式的後台帳號，不用 .env.local 的 ADMIN_EMAIL / ADMIN_PASSWORD。
 *
 * 第一版是直接拿那組憑證登入，結果 13 條全數失敗——
 * Luffy 換過後台密碼，`.env.local` 沒跟著更新。
 * 但真正的問題不是那組值過期，是**測試不該依賴一個人的個人密碼**：
 * 那個值隨時可能改，改了就整組測試變紅，而紅的原因與程式碼無關。
 *
 * 順帶一提，這也是為什麼在此之前登入後的畫面從來沒被任何測試渲染過：
 * 既有的後台測試全部只驗「未登入時進不去」。
 */
const E2E_EMAIL = "e2e-admin@1page.test";
const E2E_PASSWORD = "E2e!Throwaway#2026";

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
    }));
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function signIn(page: Page) {
  // 走真實路徑：直接造訪密路徑 → middleware 導向 /login?next=… → 登入後回到原處。
  // 第一版是 goto("/login") 然後等網址出現 /admin，那是我自己想像的行為；
  // 實際上沒有 next 參數時登入後會回首頁（sanitizeNextPath 的 fallback 是 "/"），
  // 於是 13 條測試全部卡在一個根本不存在的預期上。
  await page.goto(`/${segment}/admin`);
  await page.waitForURL(/\/login/, { timeout: 20_000 });

  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("密碼").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(new RegExp(`/${segment}/admin`), { timeout: 20_000 });
}

async function gotrue(path: string, init?: RequestInit) {
  return fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
  });
}

async function sql(query: string) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

let e2eUserId: string | undefined;

test.beforeAll(async () => {
  if (!supabaseUrl || !serviceKey || !segment) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_SEGMENT。\n" +
        "這組測試不會靜默跳過——後台的 RWD 沒驗證過就是沒驗證過。",
    );
  }

  // 前一次跑到一半被中斷時可能留下殘骸
  const existing = await sql(`select id from auth.users where email = '${E2E_EMAIL}'`);
  for (const row of existing) await gotrue(`/users/${row.id}`, { method: "DELETE" });

  const created = await gotrue("/users", {
    method: "POST",
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD, email_confirm: true }),
  });
  const body = (await created.json()) as { id?: string };
  if (!body.id) throw new Error(`建立測試後台帳號失敗：${JSON.stringify(body)}`);
  e2eUserId = body.id;

  // 給 admin 而非 owner——owner 只能有一位，那位是 Luffy。
  await sql(
    `insert into public.admin_users (user_id, role) values ('${e2eUserId}', 'admin')
     on conflict (user_id) do nothing`,
  );
});

test.afterAll(async () => {
  if (e2eUserId) await gotrue(`/users/${e2eUserId}`, { method: "DELETE" });
});

// ── 登入頁（不需登入，但先前也沒被納入斷點檢查）─────────────────
for (const viewport of VIEWPORTS) {
  test(`/login @ ${viewport.name}px 無違規且無橫向捲動`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/login");

    expect(await scan(page)).toEqual([]);
    expect(await horizontalOverflow(page), `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(
      0,
    );
  });
}

// ── 後台 ────────────────────────────────────────────────────────
test.describe("後台", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const viewport of VIEWPORTS) {
    test(`後台總覽 @ ${viewport.name}px 無違規且無橫向捲動`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${segment}/admin`);

      expect(await scan(page)).toEqual([]);
      expect(await horizontalOverflow(page), `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(
        0,
      );
    });
  }

  // 作品列表與編輯表單是後台最寬的兩個版面（表格 + 多欄表單），
  // 最容易在窄螢幕撐出橫向捲動。只測最窄與最寬兩端。
  const [narrowest] = VIEWPORTS;
  const widest = VIEWPORTS[VIEWPORTS.length - 1]!;

  for (const viewport of [narrowest, widest]) {
    test(`作品列表 @ ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${segment}/admin/portfolio`);

      expect(await scan(page)).toEqual([]);
      expect(await horizontalOverflow(page), `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(
        0,
      );
    });

    test(`新增作品表單 @ ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${segment}/admin/portfolio/new`);

      expect(await scan(page)).toEqual([]);
      expect(await horizontalOverflow(page), `${viewport.name}px 出現橫向捲動`).toBeLessThanOrEqual(
        0,
      );
    });
  }

  test("登出後回到首頁，且不再能進入後台", async ({ page }) => {
    await page.goto(`/${segment}/admin`);
    await page.getByRole("button", { name: "登出" }).click();

    await page.waitForURL("/", { timeout: 15_000 });

    // 真正的判準不是「跳回首頁了」，而是**session 真的清掉了**。
    // 只在瀏覽器端清狀態的登出，重新造訪密路徑仍然進得去。
    const response = await page.goto(`/${segment}/admin`, { waitUntil: "domcontentloaded" });
    expect(response?.url()).toContain("/login");
  });
});
