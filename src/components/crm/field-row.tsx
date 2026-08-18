"use client";

import { CRM_FIELD_TYPE_LABELS, type CrmField } from "@/features/crm-builder/schema";

/**
 * 設計面板裡的一列欄位（CR-003-5）
 *
 * ── 三種輸入方式，一條邏輯 ───────────────────────────────────
 *
 *   滑鼠   拖曳
 *   鍵盤   Tab 到 ↑ ↓ 按 Enter
 *   觸控   直接點 ↑ ↓
 *
 * 三者最後都呼叫同一個 `moveField`（`crm-builder/ops.ts`）。
 * 這與 CR-003-4 的區塊編輯器是**同一個 `moveInOrder`**——
 * 抽在 `lib/reorder`，所以兩邊在邊界條件上不可能有不同的行為。
 *
 * WCAG 2.1 §2.5.7：拖曳一定要有非拖曳的替代路徑。
 * 那也是為什麼 ↑ ↓ 是真的按鈕，不是 `draggable` 的裝飾。
 */

export interface FieldRowProps {
  field: CrmField;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
  dragging: boolean;
}

export function FieldRow({
  field,
  index,
  total,
  selected,
  onSelect,
  onMove,
  onRemove,
  onDragStart,
  onDropOn,
  dragging,
}: FieldRowProps) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn();
      }}
      className={`border-brand-line bg-brand-paper flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
        selected ? "outline-brand-ink outline-2 outline-offset-2" : ""
      } ${dragging ? "opacity-50" : ""}`}
    >
      {/*
       * 抓柄是裝飾，不是操作元件——它 aria-hidden，因為鍵盤使用者
       * 用的是下面那兩顆真的按鈕。給它一個 role 只會多一個
       * Tab 停下來卻做不了事的地方。
       */}
      <span aria-hidden="true" className="text-caption text-brand-muted cursor-grab select-none">
        ⠿
      </span>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
        aria-pressed={selected}
      >
        <span className="text-body-sm block truncate font-bold">{field.label}</span>
        <span className="text-caption text-brand-muted block">
          {CRM_FIELD_TYPE_LABELS[field.type]}
          {field.required ? "・必填" : ""}
        </span>
      </button>

      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          // 每一顆都說出「哪一個欄位」。只寫「上移」的話，螢幕閱讀器
          // 使用者在二十顆一模一樣的按鈕之間分不出自己按到哪一個
          aria-label={`把「${field.label}」往上移`}
          className="border-brand-line text-caption rounded-md border px-2 py-1 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === total - 1}
          aria-label={`把「${field.label}」往下移`}
          className="border-brand-line text-caption rounded-md border px-2 py-1 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除「${field.label}」`}
          className="text-caption text-brand-muted px-2 py-1 underline underline-offset-4"
        >
          移除
        </button>
      </span>
    </li>
  );
}
