"use client";

import { TemplateExperienceShell } from "@/components/website-preview/template-experience-shell";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Template Experience 是 Goal Selector 必須同步的四處之一（Plan §6.1）。
 *
 * Phase 1 沒有真正的 Template（Phase 4），因此此處只呈現「會依哪些分類篩選」，
 * 證明接線存在。刻意不假造模板清單——寧可顯示接線狀態，也不要讓人以為
 * 模板功能已經可用。
 */
export function TemplateExperienceSection() {
  const { definition, isFiltering } = useHomeGoal();
  const categories = definition.templateCategories;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-brand-muted">
        {isFiltering && categories.length > 0
          ? `將依「${definition.label}」篩選模板分類：${categories.join("、")}。`
          : "目前不篩選，顯示全部模板分類。"}
        <span className="ml-1">實際模板於 Phase 4 加入。</span>
      </p>
      <TemplateExperienceShell />
    </div>
  );
}
