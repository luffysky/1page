"use client";

import { useEffect, useId, useRef, useState } from "react";

import { SERVICE_LINES } from "@/config/services";
import { readLeadContext } from "@/features/leads/context-store";
import { track } from "@/lib/analytics/track";

import { submitProject, type BuilderResult } from "./actions";

/**
 * Project Builder（Spec §30）
 *
 * ── 出口條件：從任一入口進入都不需重填 ────────────────────────
 *
 * 帶入有三個來源，都在瀏覽器裡（server 沒有這些東西）：
 *
 *   Agent      對話中問到的需求 → sessionStorage（leads/context-store.ts）
 *   Template   目前的預覽 → sessionStorage（website-engine 的 preview draft）
 *   Portfolio  ?ref= 作品 slug → 網址
 *
 * ⚠️ 帶入在 effect 裡做，不在初始 state。
 * server 沒有 sessionStorage，寫進初始值會造成 hydration 不一致——
 * 4D 已經在 preview context 上踩過同一個坑。
 *
 * 代價是回訪時會有一瞬間看到空白欄位。只影響有東西可帶入的人，
 * 而讓整頁 hydration 出錯影響的是所有人。
 */

const BUDGETS = ["還不確定", "3 萬以內", "3–10 萬", "10 萬以上"];
const DEADLINES = ["還不確定", "一個月內", "一到三個月", "三個月以上"];

const PREVIEW_KEY = "1page:preview-draft";

