import { readdirSync } from "node:fs";

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
  // 走真實路徑：直接造訪密路徑 → proxy 導向 /login?next=… → 登入後回到原處。
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

  /*
   * ⚠️ 後台每一頁都要掃，而且頁面清單**從磁碟算出來**。
   *
   * 這裡原本寫死三條路由（總覽、作品列表、新增作品）——那是 2E 當時
   * 後台的全部。之後加的收件匣、客戶、報價、專案、請款、內容管理
   * 一條都沒有被掃過，而這支測試的名字說它在檢查「後台」。
   *
   * 那是這個專案的第二種毛病：守衛通過不等於守衛有效。清單寫死的守衛
   * 一定會過期，而過期的方式是安靜的——它照樣全綠。
   *
   * 反過來問：磁碟上有哪些後台頁面，就掃哪些。新增一頁時它自己會發現。
   */
  const adminRoutes = (() => {
    const walk = (dir: string, urlPath: string): string[] => {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          const part = /^[(@]/.test(entry.name) ? "" : `/${entry.name}`;
          found.push(...walk(next, `${urlPath}${part}`));
        } else if (/^page\.tsx?$/.test(entry.name)) {
          found.push(urlPath);
        }
      }
      return found;
    };

    return walk("src/app/admin", "/admin");
  })();

  /*
   * 動態路由要有一筆真的資料才進得去。
   *
   * 每一條都寫明「誰在掃它」——寫不出來的就是沒人掃。
   */
  const DYNAMIC_COVERED_ELSEWHERE: Array<[string, string]> = [
    ["/admin/portfolio/[id]", "admin-case-study.spec.ts 會開一筆真的作品"],
    ["/admin/clients/[id]", "admin-crm.spec.ts"],
    ["/admin/deals/[id]", "admin-deals.spec.ts"],
    ["/admin/engagements/[id]", "admin-engagements.spec.ts"],
    ["/admin/invoices/[id]", "admin-invoices.spec.ts"],
    [
      "/admin/cms/[key]",
      "下面的靜態清單直接掃 /admin/cms/home.layout——key 是程式碼登記的常數，不需要任何資料",
    ],
  ];

  const excused = new Set(DYNAMIC_COVERED_ELSEWHERE.map(([route]) => route));

  /*
   * `/admin/cms/[key]` 是動態的，但 key 是程式碼登記的常數，
   * 不需要任何資料就進得去——所以它掃得到，而且**應該**掃：
   * 版面編輯器是後台目前最寬的一個版面。
   */
  const staticRoutes = adminRoutes
    .filter((route) => !route.includes("["))
    .concat("/admin/cms/home.layout");

  const skipped = adminRoutes.filter((route) => route.includes("[") && !excused.has(route));

  test("每一條後台動態路由都說得出是誰在掃它", () => {
    expect(skipped, `這幾條動態路由沒有任何地方檢查 RWD 與 a11y：${skipped.join("、")}`).toEqual(
      [],
    );

    for (const [route, who] of DYNAMIC_COVERED_ELSEWHERE) {
      expect(who.trim().length, `${route} 沒有寫是誰在掃`).toBeGreaterThan(0);
    }
  });

  // 只測最窄與最寬兩端：中間的斷點在總覽那一組已經全掃過，
  // 而撐出橫向捲動的永遠是這兩端其中之一
  const [narrowest] = VIEWPORTS;
  const widest = VIEWPORTS[VIEWPORTS.length - 1]!;

  for (const viewport of [narrowest, widest]) {
    for (const route of staticRoutes) {
      test(`${route} @ ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/${segment}${route}`);

        expect(await scan(page)).toEqual([]);
        expect(
          await horizontalOverflow(page),
          `${viewport.name}px 出現橫向捲動`,
        ).toBeLessThanOrEqual(0);
      });
    }
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

