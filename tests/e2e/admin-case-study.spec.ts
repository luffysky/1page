import { expect, test } from "@playwright/test";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 後台填得了 Case Study，而且前台看得到（Spec §8.10 / §28）
 *
 * ── 這裡守的是「有讀取端，沒有寫入端」 ────────────────────────
 *
 * `case_study_json` / `links_json` / `ai_disclosure_json` 從 2E 起就在
 * schema 與公開頁面裡完整支援——公開頁面畫得出這幾段，後台表單卻只有
 * 基本欄位，也就是**只能直接改資料庫**。
 *
 * 那是同一種毛病的另一個形態：欄位有人讀、沒有人寫。
 * 它不會報錯，因為「畫不出東西」與「這件作品還沒寫 case study」
 * 在畫面上長得一模一樣。
 *
 * 所以這條走完整條來回：後台填 → 存 → 前台那一頁真的多了那段字。
 */

const ADMIN_EMAIL = "e2e-casestudy@1page.test";
const ADMIN_PASSWORD = "E2e!Case#2026";
const SLUG = "interior-studio";

const MARKER = "E2E 案例文字（測試用，會被還原）";
const LINK = "https://example.com/e2e-live";
const AI_TEXT = "E2E 的 AI 揭露說明";

const segment = process.env.ADMIN_SEGMENT?.trim();

let adminId: string | undefined;
let original: { case_study_json: unknown; links_json: unknown; ai_disclosure_json: unknown };
let originalCategories: string[] = [];
let originalTags: string[] = [];

test.beforeAll(async () => {
  if (!segment) throw new Error("缺少 ADMIN_SEGMENT");

  // 先把原本的內容記下來，測完還原。這條會改到真的資料
  const rows = await sql(
    `select case_study_json, links_json, ai_disclosure_json
     from portfolio_projects where slug = '${SLUG}'`,
  );
  if (rows.length === 0) throw new Error(`找不到作品 ${SLUG}`);
  original = rows[0];

  const taxonomy = await sql(
    `select
       (select coalesce(array_agg(c.slug order by c.slug), '{}')
          from portfolio_project_categories pc
          join portfolio_categories c on c.id = pc.category_id
          join portfolio_projects p on p.id = pc.project_id
         where p.slug = '${SLUG}') as categories,
       (select coalesce(array_agg(t.name order by t.name), '{}')
          from portfolio_project_tags pt
          join portfolio_tags t on t.id = pt.tag_id
          join portfolio_projects p on p.id = pt.project_id
         where p.slug = '${SLUG}') as tags`,
  );
  originalCategories = taxonomy[0].categories ?? [];
  originalTags = taxonomy[0].tags ?? [];

  adminId = await createMember(ADMIN_EMAIL, ADMIN_PASSWORD);
  await sql(
    `insert into public.admin_users (user_id, role) values ('${adminId}', 'admin')
     on conflict (user_id) do nothing`,
  );
});

test.afterAll(async () => {
  const json = (value: unknown) => `'${JSON.stringify(value ?? {}).replace(/'/g, "''")}'::jsonb`;

  await sql(
    `update portfolio_projects set
       case_study_json = ${json(original.case_study_json)},
       links_json = ${json(original.links_json)},
       ai_disclosure_json = ${json(original.ai_disclosure_json)}
     where slug = '${SLUG}'`,
  );

  /*
   * 分類與標籤是 join 表，還原要重建關聯而不是塞回一個欄位。
   * 不還原的話，下一次跑 work-list 的測試會看到一件分類被改過的作品。
   */
  const quoted = (values: string[]) =>
    values.length > 0 ? values.map((value) => `'${value.replace(/'/g, "''")}'`).join(",") : "''";

  await sql(
    `delete from portfolio_project_categories
       where project_id = (select id from portfolio_projects where slug = '${SLUG}');
     insert into portfolio_project_categories (project_id, category_id)
       select p.id, c.id from portfolio_projects p, portfolio_categories c
        where p.slug = '${SLUG}' and c.slug in (${quoted(originalCategories)});
     delete from portfolio_project_tags
       where project_id = (select id from portfolio_projects where slug = '${SLUG}');
     insert into portfolio_project_tags (project_id, tag_id)
       select p.id, t.id from portfolio_projects p, portfolio_tags t
        where p.slug = '${SLUG}' and t.name in (${quoted(originalTags)});`,
  );

  /*
   * 測試建立的標籤本身也要收掉。
   *
   * 只還原 join 的話，`portfolio_tags` 會留下一筆「E2E 測試標籤」——
   * 而它會出現在後台的建議清單上，也會出現在 listTags() 的結果裡
   * （只要有任何一件作品掛過它）。測試留下的垃圾要自己清。
   */
  await sql(`delete from portfolio_tags where slug = 'e2e-測試標籤'`);

  if (adminId) await deleteMember(adminId);
});

const base = `/${segment}/admin`;

/**
 * 登入後台並打開作品列表。
 *
 * ⚠️ 登入後回到的是**後台首頁**，不是原本要去的那一頁：
 * `sanitizeNextPath` 只放行後台的根路徑。所以要自己再走一次，
 * 不能對著 `/portfolio` 等 URL——那會等到逾時，而錯誤訊息看起來
 * 像是登入失敗。
 */
async function openPortfolioList(page: import("@playwright/test").Page) {
  await page.goto(`${base}/portfolio`);

  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("密碼").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(new RegExp(base), { timeout: 20_000 });
    await page.goto(`${base}/portfolio`);
  }
}

