"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveDeal } from "@/features/backoffice/actions";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@/features/backoffice/deal-types";

/**
 * 報價表單（CR-004 / Phase B BE）
 */

export interface DealFormValues {
  id?: string;
  clientId: string;
  title: string;
  stage: DealStage;
  amount: string;
  expectedClose: string;
  lostReason: string;
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

export function DealForm({
  initial,
  clients,
  listHref,
  detailHrefPrefix,
}: {
  initial: DealFormValues;
  clients: { id: string; name: string }[];
  listHref: string;
  detailHrefPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<DealStage>(initial.stage);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveDeal(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // 新增完直接進詳細頁——接下來要做的是加明細，回列表等於要再找一次
      router.push(initial.id ? listHref : `${detailHrefPrefix}/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-[46rem] flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="報價名稱" hint="這一筆在談的是什麼。之後列表上只會看到這一行">
        <input
          name="title"
          defaultValue={initial.title}
          required
          maxLength={200}
          className={input}
        />
      </Field>

      <Field label="客戶">
        <select name="clientId" defaultValue={initial.clientId} required className={input}>
          {clients.length === 0 ? <option value="">（還沒有任何客戶）</option> : null}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="階段">
          <select
            name="stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as DealStage)}
            className={input}
          >
            {DEAL_STAGES.map((item) => (
              <option key={item} value={item}>
                {DEAL_STAGE_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="預計成交日" hint="用來排「這個月該追誰」。不確定就留白">
          <input
            name="expectedClose"
            type="date"
            defaultValue={initial.expectedClose}
            className={input}
          />
        </Field>
      </div>

      <Field label="金額" hint="留白代表還沒報價。列表上會顯示「未報價」，不是 0">
        {/*
         * `inputMode="decimal"` 而不是 `type="number"`。
         *
         * type="number" 在部分瀏覽器上滾輪會偷偷改值，而金額被改掉
         * 使用者不會發現。驗證由 zod 做，不靠瀏覽器。
         */}
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={initial.amount}
          maxLength={12}
          className={input}
        />
      </Field>

      {/*
       * 未成交的原因只在需要的時候出現。
       *
       * 一直放在畫面上的話，九成的時間它是一個空欄位，
       * 而空欄位會被當成裝飾略過——真的要填的那一次也會被略過。
       */}
      {stage === "lost" ? (
        <Field label="未成交的原因" hint="半年後回頭看，這一欄是整張表唯一還有用的東西">
          {/*
           * 刻意不加 `required`。
           *
           * 瀏覽器內建的必填提示是一個氣泡，畫面上不會留下任何東西，
           * 而我們的 action 有一句話說得出「為什麼一定要填」。
           * 空著送出時看得到的應該是那句話。
           * （後台的連結欄位剛踩過同一個坑：被瀏覽器擋住，表單送不出去，
           *  而使用者只看到一個一秒就消失的提示。）
           */}
          <textarea
            name="lostReason"
            defaultValue={initial.lostReason}
            maxLength={500}
            rows={3}
            className={input}
          />
        </Field>
      ) : (
        <input type="hidden" name="lostReason" value="" />
      )}

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