/** 讀首頁預覽的 draft。與 preview-context 同一個 key，但這裡只讀不寫 */
function readPreviewDraft(): {
  templateId?: string;
  themeId?: string;
  brandName?: string;
  industry?: string;
} | null {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function ProjectBuilder({ reference }: { reference?: string }) {
  const [carried, setCarried] = useState(0);
  const [result, setResult] = useState<BuilderResult | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();

  /*
   * ⚠️ 帶入是**寫進表單元素**，不是寫進 React state。
   *
   * 第一版是 setState(prefill) 然後用 defaultValue 渲染，結果有兩個問題：
   * defaultValue 只在第一次渲染有效（所以其實沒生效），而且在 effect 裡
   * setState 會多觸發一輪渲染。
   *
   * 表單本來就是非受控的——欄位的值住在 DOM 裡。從 sessionStorage 讀出來
   * 填進 DOM，正是 effect 該做的事：把外部系統的狀態同步進來。
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const lead = readLeadContext();
    const preview = readPreviewDraft();

    const next: Record<string, string> = {};
    if (lead?.contact?.name) next.contactName = lead.contact.name;
    if (lead?.contact?.email) next.contactEmail = lead.contact.email;
    if (lead?.contact?.phone) next.contactPhone = lead.contact.phone;
    if (lead?.business?.name) next.businessName = lead.business.name;
    if (lead?.business?.industry) next.businessIndustry = lead.business.industry;
    if (lead?.business?.description) next.description = lead.business.description;
    if (lead?.requirement?.goal) next.goal = lead.requirement.goal;
    if (lead?.requirement?.deadline) next.deadline = lead.requirement.deadline;
    if (lead?.requirement?.budgetRange) next.budget = lead.requirement.budgetRange;

    // 預覽的資訊補在 Agent 沒問到的地方，不覆蓋他親口說過的。
    if (preview?.brandName && !next.businessName) next.businessName = preview.brandName;
    if (preview?.industry && !next.businessIndustry) next.businessIndustry = preview.industry;
    if (preview?.templateId) next.selectedTemplate = preview.templateId;
    if (preview?.themeId) next.preferredTheme = preview.themeId;

    for (const [name, value] of Object.entries(next)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.value = value;
      } else if (field instanceof HTMLSelectElement) {
        // 下拉選單只有值在選項裡才填；不在的話留著預設，
        // 不要製造一個選不回去的狀態。
        if ([...field.options].some((option) => option.value === value)) field.value = value;
      }
    }

    // 只有這一個計數進 state：它要顯示在畫面上。
    setCarried(Object.keys(next).length);

    // Spec §31。帶入了東西才算是「從別處接續過來」，空手進來的另計。
    track("lead_started", { prefilled: Object.keys(next).length });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {carried > 0 ? (
        <p className="border-brand-accent-strong text-body-sm rounded-lg border-l-2 py-1 pl-3">
          已經幫你帶入 {carried} 項先前提過的內容，看一下有沒有要改的就好。
        </p>
      ) : null}

      {reference ? (
        <p className="text-body-sm text-brand-muted">
          參考作品：<span className="font-bold">{reference}</span>
        </p>
      ) : null}

      <form
        ref={formRef}
        action={async (formData) => {
          setPending(true);
          const outcome = await submitProject(formData);
          setResult(outcome);
          setPending(false);

          if (outcome.ok) track("lead_submitted");
        }}
        className="flex flex-col gap-8"
      >
        {/*
         * 帶入但不顯示的欄位：訪客沒有必要看到 templateId 這種東西。
         * 值與其他欄位一樣由上面的 effect 填進 DOM。
         */}
        <input type="hidden" name="selectedTemplate" defaultValue="" />
        <input type="hidden" name="preferredTheme" defaultValue="" />

        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading-2">你想完成什麼</legend>

          <Field
            id={`${formId}-goal`}
            name="goal"
            label="想達成什麼"
            placeholder="例如：讓人搜得到店、能線上訂位"
          />

          <div>
            <p className="text-caption text-brand-muted">需要哪些（可複選）</p>
            <div className="mt-2 flex flex-wrap gap-4">
              {SERVICE_LINES.map((service) => (
                <label key={service.id} className="text-body-sm flex items-center gap-2">
                  <input type="checkbox" name="service" value={service.id} />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading-2">你在做什麼</legend>

          <Field id={`${formId}-business`} name="businessName" label="品牌或店名" />
          <Field
            id={`${formId}-industry`}
            name="businessIndustry"
            label="產業"
            placeholder="例如：咖啡店、攝影、SaaS"
          />
          <Field id={`${formId}-description`} name="description" label="想補充的" multiline />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="text-heading-2 mb-2">預算與時間</legend>

          <Select id={`${formId}-budget`} name="budget" label="預算範圍" options={BUDGETS} />
          <Select
            id={`${formId}-deadline`}
            name="deadline"
            label="希望何時上線"
            options={DEADLINES}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading-2">手上有的素材</legend>

          <div className="flex flex-wrap gap-4">
            {[
              { name: "assetLogo", label: "Logo" },
              { name: "assetPhotos", label: "照片" },
              { name: "assetCopy", label: "文案" },
            ].map((asset) => (
              <label key={asset.name} className="text-body-sm flex items-center gap-2">
                <input type="checkbox" name={asset.name} />
                {asset.label}
              </label>
            ))}
          </div>

          <Field
            id={`${formId}-instagram`}
            name="instagram"
            label="Instagram"
            placeholder="@yourshop"
          />
          <Field
            id={`${formId}-site`}
            name="existingWebsite"
            label="現有網站"
            placeholder="https://"
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading-2">怎麼聯絡你</legend>

          <Field id={`${formId}-name`} name="contactName" label="稱呼" />
          <Field id={`${formId}-email`} name="contactEmail" label="信箱" type="email" />
          <Field id={`${formId}-phone`} name="contactPhone" label="電話" />
          <p className="text-caption text-brand-muted">信箱或電話至少留一個，我們才回得了你。</p>
        </fieldset>

        {result && !result.ok ? (
          <p
            role="alert"
            className="border-brand-accent-strong text-body-sm rounded-lg border-l-2 py-1 pl-3"
          >
            {result.message}
          </p>
        ) : null}

        {result?.ok ? (
          <p role="status" className="border-brand-ink text-body rounded-lg border-l-2 py-1 pl-3">
            收到了。我們會用你留的聯絡方式回覆——不會自動排時間，是真的有人看過之後才聯絡。
          </p>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-accent-strong text-brand-on-accent rounded-pill self-start px-6 py-3 font-bold disabled:opacity-50"
          >
            {pending ? "送出中…" : "送出需求"}
          </button>
        )}
      </form>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  placeholder,
  type = "text",
  multiline = false,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  const className =
    "border-brand-line focus-visible:border-brand-ink text-body mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2";

  return (
    <div>
      <label htmlFor={id} className="text-caption text-brand-muted block">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} name={name} rows={3} placeholder={placeholder} className={className} />
      ) : (
        <input id={id} name={name} type={type} placeholder={placeholder} className={className} />
      )}
    </div>
  );
}

function Select({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-caption text-brand-muted block">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={options[0]}
        className="border-brand-line text-body mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
