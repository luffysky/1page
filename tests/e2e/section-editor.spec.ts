import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * 區塊編輯器（CR-003-4）
 *
 * ── 這裡最重要的一條是「完全不用滑鼠」 ────────────────────────
 *
 * WCAG 2.1 §2.5.7：任何用拖曳完成的操作都要有不需拖曳的替代方式。
 * 第一段刻意先做鍵盤、第二段才疊上拖曳，就是為了讓那條在第一版成立——
 * 補做等於整個介面重寫。
 *
 * 所以「完全用鍵盤」那一條**只用 Tab 與 Enter**，而且它是在拖曳
 * 加進來之後仍然要綠的那一條。兩者呼叫的是同一個 moveSection，
 * 所以它們在結構上不可能有不同的行為。
 */

const order = async (page: import("@playwright/test").Page) =>
  page
    .locator("[data-section-widget]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-section-widget")));

test.describe("區塊編輯器", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/edit");
  });

  test("完全用鍵盤就能把區塊往上搬", async ({ page }) => {
    const before = await order(page);

    // Tab 進第二塊區塊，按 Enter 之前先確認焦點真的在那裡
    const second = page.locator("[data-section-widget]").nth(1).getByRole("group").first();
    await second.focus();

    const movedId = before[1];
    await expect(second).toBeFocused();

    /*
     * ⚠️ 用 Tab 走過去，不是 `.focus()`。
     *
     * 第一版這裡是 `await up.focus()`——那是程式直接指定焦點，
     * 連 `tabIndex={-1}`（完全不在 Tab 順序上）的元素都能成功。
     * 我把按鈕改成 tabIndex={-1} 驗證，測試照樣綠——
     * 也就是它從來沒有在驗「鍵盤到得了」，只在驗「按了會動」。
     *
     * 真正要證明的是**鍵盤使用者走得到那顆按鈕**，所以只能按 Tab。
     */
    const up = page.getByRole("button", { name: /往上移/ });

    let reached = false;
    for (let step = 0; step < 6 && !reached; step += 1) {
      await page.keyboard.press("Tab");
      reached = await up.evaluate((el) => el === document.activeElement).catch(() => false);
    }

    expect(reached, "Tab 走不到「往上移」——鍵盤使用者搬不動區塊").toBe(true);
    await page.keyboard.press("Enter");

    const after = await order(page);
    expect(after[0], "鍵盤搬不動區塊——WCAG 2.5.7 的替代方式沒生效").toBe(movedId);
    expect(after).toHaveLength(before.length);
  });

  test("第一塊不能再往上，最後一塊不能再往下", async ({ page }) => {
    /*
     * 邊界不繞回另一端。一直按「下移」把區塊從最底下跳到最上面，
     * 看起來像壞掉——使用者會以為自己按錯了。
     */
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await expect(page.getByRole("button", { name: /往上移/ })).toBeDisabled();

    await page.locator("[data-section-widget]").last().getByRole("group").first().click();
    await expect(page.getByRole("button", { name: /往下移/ })).toBeDisabled();
  });

  test("沒選取的區塊不會留下按不到卻在 Tab 順序上的按鈕", async ({ page }) => {
    /*
     * 工具列只在選取時進 DOM，不是用 CSS 藏起來。
     * 藏起來的話，鍵盤使用者會在每一塊都撞到三顆看不見的按鈕——
     * 那正是表單區塊那次踩過的坑。
     */
    expect(await page.getByRole("button", { name: /往上移|往下移|移除/ }).count()).toBe(0);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    expect(await page.getByRole("button", { name: /往上移|往下移|移除/ }).count()).toBe(3);
  });

  test("排好的順序跳到別頁再回來還在", async ({ page }) => {
    // Spec §8.15：訪客累積的設定不會在跳轉時消失。
    // 區塊順序是使用者的輸入，算不出來，所以必須被存下來。
    await page.locator("[data-section-widget]").nth(1).getByRole("group").first().click();
    await page.getByRole("button", { name: /往上移/ }).click();

    const edited = await order(page);

    await page.goto("/work");
    await page.goto("/edit");

    /*
     * ⚠️ 用 poll，不是讀一次就斷言。
     *
     * 還原是在掛載後的 effect 裡做的（見 preview-context：放進 useReducer
     * 的初始值會造成 hydration mismatch，因為 server 沒有 sessionStorage）。
     * 所以回訪時會有短暫一瞬間顯示 server 那一版的預設順序。
     *
     * 第一版這裡是讀一次就比，結果它抓到的正是那一瞬間——測試紅了，
     * 但功能其實是好的。這不是把測試改鬆：順序最後**必須**是使用者排的那個，
     * 只是它比第一幀晚到。
     */
    await expect
      .poll(async () => (await order(page)).join(","), {
        message: "排了半天，點一下別頁就全沒了",
      })
      .toBe(edited.join(","));
  });

  test("回到模板原樣", async ({ page }) => {
    const original = await order(page);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await page.getByRole("button", { name: /移除/ }).click();
    expect(await order(page)).not.toEqual(original);

    await page.getByRole("button", { name: "回到模板原樣" }).click();
    expect(await order(page)).toEqual(original);
  });

  test("換模板會換掉整組區塊，不會沿用舊的", async ({ page }) => {
    // 保留舊模板的區塊等於換了版型卻沒換內容，那不是換模板
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await page.getByRole("button", { name: /移除/ }).click();

    await page.getByRole("button", { name: /^Local Business/ }).click();

    const after = await order(page);
    expect(after[0]).toBe("hero");
    expect(after).toContain("faq");
  });

  test("拖曳搬動：放開之後真的落在目標位置", async ({ page }) => {
    /*
     * ⚠️ 這裡用明確派送的 DnD 事件，不用 Playwright 的 `dragTo`。
     *
     * `dragTo` 走的是滑鼠座標，而編輯區是一個有自己捲軸的容器：
     * 它把來源捲進畫面、目標又被捲出去，放開時游標底下的其實是別塊。
     * 實測拖 footer 到最上面，動到的是 about——**程式是對的，
     * 是那個測試手法在這個容器裡量不準**。
     *
     * 拖曳的座標行為交給瀏覽器，這裡驗的是我們自己那段：
     * 「被拖的是誰、放在誰身上、最後順序對不對」。
     */
    const drop = async (fromId: string, toId: string) => {
      await page.evaluate(
        ([from, to]) => {
          const source = document.querySelector(`[data-section-widget="${from}"]`)!;
          const target = document.querySelector(`[data-section-widget="${to}"]`)!;
          const dataTransfer = new DataTransfer();
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
        },
        [fromId, toId],
      );
    };

    const before = await order(page);
    const last = before.at(-1)!;
    const first = before[0]!;

    await drop(last, first);
    await expect.poll(async () => (await order(page))[0]).toBe(last);

    // 往回拖也要對——「往下拖」的索引偏移是這種功能最常見的錯
    await drop(last, before[2]!);
    const after = await order(page);
    expect(after.indexOf(last)).toBeGreaterThan(after.indexOf(first));
    expect(after).toHaveLength(before.length);
  });

  test("新增區塊會插在選取的那一塊後面，而且看得出是什麼", async ({ page }) => {
    // 一律加到最底下的話，新區塊會出現在頁尾下面，看起來像壞了
    const before = await order(page);

    await page.locator("[data-section-widget]").nth(1).getByRole("group").first().click();
    await page.getByText("新增區塊").click();
    await page.getByRole("button", { name: "＋ 常見問題" }).click();

    const after = await order(page);
    expect(after).toHaveLength(before.length + 1);
    expect(after[2], "沒有插在選取那一塊後面").toBe("faq");

    // 加出來要有內容，不是一塊空白
    await expect(page.getByText("常見問題").last()).toBeVisible();
  });

  test("改文字，預覽跟著變", async ({ page }) => {
    /*
     * 內容面板是照著「值目前的形狀」產生欄位的，不是每種區塊手寫一份表單。
     * 手寫的話那是第二份 schema，它與元件實際讀的欄位遲早分歧——
     * 分歧的表現是「改了某個欄位，畫面沒反應」。所以這條驗的是
     * **改了之後預覽真的跟著變**，不是「表單上有那個欄位」。
     */
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();

    await page.getByLabel("標題", { exact: true }).first().fill("這是我改的標題");

    await expect(page.locator("[data-section-widget='hero']")).toContainText("這是我改的標題");
  });

  test("換排版不會弄丟已經改過的字", async ({ page }) => {
    // 換排版換的是版面，不是內容。掉字的話使用者不敢再按第二次
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    await page.getByLabel("標題", { exact: true }).first().fill("換排版也要留著");

    await page.getByRole("button", { name: "minimal", exact: true }).click();

    await expect(page.locator("[data-section-widget='hero']")).toContainText("換排版也要留著");
  });

  test("只列這個區塊真的有的排版", async ({ page }) => {
    // setSectionVariant 會拒絕不存在的 variant，而使用者只看得到「按了沒反應」
    await page.locator("[data-section-widget]").first().getByRole("group").first().click();

    const buttons = await page
      .getByRole("button", { name: /^(centered|editorial|minimal)$/ })
      .count();
    expect(buttons).toBe(3);
  });

  test("加得了第四個服務，也刪得掉多餘的", async ({ page }) => {
    /*
     * 內容面板原本只能改**既有**項目的文字。
     * 模板給三個服務，使用者有四個，那第四個永遠加不上去——
     * 一個「幾乎可以用」的編輯器比明顯不能用的更氣人。
     */
    const before = await order(page);
    await page.getByText("新增區塊").click();
    await page.getByRole("button", { name: "＋ 服務" }).click();

    /*
     * 找出新加的那一塊，不要寫死 id。
     *
     * Studio 模板本來就有一塊 services，新加的會是 services-2——
     * 寫死 "services" 的話這條測試會對著模板原本那塊做斷言，
     * 然後告訴你「加不進去」，而其實是找錯了對象。
     */
    const after = await order(page);
    const added = after.find((id) => !before.includes(id))!;
    const services = page.locator(`[data-section-widget="${added}"]`);

    // 加完會自動選取新的那一塊，所以內容面板已經在了
    await expect(page.getByRole("button", { name: "新增一個項目" })).toBeVisible();

    await page.getByRole("button", { name: "新增一個項目" }).click();
    await page.getByLabel("標題", { exact: true }).last().fill("第四個服務");

    // 驗的是**預覽真的多了那一項**，不是表單上多了一個欄位
    await expect(services).toContainText("第四個服務");

    // 刪掉再確認它真的從畫面上走了
    await page.getByRole("button", { name: /刪除第 4 項/ }).click();
    await expect(services).not.toContainText("第四個服務");
  });

  test("刪到剩一項就停手", async ({ page }) => {
    /*
     * 不是為了「至少留一點內容」，是因為欄位的形狀是從現在的值認出來的：
     * 空陣列既是空的字串陣列也是空的項目陣列，分不出來。
     * 刪光之後「新增一項」加出來的會是錯的形狀，那一塊直接不見。
     */
    await page.getByText("新增區塊").click();
    await page.getByRole("button", { name: "＋ 服務" }).click();

    await page.getByRole("button", { name: /刪除第 3 項/ }).click();
    await page.getByRole("button", { name: /刪除第 2 項/ }).click();

    await expect(page.getByRole("button", { name: /刪除第 1 項/ })).toBeDisabled();
  });

  test("axe 沒有 critical/serious，選取後也一樣", async ({ page }) => {
    const scan = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      return results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => `${v.id}: ${v.help}`);
    };

    expect(await scan()).toEqual([]);

    await page.locator("[data-section-widget]").first().getByRole("group").first().click();
    expect(await scan(), "選取狀態下的工具列有 a11y 問題").toEqual([]);
  });
});
