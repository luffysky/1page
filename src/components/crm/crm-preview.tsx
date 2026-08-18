"use client";

import { type CrmEntity } from "@/features/crm-builder/schema";

/**
 * 設計出來的東西長什麼樣子（CR-003-5）
 *
 * ── ⚠️ 這是表單的**照片**，不是表單 ──────────────────────────
 *
 * 與 CR-003-2 的 form 區塊同一個作法，而且是同一個理由：
 * 它不是 `<form>`、每個欄位都 `disabled`、另外給一段 sr-only 說明。
 *
 * 用 `disabled` 而不是 `readOnly`：`readOnly` 的輸入框**仍然吃 Tab**。
 * 使用者會停在一排打不了字的框上，再也找不到下一個能操作的東西——
 * 而 axe 不會報這件事（0813 踩過一次）。
 *
 * 為什麼不乾脆讓它能打字：這裡還沒有存記錄的地方（要先存下設計、
 * 有了帳號才有）。能打字卻存不了的表單，比一張看得出來是預覽的圖更糟。
 */
export function CrmPreview({ entity }: { entity: CrmEntity }) {
  const inputClass =
    "border-brand-line bg-brand-bg text-body mt-2 w-full rounded-md border px-4 py-3 opacity-60";

  return (
    <div className="border-brand-line bg-brand-paper rounded-lg border p-6">
      <p className="sr-only">
        以下是「{entity.name}」的預覽畫面，欄位不能輸入。存下這份設計之後， 可以在「我的
        CRM」裡真的填寫資料。
      </p>

      <h3 className="text-heading-1" aria-hidden="true">
        {entity.name}
      </h3>

      <div aria-hidden="true" className="mt-5 flex flex-col gap-4">
        {entity.fields.map((field) => (
          <div key={field.id}>
            <span className="text-body-sm block font-bold">
              {field.label}
              {field.required ? <span className="text-brand-accent-strong"> *</span> : null}
            </span>
            {field.hint ? (
              <span className="text-caption text-brand-muted mt-1 block">{field.hint}</span>
            ) : null}

            {field.type === "textarea" ? (
              <textarea disabled rows={3} className={inputClass} />
            ) : field.type === "select" ? (
              <select disabled className={inputClass}>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <span className="mt-2 flex items-center gap-2">
                <input type="checkbox" disabled />
                <span className="text-body-sm text-brand-muted">是／否</span>
              </span>
            ) : (
              <input
                disabled
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                className={inputClass}
              />
            )}
          </div>
        ))}

        <span className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-2 self-start px-6 py-3 font-bold opacity-60">
          儲存
        </span>
      </div>
    </div>
  );
}
