import { expect, test } from "@playwright/test";

/**
 * Template Experience（Spec §8.15）
 *
 * 4B 出口條件：「1C 立下的『禁止假互動』測試改為驗證真的會動；
 * 所有切換皆為 SiteConfig mutation，零 DOM style 操作。」
 *
 * 單元測試已經驗過「按了會換內容」。這裡驗的是單元測試看不到的那一半：
 * 瀏覽器實際算出來的樣式真的變了。
 * jsdom 不做樣式計算，`--site-color-background` 換了值它也不知道畫面有沒有跟著換。
 */

const previewScope = "#templates [data-site-scope]";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("預設就有一套模板被選中，不是空狀態", async ({ page }) => {
  const pressed = page.locator("ul[aria-label='模板'] button[aria-pressed='true']");
  await expect(pressed).toHaveCount(1);

  // 預覽區有實際內容，不是佔位
  await expect(page.locator(`${previewScope} h1`).first()).toBeVisible();
});

test("換一套模板，瀏覽器算出來的背景色真的變了", async ({ page }) => {
  const scope = page.locator(previewScope).first();

  const background = () => scope.evaluate((element) => getComputedStyle(element).backgroundColor);
  const heading = () => page.locator(`${previewScope} h1`).first().textContent();

  const beforeBackground = await background();
  const beforeHeading = await heading();

  // Local Business 用 warm 主題（米白底），預設的 Studio 是 minimal（純白底）
  await page.getByRole("button", { name: /^Local Business/ }).click();

  await expect
    .poll(background, { message: "換了模板但計算後的背景色沒變" })
    .not.toBe(beforeBackground);
  expect(await heading()).not.toBe(beforeHeading);
});

test("切換是 SiteConfig 的結果，不是有人去改 DOM 樣式", async ({ page }) => {
  await page.getByRole("button", { name: /^Personal/ }).click();

  // scope 容器上只能有 --site-* 宣告。
  // 若有人用 element.style.background = ... 偽造切換（Spec §45.1 的 V3 做法），
  // 這裡就會出現一條非 --site-* 的宣告。
  const declarations = await page
    .locator(previewScope)
    .first()
    .evaluate((element) =>
      (element.getAttribute("style") ?? "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean),
    );

  expect(declarations.length).toBeGreaterThan(0);
  for (const declaration of declarations) {
    expect(declaration.startsWith("--site-"), `非預期的宣告：${declaration}`).toBe(true);
  }

  // 預覽以外的地方不得出現 --site-*（Plan §3 的隔離）
  const leaked = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--site-color-background").trim(),
  );
  expect(leaked).toBe("");
});

test("換主題會換掉配色，但不換模板", async ({ page }) => {
  const scope = page.locator(previewScope).first();
  const background = () => scope.evaluate((element) => getComputedStyle(element).backgroundColor);

  const before = await background();
  const heading = await page.locator(`${previewScope} h1`).first().textContent();

  await page.getByRole("button", { name: "精品一點" }).click();

  await expect.poll(background, { message: "換了主題但配色沒變" }).not.toBe(before);
  // 主題只換外觀。內容跟著換的話代表換的是模板，那是另一回事。
  expect(await page.locator(`${previewScope} h1`).first().textContent()).toBe(heading);
});

test("換主色會換掉按鈕底色", async ({ page }) => {
  const button = page.locator(`${previewScope} span[class*='inline-flex']`).first();
  const background = () => button.evaluate((element) => getComputedStyle(element).backgroundColor);

  const before = await background();
  await page.getByRole("button", { name: /苔綠/ }).click();

  await expect.poll(background, { message: "換了主色但按鈕底色沒變" }).not.toBe(before);
});

test("改品牌名稱，預覽即時跟著變", async ({ page }) => {
  const field = page.getByLabel("品牌名稱");
  await field.fill("測試工作室");

  await expect(
    page
      .locator(previewScope)
      .getByText(/測試工作室/)
      .first(),
  ).toBeVisible();
});

test("切換裝置時版面真的重排，不是把桌機版縮小", async ({ page }) => {
  // 這條是 4C 最容易做假的一項：只改容器寬度、內容仍是三欄，
  // 看起來「有切換」但其實什麼都沒發生（Spec §45.1 那類）。
  // 判準因此是 grid 的欄數，不是容器寬度。
  const grid = page.locator(`${previewScope} ul`).first();
  const columns = () =>
    grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);

  const desktop = await columns();
  expect(desktop).toBeGreaterThan(1);

  await page.getByRole("button", { name: /Mobile/ }).click();

  await expect.poll(columns, { message: "切到手機但欄數沒變" }).toBe(1);
});

test("在窄視窗切到 Desktop 也不會讓整頁出現橫向捲動", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: /Desktop/ }).click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/**
 * 4D — SiteConfig 無損傳遞（Spec §8.15）
 *
 * 出口條件：「訪客累積的設定不會在跳轉時消失，不需要重新選一次。」
 * 這一組驗的是那句話的兩半：交給 Agent、以及離開頁面再回來。
 */
test.describe("設定的傳遞", () => {
  test("帶著設定去問 AI 顧問，Agent 那一區收得到", async ({ page }) => {
    await page.getByRole("button", { name: /^Local Business/ }).click();
    await page.getByLabel("品牌名稱").fill("南方麵包店");
    await page.getByLabel("產業").fill("烘焙坊");

    await page.getByRole("link", { name: /帶著這份設定去問 AI 顧問/ }).click();

    const advisor = page.locator("#advisor");
    await expect(advisor.getByText("已從 Template Experience 帶入")).toBeVisible();
    await expect(advisor.getByText("南方麵包店")).toBeVisible();
    await expect(advisor.getByText("烘焙坊")).toBeVisible();

    // Spec §8.15：交接過來的對話從 template 情境開場，不是 Goal Selector 選的那個。
    // 5E 之前這裡讀的是殼上的 `initialIntent: template` 徽章；那是鷹架，已經拆了。
    // 判準改為人看得到的那一句——而「帶入的設定」本身在上面幾行已經逐項驗過。
    await expect(advisor).toContainText("已帶入你剛才在上面調好的設定");
  });

  test("交接之後再改預覽，Agent 手上的那份不跟著變", async ({ page }) => {
    await page.getByLabel("品牌名稱").fill("交接時的名字");
    await page.getByRole("link", { name: /帶著這份設定去問 AI 顧問/ }).click();

    await page.getByLabel("品牌名稱").fill("後來才改的名字");

    const advisor = page.locator("#advisor");
    await expect(advisor.getByText("交接時的名字")).toBeVisible();
    await expect(advisor.getByText("後來才改的名字")).toBeHidden();
  });

  test("離開首頁再回來，調過的設定還在", async ({ page }) => {
    await page.getByRole("button", { name: /^Personal/ }).click();
    await page.getByLabel("品牌名稱").fill("回來以後還在的名字");

    // 導覽列的「作品」是首頁內的錨點，這裡要的是真的離開這一頁。
    await page.goto("/work");
    await page.goto("/");

    await expect(page.getByLabel("品牌名稱")).toHaveValue("回來以後還在的名字");
    await expect(page.getByRole("button", { name: /^Personal/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test("預覽區可用鍵盤捲動", async ({ page }) => {
  // 模板比視窗高，預覽因此內部捲動。只有滑鼠能捲的話，
  // 鍵盤使用者永遠看不到下半部。
  const region = page.locator("#templates [role='group']").first();

  await expect(region).toHaveAttribute("tabindex", "0");
  await expect(region).toHaveAttribute("aria-label", /模板預覽/);
});
