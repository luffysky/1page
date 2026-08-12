"use client";

import { useState } from "react";

import { ContentPanel } from "@/components/editor/content-panel";
import { SectionWidget } from "@/components/editor/section-widget";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { addableSectionTypes, SECTION_LABELS } from "@/features/website-engine/section-presets";
import { SiteRenderer } from "@/features/website-engine/site-renderer";

/**
 * 區塊編輯器（CR-003-4）
 *
 * 每個區塊是一個 widget：選取、搬動、移除、在中間插新的。
 *
 * ── 定價 B ────────────────────────────────────────────────────
 *
 * 「免費編輯、存檔才付費」。所以這一頁不需要登入、不需要付費，
 * 排出來的東西存在 sessionStorage（見 preview-context）。
 * 要把它變成一個真的網站才進 Website Workshop。
 *
 * ── 三種輸入方式，一條邏輯 ───────────────────────────────────
 *
 *   滑鼠   拖曳
 *   鍵盤   Tab 到工具列按 Enter
 *   觸控   直接點 ↑ ↓（按鈕本來就好點）
 *
 * 三者最後都呼叫同一個 `moveSection`。順序是刻意反過來做的：
 * 第一段先做鍵盤，第二段才疊上拖曳——先做拖曳再補鍵盤等於整個介面
 * 重寫一次，而 WCAG 2.1 §2.5.7 讓「不補」不是一個選項。
 */

export function SectionEditor() {
  const {
    config,
    sectionsEdited,
    resetSections,
    moveSection,
    addSection,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSitePreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: string | null; over: string | null }>({
    from: null,
    over: null,
  });

  const total = config.sections.length;
  const ids = config.sections.map((section) => section.id);
  const selected = config.sections.find((section) => section.id === selectedId) ?? null;

  /*
   * 拖放最後也是呼叫 moveSection，一次一步走到定位。
   *
   * 為什麼不另外寫一個「移到第 N 位」的 action：那會變成第二條
   * 改順序的路徑，而兩條路徑遲早會在邊界條件上不一致
   * （最常見的是「往下拖」時索引要不要減一）。
   * 重用同一個 action 的代價只是多幾次 dispatch，換來的是
   * 鍵盤與拖曳**在結構上不可能有不同的行為**。
   */
  const handleDrop = (from: string, targetId: string) => {
    setDrag({ from: null, over: null });
    if (!from || from === targetId) return;

    const fromIndex = ids.indexOf(from);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const direction = fromIndex < toIndex ? "down" : "up";
    for (let step = 0; step < Math.abs(toIndex - fromIndex); step += 1) {
      moveSection(from, direction);
    }
    setSelectedId(from);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-brand-muted">
          點一下任何一塊來選取，然後用 ↑ ↓ 搬動它。共 {total} 塊。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/*
           * 復原／重做。刪錯一塊原本只能「回到模板原樣」——那等於全部重來，
           * 排了十分鐘的人不敢按任何一顆看起來會刪東西的按鈕。
           */}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold disabled:opacity-40"
          >
            ↺ 復原
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold disabled:opacity-40"
          >
            ↻ 重做
          </button>

          {sectionsEdited ? (
            <button
              type="button"
              onClick={() => {
                resetSections();
                setSelectedId(null);
              }}
              className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
            >
              回到模板原樣
            </button>
          ) : null}
        </div>
      </div>

      <details className="border-brand-line mb-4 rounded-lg border p-4">
        <summary className="text-body-sm cursor-pointer font-bold">新增區塊</summary>
        <p className="text-caption text-brand-muted mt-2">
          {selectedId ? "會加在目前選取那一塊的後面。" : "會加在最後面。先選一塊就能插在它後面。"}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {addableSectionTypes().map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addSection(type, selectedId)}
              className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
            >
              ＋ {SECTION_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      </details>

      {/*
       * 捲動容器要能用鍵盤操作，理由與首頁預覽相同：
       * 只有滑鼠捲得動的區塊，鍵盤使用者看不到下半部（axe serious）。
       */}
      {/*
       * 窄螢幕上下堆疊、寬螢幕左右並排。
       *
       * 手機上把編輯面板擠在旁邊只會讓兩邊都不能用；
       * 堆疊之後預覽在上、正在改的欄位在下，捲一下就看得到結果。
       */}
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div
          tabIndex={0}
          role="group"
          aria-label="網站編輯區"
          className="border-brand-line max-h-[42rem] overflow-y-auto rounded-lg border"
        >
          <SiteRenderer
            config={config}
            wrapSection={(section, index, rendered) => (
              <SectionWidget
                id={section.id}
                label={SECTION_LABELS[section.type] ?? section.type}
                index={index}
                total={total}
                selected={selectedId === section.id}
                onSelect={setSelectedId}
                dragging={drag.from === section.id}
                dropTarget={
                  drag.over === section.id && drag.from !== null && drag.from !== section.id
                }
                onDragState={(from, over) =>
                  setDrag((current) => ({
                    from: from ?? current.from,
                    over: over ?? (from ? null : current.over),
                  }))
                }
                onDrop={handleDrop}
              >
                {rendered}
              </SectionWidget>
            )}
          />
        </div>

        {selected ? (
          <ContentPanel key={selected.id} section={selected} />
        ) : (
          <p className="border-brand-line text-body-sm text-brand-muted rounded-lg border border-dashed p-4">
            選一塊來編輯它的文字與排版。
          </p>
        )}
      </div>
    </div>
  );
}
