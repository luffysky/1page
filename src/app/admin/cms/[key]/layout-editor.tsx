"use client";

import { useActionState, useState } from "react";

import { BackgroundFields } from "@/components/editor/background-panel";
import { saveCmsDocument } from "@/features/cms/actions";
import {
  blockLabel,
  defaultHomeLayout,
  isLockedBlock,
  moveBlock,
  moveBlockTo,
  resolveHomeLayout,
  type LayoutBlock,
  type PageLayout,
} from "@/features/cms/page-layout";
import type { SectionBackground } from "@/features/website-engine/schema";

/**
 * 首頁版面編輯器（CR-004 / Phase B BJ-2）
 *
 * ── 拖曳與鍵盤走同一段邏輯 ────────────────────────────────────
 *
 * WCAG 2.1 §2.5.7：任何用拖曳完成的操作都要有不需拖曳的替代方式。
 *
 * 這裡兩條路都呼叫 `page-layout.ts` 的純函式（`moveBlock` /
 * `moveBlockTo`），而且有一條單元測試驗「相鄰互換時兩者結果相同」。
 * 各寫一份的話，鍵盤那條遲早與滑鼠那條行為不一樣，
 * 而只有用鍵盤的人會遇到——也就是最不會被回報的那種 bug。
 *
 * ── 存檔前不會自己套用 ────────────────────────────────────────
 *
 * 拖一下就直接寫進資料庫的話，中途反悔沒有退路，而首頁是對外的。
 * 所以這裡是本地狀態 + 一顆明確的存檔。
 */

const dropTargetClass = "border-brand-ink border-dashed";

