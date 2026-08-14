"use client";

import { useActionState } from "react";

import { addMilestone, addTimeEntry, startEngagementFromDeal } from "@/features/backoffice/actions";

/**
 * 需要顯示錯誤的三個表單（CR-004 / Phase B BF）
 *
 * 與 `client-actions.tsx` 同樣的理由是 client component：
 * `<form action={…}>` 要求 action 回傳 void，也就是失敗時什麼都不會說。
 */

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export function AddMilestoneForm({ engagementId }: { engagementId: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => addMilestone(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-caption text-brand-muted">里程碑</span>
          <input name="title" required maxLength={200} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">預計完成</span>
          <input name="dueOn" type="date" className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">請款比例（%）</span>
          <input
            name="paymentRatio"
            inputMode="decimal"
            maxLength={6}
            className={`${input} mt-1`}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "新增中…" : "新增里程碑"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AddTimeEntryForm({
  engagementId,
  today,
}: {
  engagementId: string;
  /** 預設日期在 server 端算好傳進來——client 端的今天可能是別的時區 */
  today: string;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => addTimeEntry(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-caption text-brand-muted">日期</span>
          <input name="workedOn" type="date" defaultValue={today} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">長度</span>
          {/*
           * 提示寫在 placeholder 裡不夠——那行字一打字就不見了。
           * 所以下面還有一句永遠看得到的說明。
           */}
          <input name="duration" required placeholder="90" className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">做了什麼</span>
          <input name="note" maxLength={500} className={`${input} mt-1`} />
        </label>
      </div>

      <p className="text-caption text-brand-muted mt-2">
        長度可以寫 <code>90</code>、<code>1:30</code>、或 <code>1.5h</code>—— 不用自己換算成分鐘。
      </p>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "記錄中…" : "記一筆工時"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * 成交的報價開成專案。放在報價詳細頁上。
 *
 * 沒有這顆按鈕的話，`engagements.deal_id` 就是一個沒有人寫的欄位——
 * 也就是這個專案犯過七次的那件事：東西做好了，畫面上沒有入口。
 */
export function StartEngagementButton({ dealId, started }: { dealId: string; started: boolean }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => startEngagementFromDeal(formData),
    null,
  );

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="dealId" value={dealId} />

      <button
        type="submit"
        disabled={started || pending}
        className="border-brand-ink text-body-sm rounded-pill border px-5 py-2.5 font-bold disabled:opacity-40"
      >
        {started ? "已經開案了" : pending ? "開案中…" : "開成專案"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-2 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
