"use client";

import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Services（Spec §7 / Plan §6.1）
 *
 * 四條產品線。選定 goal 後 highlight 對應的那一條——
 * 這是 Goal Selector 必須同步的四處之一。
 *
 * ⚠️ 內容從 CMS 讀，但**哪一條要 highlight 仍由程式碼決定**
 * （`HOME_GOALS[].serviceId`）。後台改了某條產品線的 id，
 * 效果是它不再被任何 goal 推薦——不會壞，只是不再亮起來。
 */
export function ServicesBand({
  lines,
}: {
  lines: readonly { id: string; name: string; summary: string }[];
}) {
  const { definition } = useHomeGoal();

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {lines.map((service) => {
        const highlighted = service.id === definition.serviceId;
        return (
          <li
            key={service.id}
            aria-current={highlighted ? "true" : undefined}
            className={`rounded-lg border p-6 transition-colors ${
              highlighted
                ? "border-brand-accent bg-brand-paper"
                : "border-brand-line bg-brand-paper/60"
            }`}
          >
            {highlighted ? (
              <p className="text-caption text-brand-accent-strong mb-2 font-black">為你推薦</p>
            ) : null}
            <h3 className="text-heading-2">{service.name}</h3>
            <p className="text-body-sm text-brand-muted mt-2">{service.summary}</p>
          </li>
        );
      })}
    </ul>
  );
}
