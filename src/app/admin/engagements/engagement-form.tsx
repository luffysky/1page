"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveEngagement } from "@/features/backoffice/actions";
import {
  ENGAGEMENT_STATUSES,
  ENGAGEMENT_STATUS_LABELS,
  type EngagementStatus,
} from "@/features/backoffice/engagement-types";

/**
 * 接案專案表單（CR-004 / Phase B BF）
 */

export interface EngagementFormValues {
  id?: string;
  clientId: string;
  dealId: string;
  title: string;
  status: EngagementStatus;
  startedOn: string;
  dueOn: string;
  deliveredOn: string;
  portfolioProjectId: string;
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

export function EngagementForm({
  initial,
  clients,
  deals,
  portfolioProjects,
  listHref,
  detailHrefPrefix,
}: {
  initial: EngagementFormValues;
  clients: { id: string; name: string }[];
  deals: { id: string; title: string }[];
  portfolioProjects: { id: string; title: string }[];
  listHref: string;
  detailHrefPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<EngagementStatus>(initial.status);

  const needsDelivered = status === "delivered" || status === "closed";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveEngagement(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(initial.id ? listHref : `${detailHrefPrefix}/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-[46rem] flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="專案名稱">
        <input
          name="title"
          defaultValue={initial.title}
          required
          maxLength={200}
          className={input}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="客戶">
          <select name="clientId" defaultValue={initial.clientId} required className={input}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="狀態">
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as EngagementStatus)}
            className={input}
          >
            {ENGAGEMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {ENGAGEMENT_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="開始日期">
          <input name="startedOn" type="date" defaultValue={initial.startedOn} className={input} />
        </Field>

        <Field label="截止日期">
          <input name="dueOn" type="date" defaultValue={initial.dueOn} className={input} />
        </Field>
      </div>

      {/*
       * 交付日期只在已交付／已結案時出現。
       *
       * 平常擺著它是空的，而空欄位會被當裝飾略過——
       * 真的要填的那一次也會被略過。與報價的「未成交原因」同一個道理。
       */}
      {needsDelivered ? (
        <Field
          label="交付日期"
          hint="沒有它，之後算不出「這個案子做了多久」——估下一個案時就沒有依據"
        >
          <input
            name="deliveredOn"
            type="date"
            defaultValue={initial.deliveredOn}
            className={input}
          />
        </Field>
      ) : (
        <input type="hidden" name="deliveredOn" value={initial.deliveredOn} />
      )}

      <Field label="從哪一筆報價來的" hint="留白也可以——有些案子沒有正式報價就開始了">
        <select name="dealId" defaultValue={initial.dealId} className={input}>
          <option value="">（沒有對應的報價）</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.title}
            </option>
          ))}
        </select>
      </Field>

      {/*
       * 做完了掛到哪一件作品。
       *
       * 作品集是累積型資產，而漏掉的那幾件事後很難補——當時的截圖與
       * 說明已經散了。這一欄讓「接案 → 作品」是一個明確的動作，
       * 不是靠人記得回頭整理。
       */}
      <Field label="對應的作品" hint="做完之後把它掛上作品集。還沒做完就先留白">
        <select
          name="portfolioProjectId"
          defaultValue={initial.portfolioProjectId}
          className={input}
        >
          <option value="">（還沒有對應的作品）</option>
          {portfolioProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
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
