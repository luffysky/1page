import { expect, test, type Page } from "@playwright/test";

import { createMember, deleteMember, signIn, sql } from "./helpers/member";
import { matchesRoute, routesOnDisk } from "./helpers/routes";

/**
 * 已登入的可達性檢查（Phase M / ME）
 *
 * ── 為什麼 audit:wiring【8】不夠 ──────────────────────────────
 *
 * 那支爬蟲是**匿名的**。它從 `/` 出發、跟著 `<a href>` 走，所以它看不到
 * 任何只渲染給登入者的入口。
 *
 * 0813 真的因此漏過一次：`/account` 做完之後，唯一的入口是導覽列上
 * 那顆只給登入者看的「會員中心」，匿名爬蟲看不到它，於是那條路由
 * 被列進 `UNLINKED_BY_DESIGN`——理由寫得出來，但「它到底進不進得去」
 * 從來沒有被驗證過。
 *
 * 而後台整組（`/admin/**`）也在同一份例外清單裡，理由是「路徑要保密」。
 * 那個理由對**公開頁面**成立，對後台自己不成立：後台頁面之間
 * 一樣可能出現「做好了但選單上沒有」。Phase B 會讓後台從 4 頁長到 30 頁，
 * 那時靠人記得加連結一定會漏。
 *
 * 所以這一組帶著真的 session 再爬一次。
 */

const MEMBER_EMAIL = "e2e-reach-member@1page.test";
const MEMBER_PASSWORD = "E2e!Reach#2026";
const ADMIN_EMAIL = "e2e-reach-admin@1page.test";
const ADMIN_PASSWORD = "E2e!ReachAdmin#2026";

const segment = process.env.ADMIN_SEGMENT?.trim();

let memberId: string | undefined;
let adminId: string | undefined;

test.beforeAll(async () => {
  // 不靜默跳過：沒有密路徑就沒辦法驗後台，而「沒驗」與「通過」在報告上長得一樣
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT，後台可達性無法驗證");

  memberId = await createMember(MEMBER_EMAIL, MEMBER_PASSWORD);
  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);

  // 給 admin 而非 owner——owner 只能有一位，那位是 Luffy
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );
});

test.afterAll(async () => {
  if (memberId) await deleteMember(memberId);
  if (adminId) await deleteMember(adminId);
});

/**
 * 從 `start` 出發，跟著同源連結走，回傳走得到的路徑。
 *
 * 用真的瀏覽器而不是 fetch：只給登入者看的入口是伺服器依 session 渲染的，
 * 而 session 在 cookie 裡。用 fetch 要自己組 Supabase 的 cookie 格式，
 * 那是在複製一份會過期的實作細節。
 */
async function crawl(page: Page, start: string, within: RegExp): Promise<string[]> {
  const visited = new Set<string>();
  const queue = [start];

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);

    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (!response || response.status() !== 200) continue;

    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

    for (const href of hrefs) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const clean = href.split(/[?#]/)[0]!.replace(/(.)\/$/, "$1");
      if (clean && within.test(clean) && !visited.has(clean)) queue.push(clean);
    }
  }

  return [...visited];
}

test("登入之後，會員自己的頁面走得到", async ({ page }) => {
  await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD, "/account");

  const reached = await crawl(page, "/", /^\/(?!api\/)/);

  expect(reached, "登入之後從首頁點不到會員中心——Phase M 的入口又不見了").toContain("/account");
});

test("後台每一頁都在後台自己的選單裡走得到", async ({ page }) => {
  const base = `/${segment}/admin`;

  // 走真實路徑：直接造訪密路徑 → 導向 /login?next=… → 登入後回到原處
  await page.goto(base);
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(new RegExp(base), { timeout: 20_000 });

  const reached = await crawl(page, base, new RegExp(`^${base}(/|$)`));

  /*
   * 爬到的網址帶著密路徑前綴，磁碟上的路由沒有。
   * 對齊之後才比得起來。
   */
  const reachedRoutes = reached.map((path) => path.slice(`/${segment}`.length) || "/");

  const adminRoutes = routesOnDisk().filter(
    (route) => route.startsWith("/admin") && !route.startsWith("/api/"),
  );
  expect(adminRoutes.length, "找不到任何後台路由，這條就證明不了東西").toBeGreaterThan(0);

  /*
   * 刻意不連的後台頁面要寫在這裡並附理由。
   * 目前是空的——空的清單是目標，不是失敗。
   */
  const UNLINKED_BY_DESIGN: Array<[RegExp, string]> = [];

  const orphans = adminRoutes.filter((route) => {
    if (matchesRoute(route, reachedRoutes)) return false;
    return !UNLINKED_BY_DESIGN.some(([pattern]) => pattern.test(route));
  });

  expect(orphans, `這些後台頁面做好了，但後台裡沒有任何地方連得到：${orphans.join("、")}`).toEqual(
    [],
  );
});

test("後台的密路徑沒有洩漏到公開頁面", async ({ page }) => {
  /*
   * 上面那條會讓一個帶密路徑的網址被大量造訪，所以順手再確認一次
   * 相反方向：登出狀態下，公開頁面的 HTML 裡不該出現那個字串。
   *
   * admin-security.spec.ts 已經在驗這件事，這裡重複一次是因為
   * 這個檔案剛剛才把密路徑當成資料到處傳——很容易不小心讓它漏出去。
   */
  const context = await page.context().browser()!.newContext();
  const anonymous = await context.newPage();

  await anonymous.goto("/");
  expect(await anonymous.content()).not.toContain(segment!);

  await context.close();
});
