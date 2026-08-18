import { z } from "zod";

import { sectionBackgroundSchema, type SectionBackground } from "@/features/website-engine/schema";

/**
 * 頁面版面（CR-004 / Phase B BJ-2）
 *
 * ── 先說清楚這裡做得到與做不到什麼 ────────────────────────────
 *
 * 「用前台那種排版方式來排我們自己的頁面」聽起來像是把首頁換成
 * 一塊空白畫布，然後什麼都能拖進去。**那件事對這個網站是假的。**
 *
 * 首頁上的那些區塊不是內容元件：
 *   - 目標選擇器是整頁的 context controller，選了之後作品、模板、
 *     服務三處要跟著反應
 *   - AI 顧問是一段真的會跟後端對話的介面
 *   - 模板體驗區塊裡面是一整個即時預覽引擎
 *
 * 這些東西沒辦法用文字方塊拼出來，也沒辦法「再拖一個進來」——
 * 拖第二個 AI 顧問只會得到兩個搶同一份狀態的對話框。
 *
 * 做一個看起來什麼都能拖、實際上只有三種積木有用的畫布，
 * 比誠實地說「這幾塊可以搬、可以關、可以換背景」更糟：
 * 前者要等使用者拖了半天才發現，後者一眼就知道界線在哪。
 *
 * ── 所以這份資料能表達的是 ────────────────────────────────────
 *
 *   1. 順序      —— 拖曳或鍵盤改
 *   2. 顯示與否  —— 關掉一塊，不必刪掉它的內容
 *   3. 背景      —— 純色／漸層／圖片／影片（與 BJ-1 同一組控制項）
 *
 * 這三件事在真實的行銷網站上就是「改版面」的絕大部分。
 * 至於一塊裡面寫什麼，那是 CMS 的另外十三份文件在管的事。
 *
 * ── 區塊清單由程式碼決定，不由資料決定 ────────────────────────
 *
 * ⚠️ 這一點與 `mergeGoalCopy` 是同一個判斷。
 *
 * 資料裡少了某一塊時，它**回到預設位置並保持顯示**，不是消失。
 * 反過來的話，一份舊資料會讓新加的區塊在畫面上永遠不出現——
 * 而那正是這個專案犯過七次的那件事：東西做好了，畫面上沒有入口。
 */

/**
 * 首頁上可以排的區塊。
 *
 * ⚠️ 順序就是預設順序，而且它必須與 Spec §4 的 IA 一致。
 * **改這裡就是改 §4，要走 §47 的 Change Request**（CR-005 就是這樣來的）。
 * `page-layout.test.ts` 會反過來問：`app/page.tsx` 有沒有渲染
 * 這裡沒有列到的區塊，或列了卻沒有渲染的。
 */
export const HOME_BLOCKS = [
  { id: "hero", label: "首屏", locked: true },
  /*
   * ⚠️ goals 必須排在 work / services / template / advisor **之前**。
   *
   * 它是那四塊的 context controller（`useHomeGoal`），而 `setGoal`
   * 只有一個呼叫點就在這一塊裡面。把它排到那四塊後面的話，
   * 使用者選了目標之後，會變的是他已經捲過去的內容——
   * 而畫面上不會有任何提示。
   *
   * 也因此**它不能被關掉**（雖然沒有標 locked）：關掉之後
   * 整套目標選擇只剩 `?goal=` 的網址觸發得了，而那等於沒有入口。
   * 要拿掉它，得先把 setGoal 接到別的地方（CTA / Project Builder /
   * AI 顧問其中之一）——那是程式工作，不是排版工作。
   */
  { id: "goals", label: "你今天想完成什麼" },
  { id: "work", label: "精選作品" },
  { id: "services", label: "服務項目" },
  { id: "template", label: "自己試穿" },
  { id: "advisor", label: "AI 顧問" },
  { id: "philosophy", label: "我們怎麼看 AI" },
  { id: "process", label: "合作流程" },
  { id: "pricing", label: "價格" },
  { id: "final-cta", label: "最後那一段", locked: true },
] as const;

export type HomeBlockId = (typeof HOME_BLOCKS)[number]["id"];

