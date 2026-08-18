"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SitePreview } from "@/components/website-preview/site-preview";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { useAgentHandoff } from "@/features/agent/handoff";
import { useHomeGoal } from "@/features/home/goal-context";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";
import { track } from "@/lib/analytics/track";

/**
 * 首頁的試穿預告（Spec §8.15 / CR-006）
 *
 * ── 這一段刻意很小 ────────────────────────────────────────────
 *
 * 它取代了原本那個把 §8.15 全部功能塞進首頁的區塊。
 * `docs/gptsay.md` 的評論：那一塊是首頁上體積最大的東西，
 * 而「首頁不是後台」。
 *
 * 留下來的只有三樣：**挑一套、看一眼、兩個出口**。
 * 換 Theme／Accent／裝置全部在 `/playground`。
 *
 * ⚠️ 仍然共用同一個 `SiteRenderer`（§8.15 的架構約束）——
 * 這支元件不畫任何預覽，它只是把 `TemplatePicker` 與 `SitePreview`
 * 排在一起。**不得為首頁另外寫一份假的預覽。**
 *
 * ── goal 同步留在這裡 ─────────────────────────────────────────
 *
 * Template Experience 是 Goal Selector 必須同步的四處之一（Plan §6.1）。
 * 那條約束是關於**首頁**的，所以留在這支元件裡；
 * `/playground` 不吃 goal（見它自己的檔頭）。
 */
export function TemplateTeaser() {
  const { goal, definition, isFiltering } = useHomeGoal();
  const { config, draft, selectTemplate } = useSitePreview();
  const { openAgent } = useAgentHandoff();

  const templates = listTemplates(definition.templateCategories);
  const withinFilter = templates.some((template) => template.id === draft.templateId);

  /*
   * goal 改變後，若目前這套不在新的清單裡就換成第一套。
   *
   * 用 effect 而不是在 render 期間直接改：selectTemplate 更新的是
   * 另一個元件（Provider）的狀態，在 render 期間呼叫是 React 明文禁止的。
   *
   * 這裡刻意**不發 template_switched**——那個事件的意思是「訪客換了模板」，
   * 而這是 goal 改變的連帶結果。混在一起的話，
   * 之後看到的數字會是「有人很愛換模板」，實際上他只是換了目標。
   */
  useEffect(() => {
    if (templates.length > 0 && !withinFilter) {
      selectTemplate(templates[0]!.id);
    }
  }, [goal, templates, withinFilter, selectTemplate]);

  /*
   * Spec §31 `template_viewed`：這一段在畫面上出現過，與有沒有互動無關。
   *
   * ⚠️ 帶 `from`：`/playground` 也會發同一個事件（見 playground.tsx）。
   * 不分來源的話，一個人先看首頁再點過去會被算兩次，
   * 而那個數字會安靜地變成另一個意思。
   */
  useEffect(() => {
    track("template_viewed", { from: "home" });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {templates.length === 0 ? (
        <p className="text-body-sm text-brand-muted">
          目前沒有符合「{definition.label}」的模板。下方仍是你剛才在看的那一套。
        </p>
      ) : (
        <p className="text-body-sm text-brand-muted">
          {isFiltering
            ? `依「${definition.label}」篩選，共 ${templates.length} 套。`
            : `共 ${templates.length} 套模板。選一套看看，下方會立刻換過去。`}
        </p>
      )}

      <TemplatePicker templates={templates} />
      <SitePreview />

      <div className="border-brand-line flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-5">
        {/*
         * 兩個出口。
         *
         * 「換個感覺」指向 /playground —— 那裡才有 Theme / Accent / 裝置。
         * 用 Link 而不是按鈕：換頁是導覽行為（見 playground.tsx 的同一段理由）。
         */}
        {/*
         * ⚠️ 這個連結刻意**不發任何事件**。
         *
         * 第一版在這裡發了 `template_to_agent_clicked`——而它去的是
         * /playground，不是 AI 顧問。那會讓「去找顧問」的數字混進
         * 「去試穿頁」，而報表看起來完全正常。
         *
         * 不必另外開一個事件：`/playground` 進站時會發
         * `template_viewed { from: "playground" }`，那已經量得到
         * 有多少人走到那一頁。
         * （`ANALYTICS_EVENTS` 是「Spec §31 列出的，一個不多一個不少」，
         *  加事件要動規格——而這裡沒有需要。）
         */}
        <Link
          href="/playground"
          className="border-brand-ink text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink border px-5 py-2.5 font-bold transition-colors"
        >
          換個感覺（配色、字體、裝置）→
        </Link>

        {/*
         * Spec §8.15：「底部固定提供」的 Agent 入口。
         *
         * 用 <a href="#advisor"> 而非按鈕：捲到 Agent 那一段是導覽行為，
         * 瀏覽器原生就會做，而且在網址列留下位置。onClick 只多做一件事——
         * 把目前這份 SiteConfig 交過去。
         */}
        <a
          href="#advisor"
          onClick={() => {
            openAgent({ intent: "template", config });
            track("template_to_agent_clicked", { template: draft.templateId });
          }}
          className="text-body-sm underline underline-offset-4"
        >
          讓 AI 接手，帶著這份設定 ↓
        </a>
      </div>
    </div>
  );
}
