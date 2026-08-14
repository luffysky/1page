"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveInvoice } from "@/features/backoffice/actions";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/features/backoffice/invoice-types";

/**
 * 請款單表單（CR-004 / Phase B BG）
 */

export interface InvoiceFormValues {
  id?: string;
  clientId: string;
  engagementId: string;
  number: string;
  status: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  taxPercent: string;
}

const input = "border-brand-line bg-brand-bg text-body w-full rounded-md border px-4 py-3";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-body-sm block font-bold">{label}</span>
      {hint ? <span className="text-caption text-brand-muted mt-1 block">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export function InvoiceForm({
  initial,
  clients,
  engagements,
  listHref,
  detailHrefPrefix,
}: {
  initial: InvoiceFormValues;
  clients: { id: string; name: string }[];
  engagements: { id: string; title: string }[];
  listHref: string;
  detailHrefPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>(initial.status);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveInvoice(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // 新增完直接進詳細頁——接下來要做的是加明細
      router.push(initial.id ? listHref : `${detailHrefPrefix}/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-[46rem] flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="請款單編號" hint="重複的編號是會計事故，資料庫會擋">
          <input
            name="number"
            defaultValue={initial.number}
            required
            maxLength={40}
            className={input}
          />
        </Field>

        <Field label="狀態">
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
            className={input}
          >
            {INVOICE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {INVOICE_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="客戶">
        <select name="clientId" defaultValue={initial.clientId} required className={input}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="對應的專案" hint="留白也可以——不是每一筆帳都對得到一個專案">
        <select name="engagementId" defaultValue={initial.engagementId} className={input}>
          <option value="">（沒有對應的專案）</option>
          {engagements.map((engagement) => (
            <option key={engagement.id} value={engagement.id}>
              {engagement.title}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        {/*
         * 開立日期只在草稿以外才要求。
         *
         * 草稿還沒寄出去，沒有開立日期是正常的；
         * 已寄出卻沒有日期，之後回答不了「這筆帳放了多久」——
         * 而那是催款時唯一有用的資訊。
         */}
        <Field
          label="開立日期"
          hint={status === "draft" ? "草稿可以先留白" : "已寄出之後這一欄是必填"}
        >
          <input name="issuedOn" type="date" defaultValue={initial.issuedOn} className={input} />
        </Field>

        <Field label="到期日">
          <input name="dueOn" type="date" defaultValue={initial.dueOn} className={input} />
        </Field>
      </div>

      <Field
        label="稅率（%）"
        hint="填 5 代表 5%。金額由明細算出來後存下來，之後改稅率不會動到舊單"
      >
        <input
          name="taxPercent"
          inputMode="decimal"
          defaultValue={initial.taxPercent}
          maxLength={6}
          className={input}
        />
      </Field>

      {error ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong font-bold">
          {error}
        </p>
      ) : null}

      <div className="border-brand-line flex flex-wrap items-center gap-3 border-t pt-6">
        <button
          type="submit"
          disabled={pending || clients.length === 0}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-6 py-3 font-bold disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存"}
        </button>

        <a href={listHref} className="border-brand-line text-body-sm rounded-pill border px-6 py-3">
          取消
        </a>
      </div>
    </form>
  );
}
