"use client";

import { useActionState } from "react";

import { addCrmRecordAction } from "@/app/crm/actions";
import type { CrmEntity } from "@/features/crm-builder/schema";

/**
 * 照著自己設計的結構填一筆（CR-003-5）
 *
 * ── 表單長什麼樣子由使用者的定義決定 ─────────────────────────
 *
 * 這與後台的 CMS 編輯器是同一招：**表單照著資料的形狀長出來**，
 * 所以之後多一種欄位型別不用改這個元件。
 *
 * ⚠️ 欄位名稱一律加 `field:` 前綴。
 * 使用者的欄位 id 是他自己取的，沒有前綴的話，一個叫 `entity` 的欄位
 * 會把表單裡真正的 entity 蓋掉——而那筆資料會安靜地存到別一類去。
 *
 * ⚠️ 這裡的 required 只是瀏覽器的提示。真正的驗證在 server action，
 * 而且用的是**從資料庫讀出來的**定義，不是表單送上來的那份。
 */
export function RecordForm({ definitionId, entity }: { definitionId: string; entity: CrmEntity }) {
  const [state, action, pending] = useActionState(addCrmRecordAction, null);

  const inputClass =
    "border-brand-line bg-brand-bg text-body mt-2 w-full rounded-md border px-4 py-3";

  return (
    <form action={action} className="border-brand-line bg-brand-paper rounded-lg border p-6">
      <input type="hidden" name="definitionId" value={definitionId} />
      <input type="hidden" name="entity" value={entity.id} />

      {/*
       * ⚠️ 這裡沒有標題。
       *
       * 表單收在 `<details>` 裡，而 `<summary>` 已經寫著
       * 「新增一筆「客戶」」——再放一個一模一樣的 h2，
       * 螢幕閱讀器會把同一句話唸兩次。
       */}
      <div className="flex flex-col gap-4">
        {entity.fields.map((field) => {
          const name = `field:${field.id}`;

          return (
            <label key={field.id} className="block">
              <span className="text-body-sm block font-bold">
                {field.label}
                {field.required ? <span className="text-brand-accent-strong"> *</span> : null}
              </span>
              {field.hint ? (
                <span className="text-caption text-brand-muted mt-1 block">{field.hint}</span>
              ) : null}

              {field.type === "textarea" ? (
                <textarea name={name} rows={3} required={field.required} className={inputClass} />
              ) : field.type === "select" ? (
                <select name={name} required={field.required} className={inputClass}>
                  {/* 選填時要有一個「不選」的位置，否則第一個選項會變成預設答案 */}
                  {!field.required ? <option value="">（不填）</option> : null}
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <span className="mt-2 flex items-center gap-2">
                  <input type="checkbox" name={name} />
                  <span className="text-body-sm text-brand-muted">勾起來表示是</span>
                </span>
              ) : (
                <input
                  name={name}
                  required={field.required}
                  type={
                    field.type === "number" ? "number" : field.type === "date" ? "date" : "text"
                  }
                  step={field.type === "number" ? "any" : undefined}
                  className={inputClass}
                />
              )}
            </label>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-6 px-6 py-3 font-bold disabled:opacity-50"
      >
        {pending ? "存檔中…" : "儲存"}
      </button>

      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-body-sm mt-4 font-bold ${state.ok ? "" : "text-brand-accent-strong"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
