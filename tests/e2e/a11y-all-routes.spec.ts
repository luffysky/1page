import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { VIEWPORTS } from "../visual/viewports";

/**
 * 全站 A11y 稽核（Spec §35 / Phase 8D）
 *
 * 8D 出口條件：「**全部**路由 axe 0 critical/serious；鍵盤可完成所有主要流程。」
 *
 * ── 為什麼要一份「全部路由」的清單 ────────────────────────────
 *
 * a11y.spec.ts 驗首頁、work-list 驗 /work、authed-breakpoints 驗後台——
 * 各自都很紮實，但沒有任何一個地方在問「**是不是每一條都被驗過了**」。
 *
 * 那正是【8】路由可達性與【9】API 接線抓到的同一種縫：
 * 每個東西各自都對，只有「有沒有漏掉」沒人在看。
 *
 * 這裡的清單與稽核腳本的磁碟掃描對得起來——新增一條公開路由而忘了
 * 加進這份清單，`audit-wiring` 的【8】會先發現它沒有入口。
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** 公開路由。後台在 authed-breakpoints.spec.ts（需要登入才進得去） */
const PUBLIC_ROUTES = [
  { name: "首頁", path: "/" },
  { name: "作品列表", path: "/work" },
  { name: "作品詳細", path: "/work/interior-studio" },
  { name: "登入", path: "/login" },
  { name: "Project Builder", path: "/start" },
  { name: "網站編輯器", path: "/edit" },
];

/**
 * 這份清單有沒有跟上磁碟。
 *
 * 【8】路由可達性只問「有沒有入口」——`/edit` 有入口，所以它是綠的，
 * 而這份 a11y 清單漏了它，沒有任何東西會說。掃描漏掉一條路由
 * 跟那條路由壞掉一樣嚴重，只是它更安靜。
 *
 * 需要排除的要寫在這裡並附理由，跟其他每一份例外清單一樣。
 */
const NOT_SCANNED_HERE: Array<[RegExp, string]> = [
  [/^\/admin(\/|$)/, "後台在 authed-breakpoints.spec.ts（需要登入）"],
  [/^\/account(\/|$)/, "會員中心需要登入，同上"],
  [/^\/_dev(\/|$)/, "開發用頁面"],
  [/^\/api(\/|$)/, "不是頁面"],
  [/^\/icon-maskable$/, "不是頁面"],
  [/^\/work\/\[slug\]$/, "動態路由，已用 interior-studio 這個實例掃過"],
];

test("這份清單沒有漏掉任何一條公開頁面", async () => {
  const { readdirSync } = await import("node:fs");

  const found: string[] = [];
  const walk = (dir: string, urlPath: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        const segment = /^[(@]/.test(entry.name) ? "" : `/${decodeURIComponent(entry.name)}`;
        walk(next, `${urlPath}${segment}`);
      } else if (/^(page|route)\.tsx?$/.test(entry.name)) {
        found.push(urlPath === "" ? "/" : urlPath);
      }
    }
  };
  walk("src/app", "");

  const scanned = new Set(PUBLIC_ROUTES.map((route) => route.path));
  const missing = found.filter(
    (route) => !scanned.has(route) && !NOT_SCANNED_HERE.some(([pattern]) => pattern.test(route)),
  );

  expect(
    missing,
    "這些公開路由沒有被 a11y 掃描到。要嘛加進 PUBLIC_ROUTES，要嘛加進 NOT_SCANNED_HERE 並寫理由",
  ).toEqual([]);
});

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 3),
    }));
}

// 最窄與最寬兩端。中間的斷點由各頁自己的測試涵蓋——
// 這一組要的是「每一條路由都被掃過」，不是把既有的覆蓋再跑一次。
const [narrowest] = VIEWPORTS;
const widest = VIEWPORTS[VIEWPORTS.length - 1]!;

for (const route of PUBLIC_ROUTES) {
  for (const viewport of [narrowest!, widest]) {
    test(`${route.name} @ ${viewport.name}px 無 critical / serious 違規`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);

      expect(await scan(page)).toEqual([]);
    });
  }
}

/**
 * 鍵盤流程會**真的送出一筆需求**，所以要自己收乾淨。
 *
 * leads 刻意沒有 delete policy（那是聯絡紀錄，不該被誰順手刪掉），
 * 所以清理只能用 service role 從測試這一側做。
 * 不清的話，每跑一次 e2e 收件匣就多一筆假資料——
 * 而真正的 lead 會被埋在裡面。
 */
test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `delete from public.leads where contact_email = 'keyboard@example.test'`,
    }),
  });
});

test("主要流程可以完全用鍵盤走完", async ({ page }) => {
  // 「鍵盤可完成所有主要流程」不是「每個元素都 focusable」——
  // 是真的從頭走到尾。這裡走的是轉換路徑：首頁 → 調預覽 → 送出需求。
  await page.goto("/");

  // 1. 選一個 goal
  const goal = page.getByRole("button", { name: /我要一個網站/ });
  await goal.focus();
  await page.keyboard.press("Enter");
  await expect(goal).toHaveAttribute("aria-pressed", "true");

  // 2. 換一套模板
  const template = page.getByRole("button", { name: /^Local Business/ });
  await template.focus();
  await page.keyboard.press("Enter");
  await expect(template).toHaveAttribute("aria-pressed", "true");

  // 3. 打字給 AI 顧問（不送出——這一條不該花錢）
  const input = page.locator("#advisor").getByRole("textbox");
  await input.focus();
  await page.keyboard.type("我想做網站");
  await expect(page.locator("#advisor").getByRole("button", { name: "問 AI 顧問" })).toBeEnabled();

  // 4. 到 Project Builder 填完並送出
  await page.goto("/start");

  await page.getByLabel("想達成什麼").focus();
  await page.keyboard.type("讓人搜得到店");

  await page.getByLabel("信箱").focus();
  await page.keyboard.type("keyboard@example.test");

  const submit = page.getByRole("button", { name: "送出需求" });
  await submit.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText("收到了");
});

test("每一個 focus 都看得見", async ({ page }) => {
  // 看不見的 focus ring 等於沒有鍵盤操作——使用者不知道自己在哪裡。
  await page.goto("/start");

  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");

    const visible = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return true;

      const style = getComputedStyle(active);
      // outline 或 box-shadow 任一個有值就算——兩種都是常見的作法。
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });

    expect(visible, `第 ${i + 1} 個焦點沒有可見的樣式`).toBe(true);
  }
});
