"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PreviewControls } from "@/components/website-preview/preview-controls";
import { SitePreview } from "@/components/website-preview/site-preview";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";
import { track } from "@/lib/analytics/track";

/**
 * 完整的試穿間（Spec §8.15 / CR-006）
 *
 * ── 這裡是 §8.15「允許」清單的全部 ────────────────────────────
 *
 * 瀏覽模板、切 Theme、切 Accent、切 Desktop / Tablet / Mobile、
 * 帶進 Agent、帶進 Project Builder。
 *
 * CR-006 把首頁那一段瘦成「挑模板 + 大張預覽 + 兩個出口」，
 * 完整控制項搬到這裡。**§8.15 的那句話仍然成立**：
 *
 * > 讓訪客在不與 Agent 對話的前提下，自己完成一次「試穿」。
 *
 * 只是完整的那一次改在這一頁，而首頁到這裡是一個連結的距離。
 * 這一頁不需要登入、不需要付費、不經過 Agent。
 *
 * ── ⚠️ 共用同一個 SiteRenderer，不另外寫一份預覽 ──────────────
 *
 * §8.15 的架構約束：此 Section 與 Agent Preview、Workshop Preview
 * 必須共用同一個 `<SiteRenderer />`。所以這支元件只是把
 * `TemplatePicker` / `PreviewControls` / `SitePreview` 這三個既有元件
 * 排在一起——它自己不畫任何預覽。
 *
 * ── 這裡刻意不吃 goal ─────────────────────────────────────────
 *
 * 首頁那一段依 goal 篩模板（Plan §6.1 的四處同步之一）。
 * 這一頁不篩：進到這裡的人是來逛全部的，
 * 而 goal 是首頁的情境，不是這一頁的。
 */
export function Playground() {
  const { config, draft } = useSitePreview();
  const templates = listTemplates();

  // `from` 見 template-teaser.tsx 的說明——同一個事件，分得出在哪裡看的
  useEffect(() => {
    track("template_viewed", { from: "playground" });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-body-sm text-brand-muted">
        共 {templates.length} 套模板。左邊挑一套，右邊立刻換過去。
      </p>

      {/*
       * ⚠️ 模板選擇器整列寬，不放進左欄。
       *
       * 它自己是 `lg:grid-cols-4` 的橫排——塞進 22rem 的欄位裡，
       * 四張卡各剩約 5rem，說明文字會變成一個字一行。
       * 那不是「窄一點」，是讀不了。
       * （0818 的視覺檢查抓到的：程式全綠，畫面壞掉。）
       */}
      <TemplatePicker templates={templates} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <PreviewControls />
        <SitePreview />
      </div>

      <div className="border-brand-line flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-6">
        <p className="text-body-sm text-brand-muted">調到差不多了？</p>

        {/*
         * ⚠️ 這兩個出口都是**站內連結**，不是按鈕。
         *
         * 離開這一頁是導覽行為，瀏覽器原生就會做（含上一頁）。
         * 做成按鈕再自己 router.push 只是多一個會壞的環節，
         * 而且中鍵開新分頁會失效。
         */}
        <Link
          href="/#advisor"
          onClick={() => track("template_to_agent_clicked", { template: draft.templateId })}
          className="border-brand-ink text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink border px-5 py-2.5 font-bold transition-colors"
        >
          讓 AI 顧問接手 →
        </Link>
        <Link href="/start" className="text-body-sm underline underline-offset-4">
          直接說需求，開一個專案 →
        </Link>
      </div>

      {/*
       * ⚠️ 界線寫在畫面上。
       *
       * 這一頁看起來很像編輯器，而它不是：換不了文字、加不了區塊、存不了檔。
       * 不說的話，訪客會試著點文字然後以為壞了——
       * 那與「做一顆按了會失敗的按鈕」是同一個問題。
       */}
      <p className="border-brand-line text-caption text-brand-muted rounded-lg border border-dashed p-4">
        這裡是試穿，不是編輯器：可以換版型、配色與裝置，但改不了裡面的文字。
        想自己排版面、換文案的話，
        <Link href="/edit" className="underline underline-offset-4">
          去「自己排版」
        </Link>
        ；那邊也不用登入，存檔才要。
        <span className="mt-1 block">
          {/* config 在這裡有讀取端，否則它只是一個被算出來卻沒人用的值 */}
          目前這份設定共 {config.sections.length} 個區塊。
        </span>
      </p>
    </div>
  );
}
