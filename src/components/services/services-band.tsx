"use client";

import { SERVICE_LINES } from "@/config/services";
import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Services（Spec §7 / Plan §6.1）
 *
 * 四條產品線。選定 goal 後 highlight 對應的那一條——
 * 這是 Goal Selector 必須同步的四處之一。
 */
export function ServicesBand() {
  const { definition } = useHomeGoal();

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICE_LINES.map((service) => {
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
