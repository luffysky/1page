"use client";

import { useSitePreview } from "@/features/website-engine/preview-context";

/**
 * Widget 外框（CR-003-4 第一段）
 *
 * 每個區塊外面包一層可選取、可搬動的框。
 *
 * ── 鍵盤從第一版就有，不是之後補 ──────────────────────────────
 *
 * WCAG 2.1 §2.5.7（Dragging Movements）要求：任何用拖曳完成的操作，
 * 都必須有不需要拖曳的替代方式。只能用滑鼠拖的編輯器會直接讓
 * 每個 Phase 都在擋的 axe serious 與「主要流程可完全用鍵盤走完」變紅。
 *
 * 而且這不能等拖曳做完再補——補的話等於整個介面重寫一次。
 * 所以順序是反過來的：**先做鍵盤，拖曳之後疊上去**，
 * 兩者呼叫同一個 `moveSection`。到那時拖曳只是另一種觸發方式，
 * 不是另一套邏輯。
 *
 * ── 為什麼工具列是 <div> 不是 nested <button> ────────────────
 *
 * 整塊區塊本身要可選取，直覺是把它做成一顆大按鈕——但按鈕裡面
 * 不能再放按鈕（HTML 不允許，瀏覽器會把它拆開重整），
 * 而模板區塊裡本來就有連結與嵌入的播放鈕。
 * 所以選取用的是一個 tabIndex 的容器，工具列是它旁邊的真按鈕。
 */
export function SectionWidget({
  id,
  label,
  index,
  total,
  selected,
  onSelect,
  children,
}: {
  id: string;
  label: string;
  index: number;
  total: number;
  selected: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const { moveSection, removeSection } = useSitePreview();

  const atTop = index === 0;
  const atBottom = index === total - 1;

  return (
    <div
      data-section-widget={id}
      className={`relative ${selected ? "outline-brand-accent-strong outline-2 outline-offset-[-2px]" : ""}`}
    >
      {/*
       * 這一層負責「選取」。用 group 而非 button 的理由見檔頭。
       * aria-label 講得出是哪一塊、第幾塊，因為視覺上的位置
       * 對讀螢幕的人不存在。
       */}
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label}（第 ${index + 1} 塊，共 ${total} 塊）`}
        aria-current={selected ? "true" : undefined}
        onFocus={() => onSelect(id)}
        onClick={() => onSelect(id)}
        className="focus-visible:outline-brand-ink focus-visible:outline-2"
      >
        {children}
      </div>

      {/*
       * 工具列只在選取時出現，但**不是用 CSS 藏起來**——
       * 沒選取時它根本不在 DOM 裡，所以不會有一堆看不見卻按得到的按鈕
       * 卡在 Tab 順序上（那正是 form 區塊那次踩到的問題）。
       */}
      {selected ? (
        <div
          className="bg-brand-ink text-brand-on-ink absolute top-2 right-2 z-10 flex items-center gap-1 rounded-pill px-2 py-1.5 shadow-lg"
          // 工具列是我們的介面，不是被預覽網站的一部分
          data-editor-chrome=""
        >
          <span className="text-caption px-2 font-bold">{label}</span>

          <button
            type="button"
            onClick={() => moveSection(id, "up")}
            disabled={atTop}
            aria-label={`把「${label}」往上移`}
            className="rounded-pill px-2.5 py-1 text-sm font-bold disabled:opacity-40"
          >
            ↑
          </button>

          <button
            type="button"
            onClick={() => moveSection(id, "down")}
            disabled={atBottom}
            aria-label={`把「${label}」往下移`}
            className="rounded-pill px-2.5 py-1 text-sm font-bold disabled:opacity-40"
          >
            ↓
          </button>

          <button
            type="button"
            onClick={() => removeSection(id)}
            aria-label={`移除「${label}」`}
            className="rounded-pill px-2.5 py-1 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