function BlockRow({
  block,
  index,
  total,
  expanded,
  dragOver,
  signedIn,
  onToggleExpanded,
  onMove,
  onDropOn,
  onSetVisible,
  onSetBackground,
  onDragState,
}: {
  block: LayoutBlock;
  index: number;
  total: number;
  expanded: boolean;
  dragOver: boolean;
  signedIn: boolean;
  onToggleExpanded: () => void;
  onMove: (direction: "up" | "down") => void;
  onDropOn: (draggedId: string) => void;
  onSetVisible: (visible: boolean) => void;
  onSetBackground: (background: SectionBackground) => void;
  onDragState: (id: string | null) => void;
}) {
  const label = blockLabel(block.id);
  const locked = isLockedBlock(block.id);

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", block.id);
        onDragState(block.id);
      }}
      onDragEnd={() => onDragState(null)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragState(block.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        /*
         * ⚠️ 被拖的是誰要從 dataTransfer 讀，不能從 React state 讀。
         *
         * 拖曳期間 React 不保證重新 render，state 可能是舊的快照。
         * dataTransfer 就是為了這件事存在的。
         */
        onDropOn(event.dataTransfer.getData("text/plain"));
        onDragState(null);
      }}
      className={`border-brand-line rounded-lg border p-4 ${dragOver ? dropTargetClass : ""} ${
        block.visible ? "" : "opacity-60"
      }`}
    >
      <div
        role="group"
        aria-label={`${label}（第 ${index + 1} 塊，共 ${total} 塊）`}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          {/* 握把只是視覺提示：整列都是 draggable，所以它不需要自己接事件 */}
          <span aria-hidden className="text-brand-muted cursor-grab select-none">
            ⠿
          </span>
          <div>
            <p className="text-body font-bold">{label}</p>
            <p className="text-caption text-brand-muted mt-0.5">
              第 {index + 1} 塊{block.visible ? "" : " · 已隱藏"}
              {block.background ? " · 有背景" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={`把「${label}」往上移`}
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="border-brand-line text-caption rounded-pill border px-3 py-1 disabled:opacity-30"
          >
            往上移
          </button>
          <button
            type="button"
            aria-label={`把「${label}」往下移`}
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="border-brand-line text-caption rounded-pill border px-3 py-1 disabled:opacity-30"
          >
            往下移
          </button>

          {/*
           * 鎖住的區塊沒有開關，而且**說得出為什麼**。
           *
           * 只把按鈕變灰的話，看到的人會以為壞了然後一直按。
           */}
          {locked ? (
            <span className="text-caption text-brand-muted">這一塊不能關</span>
          ) : (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={block.visible}
                onChange={(event) => onSetVisible(event.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-caption">顯示</span>
            </label>
          )}

          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            className="border-brand-line text-caption rounded-pill border px-3 py-1"
          >
            {expanded ? "收起背景" : `設定「${label}」的背景`}
          </button>
        </div>
      </div>

      {expanded ? (
        <BackgroundFields
          background={block.background}
          signedIn={signedIn}
          onChange={onSetBackground}
        />
      ) : null}
    </li>
  );
}

export function LayoutEditor({
  cmsKey,
  initial,
  signedIn,
}: {
  cmsKey: string;
  initial: PageLayout;
  signedIn: boolean;
}) {
  /*
   * 一進來就先 resolve 一次。
   *
   * 存過的版面可能是「還沒有某一塊」的舊資料，而編輯器上少一塊的話，
   * 存檔會把那一塊**永久排除**——使用者從來沒看到過它，
   * 卻在不知情的狀況下把它關掉了。
   */
  const [blocks, setBlocks] = useState<LayoutBlock[]>(() => resolveHomeLayout(initial));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [state, action, pending] = useActionState(saveCmsDocument, null);

  const patch = (id: string, next: Partial<LayoutBlock>) =>
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...next } : block)),
    );

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="key" value={cmsKey} />
      <input type="hidden" name="content" value={JSON.stringify({ blocks }, null, 2)} />

      <p className="border-brand-line text-body-sm rounded-lg border border-dashed p-4">
        可以改的是<strong>順序</strong>、<strong>要不要顯示</strong>、以及每一塊的
        <strong>背景</strong>。
        <span className="text-brand-muted mt-1 block">
          一塊裡面寫什麼在「內容管理」的其他文件裡改。這幾塊不是文字方塊——
          目標選擇器會連動作品與服務、AI 顧問是一段真的會對話的介面——
          所以它們搬得動、關得掉，但沒辦法再拖一個進來。
        </span>
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            expanded={expanded === block.id}
            dragOver={dragOver === block.id}
            signedIn={signedIn}
            onToggleExpanded={() => setExpanded(expanded === block.id ? null : block.id)}
            onMove={(direction) => setBlocks((current) => moveBlock(current, block.id, direction))}
            onDropOn={(draggedId) =>
              setBlocks((current) => moveBlockTo(current, draggedId, block.id))
            }
            onSetVisible={(visible) => patch(block.id, { visible })}
            onSetBackground={(background) =>
              patch(block.id, {
                // type: "none" 就把欄位拿掉，不要留一個空殼在資料裡
                background: background.type === "none" ? undefined : background,
              })
            }
            onDragState={setDragOver}
          />
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-6 py-3 font-bold disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存版面"}
        </button>

        {/*
         * 回到預設。
         *
         * ⚠️ 這不只是方便。排壞了之後**沒有回頭路**是真的會發生的事：
         * 關掉三塊、搬了五次，再也想不起來原本是什麼順序。
         * 訪客的編輯器有「回到模板原樣」，這裡是同一件事。
         *
         * 只改本地狀態，還要按存檔才生效——按錯了不會直接動到對外的首頁。
         */}
        <button
          type="button"
          onClick={() => setBlocks(resolveHomeLayout(defaultHomeLayout()))}
          className="border-brand-line text-body-sm rounded-pill border px-6 py-3"
        >
          回到預設版面
        </button>

        <a href="/" target="_blank" rel="noreferrer" className="text-body-sm underline">
          存檔後看首頁 ↗
        </a>
      </div>

      {state ? (
        <p
          role="status"
          className={`text-body-sm mt-4 ${
            state.ok ? "text-brand-muted" : "text-brand-accent-strong font-bold"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
