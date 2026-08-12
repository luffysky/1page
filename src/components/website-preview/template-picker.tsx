"use client";

import { useSitePreview } from "@/features/website-engine/preview-context";
import type { WebsiteTemplate } from "@/features/website-engine/templates";
import { track } from "@/lib/analytics/track";

/**
 * 模板選擇（Spec §8.15「瀏覽 3～6 套 Template」）
 *
 * 沿用 Goal Selector 的 `aria-pressed` 按鈕模式：同一頁上兩組看起來一樣的
 * 選擇器，操作方式與輔助技術的讀法應該一致。
 *
 * 分析事件在這裡發，不在 context 裡：
 * context 是純狀態，同一個 action 可能來自使用者點擊，也可能來自
 * goal 改變後的自動校正——後者不是 `template_switched`。
 * 事件的意義取決於**誰觸發**，所以歸呼叫端負責。
 */
export function TemplatePicker({ templates }: { templates: WebsiteTemplate[] }) {
  const { draft, selectTemplate } = useSitePreview();

  if (templates.length === 0) {
    // 篩選後沒有東西是一個事實，不偷偷退回全部（2B 立下的規則）。
    return null;
  }

  return (
    // 有標籤的清單：螢幕閱讀器報得出「這是模板清單」，
    // 頁面上也因此有一個穩定、非 testid 的定位點。
    <ul aria-label="模板" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {templates.map((template) => {
        const active = template.id === draft.templateId;

        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => {
                selectTemplate(template.id);
                // Spec §31
                track("template_switched", { template: template.id });
              }}
              aria-pressed={active}
              className={`h-full w-full rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                  : "border-brand-line bg-brand-paper hover:border-brand-ink"
              }`}
            >
              <span className="text-body block font-bold">{template.name}</span>
              <span
                className={`text-body-sm mt-1.5 block ${active ? "opacity-75" : "text-brand-muted"}`}
              >
                {template.description}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
