"use client";

import { useState } from "react";

import { SectionWidget } from "@/components/editor/section-widget";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { SiteRenderer } from "@/features/website-engine/site-renderer";

/**
 * 區塊編輯器（CR-003-4 第一段）
 *
 * 每個區塊是一個 widget：點一下選取，用 ↑ ↓ 搬動，✕ 移除。
 *
 * ── 定價 B ────────────────────────────────────────────────────
 *
 * 「免費編輯、存檔才付費」。所以這一頁不需要登入、不需要付費，
 * 排出來的東西存在 sessionStorage（見 preview-context）。
 * 要把它變成一個真的網站才進 Website Workshop。
 *
 * ── 第一段刻意還沒有的東西 ───────────────────────────────────
 *
 * 拖曳。順序是反過來做的：先鍵盤、再拖曳，兩者呼叫同一個
 * `moveSection`。先做拖曳再補鍵盤等於整個介面重寫一次，
 * 而 WCAG 2.1 §2.5.7 讓「不補」不是一個選項。
 */

/** 區塊型別的中文名。工具列與螢幕閱讀器都要講得出這是哪一塊 */
const SECTION_LABELS: Record<string, string> = {
  hero: "主視覺",
  about: "關於",
  services: "服務",
  features: "特色",
  gallery: "作品",
  portfolio: "作品集",
  pricing: "方案",
  testimonials: "見證",
  faq: "常見問題",
  process: "流程",
  stats: "數字",
  team: "團隊",
  form: "表單",
  embed: "嵌入",
  cta: "行動呼籲",
  contact: "聯絡",
  footer: "頁尾",
};

export function SectionEditor() {
  const { config, sectionsEdited, resetSections } = useSitePreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const total = config.sections.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-brand-muted">
          點一下任何一塊來選取，然後用 ↑ ↓ 搬動它。共 {total} 塊。
        </p>

        {sectionsEdited ? (
          <button
            type="button"
            onClick={() => {
              resetSections();
              setSelectedId(null);
            }}
            className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
          >
            回到模板原樣
          </button>
        ) : null}
      </div>

      {/*
       * 捲動容器要能用鍵盤操作，理由與首頁預覽相同：
       * 只有滑鼠捲得動的區塊，鍵盤使用者看不到下半部（axe serious）。
       */}
      <div
        tabIndex={0}
        role="group"
        aria-label="網站編輯區"
        className="border-brand-line max-h-[42rem] overflow-y-auto rounded-lg border"
      >
        <SiteRenderer
          config={config}
          wrapSection={(section, index, rendered) => (
            <SectionWidget
              id={section.id}
              label={SECTION_LABELS[section.type] ?? section.type}
              index={index}
              total={total}
              selected={selectedId === section.id}
              onSelect={setSelectedId}
            >
              {rendered}
            </SectionWidget>
          )}
        />
      </div>
    </div>
  );
}
