"use client";

import {
  CRM_FIELD_TYPE_LABELS,
  CRM_FIELD_TYPES,
  type CrmFieldType,
} from "@/features/crm-builder/schema";
import type { ColumnInference } from "@/features/crm-builder/import/infer";

/**
 * 猜出來的欄位，逐欄讓人確認（CR-003-5 匯入）
 *
 * ── 猜測是草稿，不是既成事實 ──────────────────────────────────
 *
 * 每一列三件事：欄名、猜的型別（可以改）、**為什麼這樣猜**加上實際的值。
 * 少了後面那兩樣，畫面上就只是一排下拉選單擺在那裡，
 * 而使用者沒有任何依據決定要不要動它。
 *
 * ⚠️ 該看的那幾欄要看得出來——而且只有那幾欄。
 *
 * 第一版把所有「不確定」的都標起來，結果六欄裡有三欄掛著提醒，
 * 使用者一路按到底，真正該看的那一欄就跟著漏掉了。
 * 現在只標**猜錯會有代價**的（見 infer.ts 的 needsReview）。
 */
export function ImportColumns({
  columns,
  onChangeType,
}: {
  columns: ColumnInference[];
  onChangeType: (index: number, type: CrmFieldType) => void;
}) {
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {columns.map((column, index) => (
        <li
          key={`${column.header}-${index}`}
          className="border-brand-line rounded-lg border p-3 sm:flex sm:items-start sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-bold">
              {column.header}
              {column.needsReview ? (
                <span className="text-caption text-brand-accent-strong ml-2">請看一下</span>
              ) : null}
            </p>
            <p className="text-caption text-brand-muted mt-1">{column.reason}</p>
            {column.samples.length > 0 ? (
              <p className="text-caption text-brand-muted mt-1">
                例如：{column.samples.join("、")}
              </p>
            ) : null}
          </div>

          <label className="mt-2 block sm:mt-0 sm:w-40">
            <span className="text-caption text-brand-muted block">存成</span>
            <select
              value={column.type}
              onChange={(event) => onChangeType(index, event.target.value as CrmFieldType)}
              aria-label={`「${column.header}」要存成哪一種`}
              className="border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2"
            >
              {CRM_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CRM_FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        </li>
      ))}
    </ul>
  );
}
