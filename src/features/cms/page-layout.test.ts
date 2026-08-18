import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  backgroundOf,
  blockLabel,
  defaultHomeLayout,
  homeBlockIds,
  HOME_BLOCKS,
  blockNumbers,
  isLockedBlock,
  isNumberedBlock,
  numberedKicker,
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

describe("HOME_BLOCKS 與 Spec §4 的 IA 一致", () => {
  /*
   * ── 為什麼這條要跟規格比，而不是跟自己比 ──────────────────────
   *
   * `homepage.spec.ts` 有一條叫「IA 順序與 Spec §4 一致」，
   * 而它的預期順序是**從 HOME_BLOCKS 算出來的**——頁面也從
   * HOME_BLOCKS 渲染，所以兩邊一起動，那條測試永遠不可能紅。
   * 0818 把 HOME_BLOCKS 的順序調換去驗它，它照樣綠。
   *
   * 那是套套邏輯，不是守衛。真正要釘住的是**程式碼與規格之間**：
   * `page-layout.ts` 的檔頭寫著「改這裡就是改 §4，要走 §47 的 CR」，
   * 而這條測試就是那句話的執行者。
   *
   * 少了它，有人改順序卻沒改規格時，唯一的後果是規格悄悄變成假的——
   * 而規格是這個專案唯一的來源。
   */
  const SPEC = readFileSync("docs/1page-v1-spec.md", "utf8");

  /** §4 的 IA 用的是人看的名字，這裡是它與 block id 的對照 */
  const SPEC_NAME_TO_ID: Array<[string, string]> = [
    ["Hero", "hero"],
    ["Goal Selector", "goals"],
    ["Selected Work / Portfolio", "work"],
    ["Services", "services"],
    ["Website / Template Experience", "template"],
    ["AI Website Advisor", "advisor"],
    ["AI Philosophy", "philosophy"],
    ["Process", "process"],
    ["Pricing", "pricing"],
    ["Final CTA", "final-cta"],
  ];

  it("§4 的區塊順序與 HOME_BLOCKS 相同", () => {
    const section = SPEC.slice(SPEC.indexOf("# 4. Homepage IA"));
    const open = section.indexOf("```text");
    const ia = section.slice(open, section.indexOf("```", open + 7));

    /*
     * 依「在 §4 那段文字裡出現的位置」排序。
     * ⚠️ Navbar / Footer 不是可排的區塊，不列進對照表。
     */
    const fromSpec = SPEC_NAME_TO_ID.map(([name, id]) => {
      const at = ia.indexOf(name);
      expect(at, `§4 的 IA 裡找不到「${name}」——規格改了但這份對照表沒跟上`).toBeGreaterThan(-1);
      return { id, at };
    })
      .sort((a, b) => a.at - b.at)
      .map((entry) => entry.id);

    expect(
      homeBlockIds(),
      "HOME_BLOCKS 與 Spec §4 的 IA 不一致。改順序要同時走 §47 的 Change Request",
    ).toEqual(fromSpec);
  });

  it("對照表涵蓋每一個 block，沒有漏掉的", () => {
    // 反過來問：新增區塊時，有沒有人忘了把它寫進 §4。
    // 逐一列「services 要在對照表裡」的話，下次加新區塊又要記得補
    expect([...SPEC_NAME_TO_ID.map(([, id]) => id)].sort()).toEqual([...homeBlockIds()].sort());
  });
});

describe("區塊編號依版面位置算出來", () => {
  /*
   * ── 這一組在守什麼 ────────────────────────────────────────────
   *
   * 編號原本寫死在 `SECTION_COPY` 的 kicker 裡（`"01 / Goals"`），
   * 而 BJ-2 之後順序是**後台可以拖的**。兩者放在一起等於保證會對不上。
   *
   * 0818 依 CR-005 把 services 提前之後就真的發生了：
   * 畫面上出現「作品之後是 05 / SERVICES」。那不是 bug 被引入，
   * 是一個一直都在的組合終於被觸發。
   */

  const layoutOf = (ids: readonly string[], hidden: readonly string[] = []) =>
    ids.map((id) => ({ id, visible: !hidden.includes(id) }));

  it("編號照渲染順序，從 01 開始", () => {
    const numbers = blockNumbers(layoutOf(homeBlockIds()));

    expect(numbers.goals).toBe("01");
    // work 刻意不編號，所以下一個編號的是 services
    expect(numbers.work).toBeUndefined();
    expect(numbers.services).toBe("02");
  });

  it("⚠️ 搬動之後編號跟著換", () => {
    // 這正是 0818 那個「作品之後是 05 / SERVICES」的情境
    const rest = homeBlockIds().filter((id) => id !== "services");
    // services 插到 hero 之後、goals 之前——它就成了第一個要編號的
    const numbers = blockNumbers(layoutOf([rest[0]!, "services", ...rest.slice(1)]));

    expect(numbers.services).toBe("01");
    expect(numbers.goals).toBe("02");
  });

  it("⚠️ 關掉一塊之後，後面的編號要遞補上來", () => {
    /*
     * 不遞補的話，畫面上會出現 01、02、04——
     * 而使用者只會覺得「是不是有一段沒載出來」。
     */
    const numbers = blockNumbers(layoutOf(homeBlockIds(), ["goals"]));

    expect(numbers.goals).toBeUndefined();
    expect(numbers.services).toBe("01");
  });

  it("首屏、作品與最後那一段不編號", () => {
    const numbers = blockNumbers(layoutOf(homeBlockIds()));

    for (const id of ["hero", "work", "final-cta"]) {
      expect(numbers[id], `${id} 不該有編號`).toBeUndefined();
    }
  });

  it("每一個編號的區塊都真的拿得到號碼", () => {
    // 反過來問：有沒有哪一塊標了 numbered 卻算不出號碼
    const numbers = blockNumbers(layoutOf(homeBlockIds()));
    const missing = homeBlockIds().filter((id) => isNumberedBlock(id) && !numbers[id]);

    expect(missing, `這幾塊標了要編號卻沒有號碼：${missing.join("、")}`).toEqual([]);
  });
});

describe("numberedKicker", () => {
  it("把號碼冠上去", () => {
    expect(numberedKicker("Services", "02")).toBe("02 / Services");
  });

  it("⚠️ 先拔掉既有的號碼再冠", () => {
    /*
     * kicker 是 CMS 可編輯的欄位。有人在後台照著舊樣子打了「03 / Services」，
     * 或資料庫裡還留著搬家前存的那一版——不拔的話會變成
     * 「02 / 03 / Services」，而那看起來就是壞了。
     */
    expect(numberedKicker("03 / Services", "02")).toBe("02 / Services");
    expect(numberedKicker("3 / Services", "02")).toBe("02 / Services");
    expect(numberedKicker("  07 /  Services ", "02")).toBe("02 / Services");
  });

  it("沒有號碼時只回名字", () => {
    // work 這種不編號的區塊走這條
    expect(numberedKicker("Selected Work", undefined)).toBe("Selected Work");
    expect(numberedKicker("01 / Selected Work", undefined)).toBe("Selected Work");
  });

  it("kicker 是空的也不會產出一個孤零零的斜線", () => {
    expect(numberedKicker(undefined, "02")).toBe("02");
    expect(numberedKicker("", undefined)).toBe("");
  });
});
