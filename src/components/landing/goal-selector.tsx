"use client";

import { HOME_GOALS } from "@/config/home-goals";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Goal Selector（Spec §6 / Plan §6.1）
 *
 * > Goal Selector 不是六張漂亮墓碑，是整個首頁的 Context Controller。
 *
 * 這裡只負責「選」。選完之後 Selected Work、Template Experience、Services
 * 與 Agent CTA 各自從 context 讀取並反應——本元件不知道也不該知道它們的存在。
 */
export function GoalSelector() {
  const { goal, setGoal } = useHomeGoal();

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {HOME_GOALS.map((item) => {
        const active = item.id === goal;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setGoal(item.id)}
              aria-pressed={active}
              className={`h-full w-full rounded-lg border p-6 text-left transition-colors ${
                active
                  ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                  : "border-brand-line bg-brand-paper hover:border-brand-ink"
              }`}
            >
              <span className="text-heading-2 block">{item.label}</span>
              <span
                className={`text-body-sm mt-2 block ${active ? "opacity-75" : "text-brand-muted"}`}
              >
                {item.description}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
