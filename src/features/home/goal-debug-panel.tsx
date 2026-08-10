"use client";

import { HOME_GOALS } from "@/config/home-goals";

import { useHomeGoal } from "./goal-context";

/**
 * 1B 的驗證載體（Plan §5 出口條件：「/?goal=ai 可透過臨時 debug 輸出驗證狀態正確」）。
 *
 * 這不是 Goal Selector。真正的 Goal Selector 是 1C 的 Layout Primitive、
 * 1D 才接上首頁；此處只是把 context 狀態攤開來看，僅在開發環境渲染。
 */
export function GoalDebugPanel() {
  const { goal, definition, setGoal, isFiltering } = useHomeGoal();

  return (
    <section
      aria-label="Home Goal Context 除錯面板"
      className="border-brand-line bg-brand-paper mt-16 rounded-xl border p-6"
    >
      <p className="text-kicker text-brand-accent uppercase">Dev · Home Goal Context</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {HOME_GOALS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setGoal(item.id)}
            aria-pressed={item.id === goal}
            className={`text-body-sm rounded-pill border px-4 py-2 transition-colors ${
              item.id === goal
                ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                : "border-brand-line text-brand-ink hover:border-brand-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <dl className="text-body-sm mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
        <dt className="text-brand-muted">goal</dt>
        <dd className="font-mono" data-testid="debug-goal">
          {goal}
        </dd>

        <dt className="text-brand-muted">isFiltering</dt>
        <dd className="font-mono" data-testid="debug-filtering">
          {String(isFiltering)}
        </dd>

        <dt className="text-brand-muted">workCategories</dt>
        <dd className="font-mono">
          {definition.workCategories.length > 0
            ? definition.workCategories.join(", ")
            : "（不篩選）"}
        </dd>

        <dt className="text-brand-muted">templateCategories</dt>
        <dd className="font-mono">
          {definition.templateCategories.length > 0
            ? definition.templateCategories.join(", ")
            : "（不篩選）"}
        </dd>

        <dt className="text-brand-muted">serviceId</dt>
        <dd className="font-mono">{definition.serviceId ?? "（不 highlight）"}</dd>

        <dt className="text-brand-muted">agentInitialIntent</dt>
        <dd className="font-mono">{definition.agentInitialIntent}</dd>
      </dl>
    </section>
  );
}
