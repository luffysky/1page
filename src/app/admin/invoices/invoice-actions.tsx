"use client";

import { useActionState } from "react";

import { addInvoiceLine, addPayment } from "@/features/backoffice/actions";

/**
 * 明細與收款兩個表單（CR-004 / Phase B BG）
 *
 * 與 `client-actions.tsx` 同樣的理由是 client component：
 * `<form action={…}>` 要求 action 回傳 void，也就是失敗時什麼都不會說。
 */

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export function AddInvoiceLineForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => addInvoiceLine(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <label className="block">
        <span className="text-caption text-brand-muted">項目說明</span>
        <input name="description" required maxLength={300} className={`${input} mt-1`} />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

export function AddPaymentForm({ invoiceId, today }: { invoiceId: string; today: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => addPayment(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-caption text-brand-muted">收款日期</span>
          {/* 預設日期在 server 端算好傳進來——client 端的今天可能是別的時區 */}
          <input name="paidOn" type="date" defaultValue={today} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">金額</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            maxLength={12}
            className={`${input} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">方式</span>
          <input
            name="method"
            maxLength={40}
            placeholder="匯款 / 現金"
            className={`${input} mt-1`}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-caption text-brand-muted">備註</span>
        <input name="note" maxLength={500} className={`${input} mt-1`} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "記錄中…" : "記一筆收款"}
      </button>

      {/*
       * 這句話要一直在。
       *
       * 「記一筆收款」看起來很像會去跟銀行要錢——這個專案沒有金流，
       * 而讓人以為有，比沒有更糟。
       */}
      <p className="text-caption text-brand-muted mt-3">
        這裡只是記帳，不會真的去收錢。收到款之後自己記一筆。
      </p>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
