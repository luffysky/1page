import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { AGENT_LIMITS, AGENT_RATE_LIMITS } from "../../src/features/agent/config";

/**
 * AI 顧問對話（Spec §16 / §35 / §36 / §37）
 *
 * ⚠️ 這一組**不呼叫模型**。每條測試不是停在送出之前，就是走被擋下的路徑。
 * gate 每跑一次就付一次錢的測試，最後一定會被關掉。
 * 真的打到模型的驗證由 `pnpm agent:eval` 進行。
 */

const advisor = "#advisor";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("對話區是真的表單，不是 disabled 的裝飾", async ({ page }) => {
  const section = page.locator(advisor);

  await expect(section.getByRole("textbox")).toBeEnabled();
  // 沒打字時送出鈕 disabled——那不是假互動，是正確的表單狀態。
  await expect(section.getByRole("button", { name: "問 AI 顧問" })).toBeDisabled();

  await section.getByRole("textbox").fill("我想幫咖啡店做網站");
  await expect(section.getByRole("button", { name: "問 AI 顧問" })).toBeEnabled();
});

test("可以完全用鍵盤操作（Spec §35）", async ({ page }) => {
  const input = page.locator(advisor).getByRole("textbox");

  await input.focus();
  await input.type("用鍵盤打的");

  // Enter 送出是表單的原生行為。少了它，鍵盤使用者得先 Tab 到按鈕，
  // 而那在每一則訊息都要做一次。
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe("INPUT");

  await expect(page.locator(advisor).getByRole("button", { name: "問 AI 顧問" })).toBeEnabled();
});

test("對話區對輔助技術可讀", async ({ page }) => {
  const log = page.locator(advisor).getByRole("log");

  await expect(log).toHaveAttribute("aria-live", "polite");
  await expect(log).toHaveAttribute("aria-label", /對話/);
});

test("對話區使用黑體，不是宋體（Spec §3）", async ({ page }) => {
  // 對話框用宋體會像在朗誦民國文學選集。
  const family = await page
    .locator(advisor)
    .getByRole("textbox")
    .evaluate((element) => getComputedStyle(element).fontFamily);

  expect(family).not.toContain("Noto Serif");
});

test("顯示剩餘則數，而且與 server 的上限同一份數字", async ({ page }) => {
  // 畫面說可以送、server 說太多，是最讓人困惑的一種不一致。
  await expect(page.locator(advisor)).toContainText(`還可以送 ${AGENT_LIMITS.maxMessages} 則`);
});

test("超過字數上限時擋在送出之前，並說明原因", async ({ page }) => {
  const section = page.locator(advisor);

  // maxLength 會把輸入截在上限，所以這裡驗的是「上限有生效」，
  // 而不是「打得下超長內容」。
  await section.getByRole("textbox").fill("字".repeat(AGENT_LIMITS.maxMessageChars + 200));

  const value = await section.getByRole("textbox").inputValue();
  expect(value.length).toBe(AGENT_LIMITS.maxMessageChars);
});

test("a11y：對話區沒有 critical / serious 違規", async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include("#advisor")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(serious.map((violation) => violation.id)).toEqual([]);
});

test("速率限制擋得住連續請求，而且說得出要等多久", async ({ request }) => {
  // Spec §36。這條刻意送格式錯誤的請求——限流必須在驗證**之前**生效，
  // 否則一支狂送壞資料的腳本完全不受限，只要故意送壞的就能繞過。
  const shortWindow = AGENT_RATE_LIMITS[0]!;
  let blocked: Awaited<ReturnType<typeof request.post>> | null = null;

  for (let i = 0; i <= shortWindow.max + 1; i += 1) {
    const response = await request.post("/api/agent", {
      data: { messages: [] },
      failOnStatusCode: false,
    });

    if (response.status() === 429) {
      blocked = response;
      break;
    }
  }

  expect(blocked, "送滿額度之後仍然沒有被擋下").not.toBeNull();
  expect((await blocked!.json()).code).toBe("rate_limited");
  // 只說「請稍後再試」而不說多久，使用者只會一直重按，
  // 而每一次重按都再撞一次限制。
  expect(blocked!.headers()["retry-after"]).toBeTruthy();
});