/**
 * `locked` 的意思是**不能關掉**，不是不能搬。
 *
 * 首屏與最後的行動區塊是這一頁存在的理由：一個負責讓人留下來，
 * 一個負責讓人採取下一步。關掉任何一個，這頁就不再是一個
 * 會帶來生意的頁面，而是一份簡介。
 *
 * 順序仍然可以改——把 CTA 往上搬是一個合理的實驗。
 */
export function isLockedBlock(id: string): boolean {
  return HOME_BLOCKS.some((block) => block.id === id && "locked" in block && block.locked);
}

export const homeBlockIds = (): HomeBlockId[] => HOME_BLOCKS.map((block) => block.id);

export const blockLabel = (id: string): string =>
  HOME_BLOCKS.find((block) => block.id === id)?.label ?? id;

const layoutBlockSchema = z.object({
  id: z.string().min(1).max(40),
  visible: z.boolean(),
  background: sectionBackgroundSchema.optional(),
});

export const pageLayoutSchema = z.object({
  blocks: z.array(layoutBlockSchema).max(40),
});

export type LayoutBlock = z.infer<typeof layoutBlockSchema>;
export type PageLayout = z.infer<typeof pageLayoutSchema>;

/** 什麼都沒設定過的樣子：照程式碼的順序，全部顯示，沒有背景 */
export function defaultHomeLayout(): PageLayout {
  return { blocks: homeBlockIds().map((id) => ({ id, visible: true })) };
}

/**
 * 資料 + 程式碼 → 真正要渲染的順序。
 *
 * ⚠️ 三件事在這裡一起發生，每一件都對應一種會真的出現的資料：
 *
 *   1. 資料裡有、程式碼沒有的 id  → 丟掉
 *      （某一塊被移除之後，舊資料還留著它）
 *   2. 程式碼有、資料裡沒有的 id  → 補在最後，而且是顯示的
 *      （新加了一塊，而資料是加之前存的）
 *   3. 鎖住的區塊被關掉           → 強制打開
 *      （不然一份舊資料能讓首頁永遠沒有 CTA）
 *
 * 第 2 點是關鍵：補進來而不是省略。省略的話，新做好的區塊
 * 在按過存檔的環境上永遠不出現，而在沒按過的環境上正常——
 * 那種差異幾乎不可能被想到。
 */
export function resolveHomeLayout(layout: PageLayout | undefined): LayoutBlock[] {
  const known = new Set<string>(homeBlockIds());
  const saved = layout?.blocks ?? [];

  const kept = saved
    .filter((block) => known.has(block.id))
    .map((block) => ({
      ...block,
      visible: isLockedBlock(block.id) ? true : block.visible,
    }));

  const seen = new Set(kept.map((block) => block.id));
  const missing = homeBlockIds()
    .filter((id) => !seen.has(id))
    .map((id) => ({ id, visible: true }));

  return [...kept, ...missing];
}

/** 只給看得見的那幾塊，並附上背景。畫面直接用這個 */
export function visibleBlocks(layout: PageLayout | undefined): LayoutBlock[] {
  return resolveHomeLayout(layout).filter((block) => block.visible);
}

/** 某一塊的背景。找不到就沒有背景 */
export function backgroundOf(
  blocks: readonly LayoutBlock[],
  id: string,
): SectionBackground | undefined {
  return blocks.find((block) => block.id === id)?.background;
}

/**
 * 搬動一塊。回傳新的陣列；搬不動就原樣回傳。
 *
 * ⚠️ 純函式，因為拖曳與鍵盤兩條路要走同一段邏輯。
 * 各寫一份的話，鍵盤那條遲早與滑鼠那條行為不一樣，
 * 而只有用鍵盤的人會遇到——也就是最不會被回報的那種 bug。
 */
export function moveBlock(
  blocks: readonly LayoutBlock[],
  id: string,
  direction: "up" | "down",
): LayoutBlock[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return [...blocks];

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= blocks.length) return [...blocks];

  const next = [...blocks];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** 拖曳用：把 id 移到 targetId 的位置 */
export function moveBlockTo(
  blocks: readonly LayoutBlock[],
  id: string,
  targetId: string,
): LayoutBlock[] {
  if (id === targetId) return [...blocks];

  const from = blocks.findIndex((block) => block.id === id);
  const to = blocks.findIndex((block) => block.id === targetId);
  if (from < 0 || to < 0) return [...blocks];

  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
