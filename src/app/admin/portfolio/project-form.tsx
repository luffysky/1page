"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SERVICE_LINES } from "@/config/services";
import { deleteProject, saveProject } from "@/features/admin/actions";
import { CASE_STUDY_SECTIONS } from "@/features/portfolio/detail";
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

  /*
   * Spec §8.10 / §28 的欄位。
   *
   * ⚠️ 這些從 2E 起就在 schema 與公開頁面裡完整支援，而後台表單
   * 只有基本欄位——也就是說**只能直接改資料庫**。
   * 公開頁面畫得出來、後台填不進去，是同一種毛病的另一個形態：
   * 那幾個欄位有讀取端，沒有寫入端。
   */
  industry: string;
  year: string;
  services: string[];
  /*
   * 分類與標籤是 join 表，比 case study 那幾個欄位晚一輪才接上。
   *
   * 沒有它們的後果很具體：在後台新建的作品沒有任何分類，
   * 於是它在 /work 的任何分類篩選下都找不到——而作品列表看起來一切正常。
   */
  categories: string[];
  tags: string[];
  caseStudy: Record<string, string>;
  links: Record<string, string>;
  aiUsed: boolean;
  aiDescription: string;
}

const LINK_FIELDS: { key: string; label: string }[] = [
  { key: "live", label: "線上網址" },
  { key: "demo", label: "Demo" },
  { key: "figma", label: "Figma" },
  { key: "github", label: "GitHub" },
];

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
  allCategories,
  allTags,
}: {
  initial: ProjectFormValues;
  listHref: string;
  /** 分類是固定清單，由後台選 */
  allCategories: { slug: string; name: string }[];
  /** 既有標籤，給輸入框當建議。沒有它會長出一堆打錯字的近似標籤 */
  allTags: string[];
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

      <fieldset className="border-brand-line border-t pt-6">
        <legend className="text-body-sm font-bold">專案資訊</legend>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Field label="產業" hint="例如 餐飲、室內設計。留白就不顯示。">
            <input
              name="industry"
              defaultValue={initial.industry}
              maxLength={60}
              className={input}
            />
          </Field>

          <Field label="年份">
            <input
              name="year"
              type="number"
              min={1900}
              max={2100}
              defaultValue={initial.year}
              className={input}
            />
          </Field>
        </div>

        <div className="mt-6">
          <span className="text-body-sm block font-bold">服務線</span>
          <span className="text-caption text-brand-muted mt-1 block">
            公開頁面會列出來，/work 的篩選器也會用到。
          </span>
          <div className="mt-3 flex flex-wrap gap-4">
            {SERVICE_LINES.map((line) => (
              <label key={line.id} className="flex items-center gap-2">
                <input
                  name="services"
                  type="checkbox"
                  value={line.id}
                  defaultChecked={initial.services.includes(line.id)}
                  className="h-5 w-5"
                />
                <span className="text-body-sm">{line.name}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/*
       * Case Study（Spec §8.10）。
       *
       * 五段全部選填，而且**留白就不會顯示**——Spec 明文要求
       * 「不要顯示空 Section」。所以這裡不加 required，也不放預設文字：
       * 預設文字會被原封不動地留在公開頁面上。
       *
       * 欄位順序直接讀 CASE_STUDY_SECTIONS，與公開頁面同一份。
       * 各寫一份的話，改了順序就會出現「後台第三格填的東西
       * 在前台是第四段」這種沒人查得出來的錯位。
       */}
      <fieldset className="border-brand-line border-t pt-6">
        <legend className="text-body-sm font-bold">分類與標籤</legend>

        <div className="mt-4">
          <span className="text-body-sm block font-bold">分類</span>
          <span className="text-caption text-brand-muted mt-1 block">
            /work 的篩選器用這個。<strong>一個都沒選的話，這件作品在任何分類下都找不到。</strong>
          </span>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {allCategories.map((category) => (
              <label key={category.slug} className="flex items-center gap-2">
                <input
                  name="categories"
                  type="checkbox"
                  value={category.slug}
                  defaultChecked={initial.categories.includes(category.slug)}
                  className="h-5 w-5"
                />
                <span className="text-body-sm">{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/*
         * 標籤用文字欄位而不是多選清單。
         *
         * 標籤會長到幾十個，而一件作品只掛兩三個——捲一份長清單比打字慢。
         * datalist 提供既有標籤當建議，避免打錯字長出「Logo」與「logo」兩個。
         */}
        <div className="mt-6">
          <Field label="標籤" hint="用逗號或頓號分隔。打新的就會建立，選既有的請照原樣打。">
            <input
              name="tags"
              list="portfolio-tag-suggestions"
              defaultValue={initial.tags.join("、")}
              maxLength={400}
              className={input}
            />
          </Field>
          <datalist id="portfolio-tag-suggestions">
            {allTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </fieldset>

      <fieldset className="border-brand-line border-t pt-6">
        <legend className="text-body-sm font-bold">Case Study</legend>
        <p className="text-caption text-brand-muted mt-1">
          留白的段落在公開頁面上不會出現（Spec §8.10）。
        </p>

        <div className="mt-4 flex flex-col gap-5">
          {CASE_STUDY_SECTIONS.map((section) => (
            <Field key={section.key} label={section.label}>
              <textarea
                name={`case_study.${section.key}`}
                defaultValue={initial.caseStudy[section.key] ?? ""}
                maxLength={2000}
                rows={4}
                className={input}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-brand-line border-t pt-6">
        <legend className="text-body-sm font-bold">相關連結</legend>
        <p className="text-caption text-brand-muted mt-1">站內路徑（/work/…）或 https:// 網址。</p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {LINK_FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              {/*
               * ⚠️ 刻意不用 `type="url"`。
               *
               * 瀏覽器內建的 url 驗證只認絕對網址，而站內路徑
               * （`/work/interior-studio`，資料庫裡真的有）會被它擋下來——
               * 而且擋的方式是一個氣泡提示，表單就是送不出去，
               * 畫面上沒有任何我們自己的錯誤訊息可以解釋為什麼。
               *
               * 更根本的問題是那會變成第二套驗證規則：瀏覽器一套、
               * zod 一套，兩者遲早在邊界上不一致。
               */}
              <input
                name={`links.${field.key}`}
                type="text"
                inputMode="url"
                defaultValue={initial.links[field.key] ?? ""}
                maxLength={2048}
                className={input}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      {/*
       * AI 揭露（Spec §28）。
       *
       * 沒有勾選時公開頁面完全不顯示這個區塊，說明文字也不會被存下來——
       * 否則之後有人把勾選打開，一段沒人記得寫過的舊文字就會突然出現在
       * 客戶案例上。
       */}
      <fieldset className="border-brand-line border-t pt-6">
        <legend className="text-body-sm font-bold">AI 揭露</legend>

        <label className="mt-4 flex items-center gap-3">
          <input
            name="ai_disclosure.used"
            type="checkbox"
            defaultChecked={initial.aiUsed}
            className="h-5 w-5"
          />
          <span className="text-body-sm font-bold">這件作品有使用 AI</span>
        </label>

        <div className="mt-4">
          <Field label="說明" hint="沒有勾選上面那格時，這段文字不會被儲存，也不會顯示。">
            <textarea
              name="ai_disclosure.description"
              defaultValue={initial.aiDescription}
              maxLength={1000}
              rows={3}
              className={input}
            />
          </Field>
        </div>
      </fieldset>

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
