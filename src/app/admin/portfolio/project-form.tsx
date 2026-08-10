"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProject, saveProject } from "@/features/admin/actions";
import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";

export interface ProjectFormValues {
  id?: string;
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  project_type: PortfolioProjectType;
  featured: boolean;
  sort_order: number;
}

const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as PortfolioProjectType[];

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

const input = "border-brand-line bg-brand-bg text-body w-full rounded-md border px-4 py-3";

export function ProjectForm({
  initial,
  listHref,
}: {
  initial: ProjectFormValues;
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveProject(formData);
      if (!result.ok) setError(result.message);
      else {
        router.push(listHref);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-[46rem] flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="標題">
        <input
          name="title"
          defaultValue={initial.title}
          required
          maxLength={200}
          className={input}
        />
      </Field>

      <Field label="網址代稱" hint="公開網址為 /work/<代稱>。只能用小寫英數與連字號。">
        <input
          name="slug"
          defaultValue={initial.slug}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={80}
          className={`${input} font-mono`}
        />
      </Field>

      <Field label="小標" hint="標題上方那一行，例如 Premium Brand Landing Page。">
        <input name="kicker" defaultValue={initial.kicker} maxLength={120} className={input} />
      </Field>

      <Field label="摘要" hint="列表與搜尋結果會用到。">
        <textarea
          name="summary"
          defaultValue={initial.summary}
          maxLength={500}
          rows={3}
          className={input}
        />
      </Field>

      <Field
        label="作品來源"
        hint="Spec §29：不得將 Demo 或 Concept 標為客戶案例。這一欄會直接顯示在公開頁面上。"
      >
        <select name="project_type" defaultValue={initial.project_type} className={input}>
          {PROJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROJECT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="排序" hint="數字小的排前面。">
          <input
            name="sort_order"
            type="number"
            min={0}
            max={9999}
            defaultValue={initial.sort_order}
            className={input}
          />
        </Field>

        <label className="flex items-center gap-3 self-end pb-3">
          <input
            name="featured"
            type="checkbox"
            defaultChecked={initial.featured}
            className="h-5 w-5"
          />
          <span className="text-body-sm font-bold">首頁精選</span>
        </label>
      </div>

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

        {/*
         * 刪除放在最後且需二次確認。列表上刻意沒有刪除按鈕——
         * 作品是累積型資產（Spec §44），誤刪的代價遠高於封存。
         */}
        {initial.id ? (
          <div className="ml-auto flex items-center gap-3">
            {confirmingDelete ? (
              <>
                <span className="text-caption text-brand-muted">確定要永久刪除？</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteProject(initial.id!);
                      if (!result.ok) setError(result.message);
                      else {
                        router.push(listHref);
                        router.refresh();
                      }
                    })
                  }
                  className="border-brand-accent-strong text-brand-accent-strong text-caption rounded-pill border px-4 py-2 font-bold"
                >
                  確定刪除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-caption text-brand-muted underline underline-offset-4"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-caption text-brand-muted underline underline-offset-4"
              >
                刪除這件作品
              </button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
