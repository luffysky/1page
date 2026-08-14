"use client";

import { useActionState } from "react";

import { addDealItem } from "@/features/backoffice/actions";

/**
 * 新增報價明細（CR-004 / Phase B BE）
 *
 * 與 `client-actions.tsx` 同一個理由是 client component：
 * `<form action={…}>` 要求 action 回傳 void，也就是失敗時什麼都不會說。
 */

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export function AddDealItemForm({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => addDealItem(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="dealId" value={dealId} />

      <label className="block">
        <span className="text-caption text-brand-muted">項目說明</span>
        <input name="description" required maxLength={300} className={`${input} mt-1`} />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-caption text-brand-muted">數量</span>
          <input
            name="quantity"
            inputMode="decimal"
            defaultValue="1"
            maxLength={8}
            className={`${input} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">單價</span>
          <input name="unitPrice" inputMode="decimal" maxLength={12} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">服務代號</span>
          <input name="serviceId" maxLength={40} className={`${input} mt-1`} />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "新增中…" : "新增明細"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
