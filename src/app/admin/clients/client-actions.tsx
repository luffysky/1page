"use client";

import { useActionState } from "react";

import { convertLeadToClient, saveContact } from "@/features/backoffice/actions";

/**
 * 需要顯示錯誤的兩個表單（CR-004 / Phase B BD）
 *
 * ── 為什麼不用 server component 的 `<form action={…}>` ────────
 *
 * 那種寫法要求 action 回傳 `void`——也就是**失敗時什麼都不會說**。
 * 「按了沒反應」是這個專案一直在避免的那種壞法：
 * 使用者不知道是自己填錯、還是系統壞了。
 *
 * `useActionState` 讓 action 回得了結果，代價是這兩個表單要是
 * client component。那個代價很小，換來的是錯誤看得見。
 */

export function ConvertLeadButton({ leadId, converted }: { leadId: string; converted: boolean }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => convertLeadToClient(formData),
    null,
  );

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="leadId" value={leadId} />

      <button
        type="submit"
        disabled={converted || pending}
        className="border-brand-ink text-caption rounded-pill border px-4 py-1.5 font-bold disabled:opacity-40"
      >
        {converted ? "已建立客戶" : pending ? "建立中…" : "建立客戶"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-caption text-brand-accent-strong mt-2 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export function AddContactForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => saveContact(formData),
    null,
  );

  return (
    <form action={action} className="border-brand-line mt-5 rounded-lg border p-4">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-caption text-brand-muted">姓名</span>
          <input name="name" required maxLength={120} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">職稱</span>
          <input name="title" maxLength={60} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">Email</span>
          {/*
           * 刻意不用 type="email"。
           *
           * 瀏覽器內建的驗證與我們的 zod 是兩套規則，而它擋下來的方式
           * 是一個氣泡提示，畫面上沒有我們自己的錯誤訊息。
           * （後台的連結欄位剛踩過同一個坑：站內路徑被 type="url" 擋住，
           *  表單送不出去而測試只看到「等待逾時」。）
           */}
          <input name="email" inputMode="email" maxLength={200} className={`${input} mt-1`} />
        </label>
        <label className="block">
          <span className="text-caption text-brand-muted">電話</span>
          <input name="phone" maxLength={40} className={`${input} mt-1`} />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2">
        <input name="isPrimary" type="checkbox" className="h-5 w-5" />
        <span className="text-body-sm">設為主要聯絡人</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "新增中…" : "新增聯絡人"}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
