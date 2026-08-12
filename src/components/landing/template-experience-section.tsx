"use client";

import { useEffect } from "react";

import { SitePreview } from "@/components/website-preview/site-preview";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { useHomeGoal } from "@/features/home/goal-context";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";
import { track } from "@/lib/analytics/track";

/**
 * Template Experience Section（Spec §8.15）
 *
 * > 讓訪客在不與 Agent 對話的前提下，自己完成一次「試穿」。
 *
 * Template Experience 是 Goal Selector 必須同步的四處之一（Plan §6.1）：
 * 選了 goal 之後，這裡的模板清單依 `templateCategories` 收斂。
 *
 * Phase 1–3 這裡只顯示「會依哪些分類篩選」，因為當時沒有真的模板。
 * 4A 之後有了，所以那段說明文字整個拿掉——留著會變成
 * 「明明已經能用了，畫面上還在說之後才會做」。
 */
export function TemplateExperienceSection() {
  const { goal, definition, isFiltering } = useHomeGoal();
  const { draft, selectTemplate } = useSitePreview();

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

  // Spec §31 `template_viewed`：這一段在畫面上出現過，與有沒有互動無關
  useEffect(() => {
    track("template_viewed");
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
    </div>
  );
}
