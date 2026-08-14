import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  backgroundOf,
  blockLabel,
  defaultHomeLayout,
  homeBlockIds,
  HOME_BLOCKS,
  isLockedBlock,
  moveBlock,
  moveBlockTo,
  pageLayoutSchema,
  resolveHomeLayout,
  visibleBlocks,
  type LayoutBlock,
} from "./page-layout";

/**
 * 頁面版面（CR-004 / Phase B BJ-2）
 *
 * ── 這一組守的是「版面資料與真正畫出來的東西對不起來」 ─────────
 *
 * 版面壞掉的方式很特別：**在沒按過存檔的環境上完全正常**。
 * 新加了一塊區塊，開發機上看得到（沒有存過版面，走預設）；
 * 正式站上看不到（存過版面，而那份資料裡沒有新的 id）。
 * 那種差異幾乎不可能靠「我這邊看起來好好的」發現。
 */

/** 首頁的原始碼。反過來問「有沒有哪一塊沒畫」時要用 */
const HOME_SOURCE = readFileSync("src/app/page.tsx", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("區塊清單", () => {
  it("每一塊都有中文名", () => {
    for (const block of HOME_BLOCKS) {
      expect(block.label.trim().length, `${block.id} 沒有中文名`).toBeGreaterThan(0);
    }
  });

  it("id 不重複", () => {
    // 重複的話，搬動與開關會同時作用在兩塊上，而畫面上看起來像隨機的
    const ids = homeBlockIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("宣告的每一塊，首頁都真的畫得出來", () => {
    /*
     * ⚠️ 反過來問：`HOME_BLOCKS` 裡有沒有哪一個 id，
     * 在 `app/page.tsx` 的對應表裡沒有。
     *
     * 有的話，後台看得到那一塊、搬得動它、關得掉它——而畫面上
     * 從來沒有出現過。這正是這個專案犯過七次的那件事的變形：
     * **這次是後台有入口，而東西沒做。**
     */
    const missing = homeBlockIds().filter(
      (id) => !new RegExp(`(^|\\s|\\{)"?${id}"?:`, "m").test(HOME_SOURCE),
    );

    expect(missing, `這幾塊在後台排得動，但首頁沒有畫它們：${missing.join("、")}`).toEqual([]);
  });
});

describe("resolveHomeLayout", () => {
  it("沒有任何資料時就是預設順序，而且全部顯示", () => {
    expect(resolveHomeLayout(undefined).map((block) => block.id)).toEqual(homeBlockIds());
    expect(resolveHomeLayout(undefined).every((block) => block.visible)).toBe(true);
  });

  it("新加的區塊會被補回來，不是消失", () => {
    /*
     * ⚠️ 這是整組最重要的一條。
     *
     * 省略的話，新做好的區塊在「按過存檔」的環境上永遠不出現，
     * 而在沒按過的環境上正常——那種差異幾乎不可能被想到，
     * 而它的表現是「我這邊看起來好好的」。
     */
    const stale = { blocks: [{ id: "hero", visible: true }] };
    const resolved = resolveHomeLayout(stale);

    expect(resolved.map((block) => block.id).sort()).toEqual([...homeBlockIds()].sort());
    expect(
      resolved.find((block) => block.id === "process")?.visible,
      "補回來的區塊要是顯示的，不然等於沒補",
    ).toBe(true);
  });

  it("資料裡不認得的 id 會被丟掉", () => {
    const resolved = resolveHomeLayout({
      blocks: [
        { id: "已經拿掉的區塊", visible: true },
        { id: "hero", visible: true },
      ],
    });

    expect(resolved.map((block) => block.id)).not.toContain("已經拿掉的區塊");
  });

  it("順序照資料，不照程式碼", () => {
    const resolved = resolveHomeLayout({
      blocks: [
        { id: "pricing", visible: true },
        { id: "hero", visible: true },
      ],
    });

    expect(resolved.slice(0, 2).map((block) => block.id)).toEqual(["pricing", "hero"]);
  });

  it("鎖住的區塊就算資料說要關也會被打開", () => {
    /*
     * 首屏與最後的行動區塊是這一頁存在的理由：一個負責讓人留下來，
     * 一個負責讓人採取下一步。一份舊資料不該能讓首頁永遠沒有 CTA。
     */
    const resolved = resolveHomeLayout({
      blocks: [
        { id: "hero", visible: false },
        { id: "final-cta", visible: false },
        { id: "goals", visible: false },
      ],
    });

    expect(resolved.find((block) => block.id === "hero")?.visible).toBe(true);
    expect(resolved.find((block) => block.id === "final-cta")?.visible).toBe(true);
    // 沒鎖的那個要照資料關掉，不然這條就只是「全部都打開」
    expect(resolved.find((block) => block.id === "goals")?.visible).toBe(false);
  });
});

describe("visibleBlocks", () => {
  it("關掉的不出現", () => {
    const visible = visibleBlocks({
      blocks: [
        { id: "goals", visible: false },
        { id: "hero", visible: true },
      ],
    });

    expect(visible.map((block) => block.id)).not.toContain("goals");
    expect(visible.map((block) => block.id)).toContain("hero");
  });
});

describe("moveBlock", () => {
  const blocks: LayoutBlock[] = [
    { id: "a", visible: true },
    { id: "b", visible: true },
    { id: "c", visible: true },
  ];

  it("往上往下都走得動", () => {
    expect(moveBlock(blocks, "b", "up").map((block) => block.id)).toEqual(["b", "a", "c"]);
    expect(moveBlock(blocks, "b", "down").map((block) => block.id)).toEqual(["a", "c", "b"]);
  });

  it("到頭了就停手，不要繞回去", () => {
    /*
     * 繞回去的話，第一塊按「往上」會跳到最後——使用者以為自己按錯了，
     * 而畫面已經整個換了順序。
     */
    expect(moveBlock(blocks, "a", "up").map((block) => block.id)).toEqual(["a", "b", "c"]);
    expect(moveBlock(blocks, "c", "down").map((block) => block.id)).toEqual(["a", "b", "c"]);
  });

  it("不動到原本那份", () => {
    const before = JSON.stringify(blocks);
    moveBlock(blocks, "b", "up");
    expect(JSON.stringify(blocks)).toBe(before);
  });
});

describe("moveBlockTo", () => {
  const blocks: LayoutBlock[] = [
    { id: "a", visible: true },
    { id: "b", visible: true },
    { id: "c", visible: true },
  ];

  it("拖到某一塊的位置", () => {
    expect(moveBlockTo(blocks, "c", "a").map((block) => block.id)).toEqual(["c", "a", "b"]);
    expect(moveBlockTo(blocks, "a", "c").map((block) => block.id)).toEqual(["b", "c", "a"]);
  });

  it("拖到自己身上什麼都不變", () => {
    expect(moveBlockTo(blocks, "b", "b").map((block) => block.id)).toEqual(["a", "b", "c"]);
  });

  it("拖曳與鍵盤走的是同一段邏輯", () => {
    /*
     * 相鄰兩塊互換時，兩條路必須得到一樣的結果。
     *
     * 各寫一份的話，鍵盤那條遲早與滑鼠那條行為不一樣，
     * 而只有用鍵盤的人會遇到——也就是最不會被回報的那種 bug。
     */
    expect(moveBlockTo(blocks, "b", "a")).toEqual(moveBlock(blocks, "b", "up"));
  });
});

describe("schema 與輔助函式", () => {
  it("預設版面通得過自己的 schema", () => {
    expect(pageLayoutSchema.safeParse(defaultHomeLayout()).success).toBe(true);
  });

  it("blockLabel 查不到就回原本的 id", () => {
    expect(blockLabel("goals")).toBe("你今天想完成什麼");
    expect(blockLabel("不存在")).toBe("不存在");
  });

  it("isLockedBlock 只鎖該鎖的", () => {
    expect(isLockedBlock("hero")).toBe(true);
    expect(isLockedBlock("final-cta")).toBe(true);
    expect(isLockedBlock("goals")).toBe(false);
  });

  it("backgroundOf 找得到，找不到就是沒有", () => {
    const blocks: LayoutBlock[] = [
      { id: "hero", visible: true, background: { type: "color", color: "#000" } },
    ];

    expect(backgroundOf(blocks, "hero")?.color).toBe("#000");
    expect(backgroundOf(blocks, "goals")).toBeUndefined();
  });
});