test("後台填的 Case Study、連結與 AI 揭露，前台都看得到", async ({ page }) => {
  await openPortfolioList(page);

  // 從列表點進去，不是直接打網址——那顆連結本身也是要驗的東西
  await page
    .getByRole("link", { name: /山序設計|Interior Studio/ })
    .first()
    .click();
  await page.waitForURL(new RegExp(`${base}/portfolio/`), { timeout: 20_000 });

  /*
   * 用 name 屬性定位，不是 getByLabel。
   *
   * 「說明」這個字在這張表單上出現不只一次（每個 Field 的 hint 也會
   * 進到可存取名稱裡），getByLabel 會直接 strict mode violation。
   * 欄位名稱是這張表單與 server action 之間真正的契約，拿它定位
   * 順便也驗到了「名字有沒有對上」。
   */
  await page.locator('[name="case_study.problem"]').fill(MARKER);
  await page.locator('[name="links.live"]').fill(LINK);
  await page.locator('[name="ai_disclosure.used"]').check();
  await page.locator('[name="ai_disclosure.description"]').fill(AI_TEXT);

  await page.getByRole("button", { name: "儲存" }).click();

  /*
   * 先確認沒有錯誤訊息再等導頁。
   *
   * 直接等 URL 的話，儲存失敗時看到的是「等待逾時」——那句話對
   * 「哪裡填錯了」一點幫助也沒有，而表單上就寫著原因。
   */
  /*
   * 送出前先確認沒有任何欄位被瀏覽器判為無效。
   *
   * ⚠️ 這一條是踩過才加的：`links.demo` 原本是 `type="url"`，而
   * interior-studio 的 demo 連結是站內路徑 `/work/interior-studio`。
   * 瀏覽器直接擋下整份表單，onSubmit 根本沒觸發——測試看到的是
   * 「等待導頁逾時」，畫面上什麼錯誤訊息都沒有。
   */
  const invalid = await page
    .locator("form :invalid")
    .evaluateAll((els) => els.map((el) => el.getAttribute("name")).filter(Boolean));
  expect(invalid, `這些欄位被瀏覽器擋下來，表單送不出去：${invalid.join("、")}`).toEqual([]);
  await page.waitForURL(new RegExp(`${base}/portfolio$`), { timeout: 20_000 });

  // 前台那一頁真的多了那幾段
  await page.goto(`/work/${SLUG}`);
  await expect(page.getByText(MARKER)).toBeVisible();
  // 用網址定位而不是連結文字：這條要驗的是「我剛才填的那個值真的到了前台」
  await expect(page.locator(`a[href="${LINK}"]`).first()).toBeVisible();
  await expect(page.getByText(AI_TEXT)).toBeVisible();
});

test("沒有勾選 AI 揭露時，說明文字不會被存下來", async ({ page }) => {
  /*
   * 存 `{ used: false, description: "…" }` 的話，之後有人把勾選打開，
   * 一段沒有人記得寫過的舊文字就會突然出現在客戶案例上。
   */
  await openPortfolioList(page);

  await page
    .getByRole("link", { name: /山序設計|Interior Studio/ })
    .first()
    .click();
  await page.waitForURL(new RegExp(`${base}/portfolio/`), { timeout: 20_000 });

  await page.locator('[name="ai_disclosure.used"]').uncheck();
  await page.locator('[name="ai_disclosure.description"]').fill("這段不該被存下來");
  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForURL(new RegExp(`${base}/portfolio$`), { timeout: 20_000 });

  const rows = await sql(
    `select ai_disclosure_json from portfolio_projects where slug = '${SLUG}'`,
  );
  expect(JSON.stringify(rows[0].ai_disclosure_json), "沒勾選卻把說明存進資料庫了").not.toContain(
    "這段不該被存下來",
  );
});

test("後台改了分類，/work 的篩選立刻找得到（或找不到）", async ({ page }) => {
  /*
   * ── 這一條守的是一個很具體的洞 ────────────────────────────
   *
   * 分類與標籤是 join 表，比 case study 那幾個 jsonb 欄位晚一輪才接上。
   * 在那之前，**後台新建的作品沒有任何分類**——於是它在 /work 的
   * 任何分類篩選下都找不到，而後台的作品列表看起來一切正常。
   *
   * 所以這裡走完整條：後台勾一個分類 → 前台用那個分類篩 → 找得到；
   * 取消勾選 → 找不到。只驗「表單上有那個 checkbox」證明不了任何事。
   */
  await openPortfolioList(page);
  await page
    .getByRole("link", { name: /山序設計|Interior Studio/ })
    .first()
    .click();
  await page.waitForURL(new RegExp(`${base}/portfolio/`), { timeout: 20_000 });

  // 只留一個分類：video（這件作品原本沒有）
  for (const checkbox of await page.locator('input[name="categories"]').all()) {
    await checkbox.uncheck();
  }
  await page.locator('input[name="categories"][value="video"]').check();
  await page.locator('input[name="tags"]').fill("E2E 測試標籤");

  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForURL(new RegExp(`${base}/portfolio$`), { timeout: 20_000 });

  await page.goto("/work?category=video");
  await expect(page.getByText(/山序設計|Interior Studio/).first()).toBeVisible();

  // 反方向：原本的分類現在應該篩不到它了
  await page.goto("/work?category=web");
  await expect(page.getByText(/山序設計|Interior Studio/)).toHaveCount(0);

  // 標籤也要真的存進去，而且是新建立的那一個
  await page.goto("/work?tag=e2e-測試標籤");
  await expect(page.getByText(/山序設計|Interior Studio/).first()).toBeVisible();
});
