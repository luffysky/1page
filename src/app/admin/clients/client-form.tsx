"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveClient } from "@/features/backoffice/actions";
import {
  CLIENT_KIND_LABELS,
  CLIENT_STATUS_LABELS,
  type ClientKind,
  type ClientStatus,
} from "@/features/backoffice/client-types";

/**
 * 客戶基本資料表單（CR-004 / Phase B BD）
 */

export interface ClientFormValues {
  id?: string;
  name: string;
  kind: ClientKind;
  industry: string;
  status: ClientStatus;
  source: string;
  note: string;
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

export function ClientForm({
  initial,
  listHref,
  detailHrefPrefix,
}: {
  initial: ClientFormValues;
  listHref: string;
  /** 新增成功後要跳去的詳細頁前綴。密路徑在 server 端組好再傳進來 */
  detailHrefPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveClient(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      /*
       * 新增完直接進詳細頁，不是回列表。
       *
       * 剛建好一個客戶，下一件事幾乎一定是加聯絡人或寫備註——
       * 回列表等於要他再點一次找回剛才建的那一筆。
       */
      router.push(initial.id ? listHref : `${detailHrefPrefix}/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-[46rem] flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="客戶名稱">
        <input name="name" defaultValue={initial.name} required maxLength={200} className={input} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="類型">
          <select name="kind" defaultValue={initial.kind} className={input}>
            {(Object.keys(CLIENT_KIND_LABELS) as ClientKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {CLIENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="狀態" hint="潛在 → 合作中 → 已結束">
          <select name="status" defaultValue={initial.status} className={input}>
            {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((status) => (
              <option key={status} value={status}>
                {CLIENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="產業">
          <input name="industry" defaultValue={initial.industry} maxLength={60} className={input} />
        </Field>

        <Field label="來源" hint="lead / 介紹 / 自己找上門。之後要看哪個管道有效">
          <input name="source" defaultValue={initial.source} maxLength={60} className={input} />
        </Field>
      </div>

      <Field label="備註" hint="長期有效的事實。單次的事寫在下面的備註時間軸">
        <textarea
          name="note"
          defaultValue={initial.note}
          maxLength={2000}
          rows={4}
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
          disabled={pending}
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