// ── 會員 dashboard ──────────────────────────────────────────────
//
// ⚠️ 這一段是補的。`a11y-all-routes.spec.ts` 把 `/account/*` 列為
// 「在 authed-breakpoints.spec.ts（需要登入）」——而這個檔案**從來沒有掃過它**。
// 例外清單寫了理由，理由卻不成立：那是一個名不副實的綠燈。
//
// 會員頁面用的是與後台同一個 DashboardShell，但兩邊的內容不同，
// 而橫向捲動與焦點問題出在內容上。
test.describe("會員 dashboard", () => {
  const MEMBER_EMAIL = "e2e-member-rwd@1page.test";
  const MEMBER_PASSWORD = "E2e!MemberRwd#2026";

  let memberId: string | undefined;

  test.beforeAll(async () => {
    const existing = await sql(`select id from auth.users where email = '${MEMBER_EMAIL}'`);
    for (const row of existing) await gotrue(`/users/${row.id}`, { method: "DELETE" });

    const created = await gotrue("/users", {
      method: "POST",
      body: JSON.stringify({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD, email_confirm: true }),
    });
    const body = (await created.json()) as { id?: string };
    if (!body.id) throw new Error(`建立測試會員失敗：${JSON.stringify(body)}`);
    memberId = body.id;
  });

  test.afterAll(async () => {
    if (memberId) await gotrue(`/users/${memberId}`, { method: "DELETE" });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login?next=%2Faccount");
    await page.getByLabel("Email").fill(MEMBER_EMAIL);
    await page.getByLabel("密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(/\/account/, { timeout: 20_000 });
  });

  /*
   * ⚠️ 從磁碟列舉，不寫死清單。
   *
   * 後台那一段（上面）原本寫死三條路由，之後加的六個頁面一條都沒被掃過，
   * 而測試的名字說它在檢查後台。0815 才修掉。
   *
   * 會員區這一份當時沒動——**因為它剛好還是完整的**，
   * 而「剛好還對」與「不會過期」是兩回事。0818 加了「我的 CRM」
   * 之後它就會開始漏，所以現在改成同一套。
   */
  const memberRoutes = (() => {
    const walk = (dir: string, urlPath: string): string[] => {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          const part = /^[(@]/.test(entry.name) ? "" : `/${entry.name}`;
          found.push(...walk(next, `${urlPath}${part}`));
        } else if (/^page\.tsx?$/.test(entry.name)) {
          found.push(urlPath);
        }
      }
      return found;
    };

    return walk("src/app/account", "/account");
  })();

  /** 動態路由要有一筆真的資料才進得去。每一條都要寫明誰在掃它 */
  const MEMBER_DYNAMIC_COVERED: Array<[string, string]> = [
    ["/account/crm/[id]", "crm-designer.spec.ts 會存一份真的設計再打開它"],
  ];

  const memberExcused = new Set(MEMBER_DYNAMIC_COVERED.map(([route]) => route));
  const memberSkipped = memberRoutes.filter(
    (route) => route.includes("[") && !memberExcused.has(route),
  );

  test("每一條會員區動態路由都說得出是誰在掃它", () => {
    expect(
      memberSkipped,
      `這幾條動態路由沒有任何地方檢查 RWD 與 a11y：${memberSkipped.join("、")}`,
    ).toEqual([]);

    for (const [route, who] of MEMBER_DYNAMIC_COVERED) {
      expect(who.trim().length, `${route} 沒有寫是誰在掃`).toBeGreaterThan(0);
    }
  });

  // 最窄與最寬兩端。側欄在窄螢幕收成抽屜，
  // 而「收起來」與「用 CSS 藏起來」的差別正是這裡要驗的東西。
  const pages = memberRoutes.filter((route) => !route.includes("["));

  const [narrow] = VIEWPORTS;
  const wide = VIEWPORTS[VIEWPORTS.length - 1]!;

  for (const path of pages) {
    for (const viewport of [narrow, wide]) {
      test(`${path} @ ${viewport.name}px 無違規且無橫向捲動`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);

        expect(await scan(page)).toEqual([]);
        expect(
          await horizontalOverflow(page),
          `${viewport.name}px 出現橫向捲動`,
        ).toBeLessThanOrEqual(0);
      });
    }
  }

  test("窄螢幕的側欄收起來時，鍵盤不會 Tab 進看不見的連結", async ({ page }) => {
    /*
     * 用 CSS 藏起來的側欄仍然在 Tab 順序上——使用者會依序停在一整排
     * 看不見的連結上，而 axe 不會報這件事（那是表單區塊踩過的同一個坑：
     * readOnly input 仍然吃 Tab）。
     *
     * 所以關閉時整組不進 DOM，這條就是在驗那件事。
     */
    await page.setViewportSize({ width: narrow!.width, height: narrow!.height });
    await page.goto("/account");

    const links = await page.getByRole("navigation").getByRole("link").count();
    expect(links, "抽屜收起來時不該有任何導覽連結留在 DOM 裡").toBe(0);

    await page.getByRole("button", { name: "選單" }).click();
    expect(await page.getByRole("navigation").getByRole("link").count()).toBeGreaterThan(0);
  });
});
