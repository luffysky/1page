"use client";

import { useHomeGoal } from "@/features/home/goal-context";

/**
 * Services（Spec §7 / §3.1 / Plan §6.1 / CR-006）
 *
 * 四條產品線。選定 goal 後 highlight 對應的那一條——
 * 這是 Goal Selector 必須同步的四處之一。
 *
 * ── 為什麼從四張卡改成四列（CR-006）─────────────────────────
 *
 * §3.1 明文禁止全站卡片網格，而 `docs/gptsay.md` 指得更具體：
 *
 * > 不是四張 SaaS Card，而是四個巨大 Editorial Row
 *
 * 四張等寬卡把「網站」與「AI 與自動化」講得一樣重、一樣淺，
 * 讀起來像功能表。橫列有左右欄可以分工：左邊是名字（大字），
 * 右邊是它實際交付什麼——那才是接案工作室要傳達的東西。
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
    <ul className="flex flex-col">
      {lines.map((service) => {
        const highlighted = service.id === definition.serviceId;

        return (
          <li
            key={service.id}
            aria-current={highlighted ? "true" : undefined}
            className={`border-brand-line grid gap-3 border-t py-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-baseline md:gap-12 ${
              highlighted ? "border-brand-accent border-t-2" : ""
            }`}
          >
            <div>
              <h3 className="text-display-2">{service.name}</h3>
              {highlighted ? (
                /*
                 * 標記放在標題底下而不是上面：上面的話，四列裡只有一列
                 * 多一行，整排的基線就對不齊了——而那看起來像排版壞掉，
                 * 不像「這一條被推薦」。
                 */
                <p className="text-caption text-brand-accent-strong mt-2 font-black">為你推薦</p>
              ) : null}
            </div>

            <p className="text-lead text-brand-muted max-w-prose">{service.summary}</p>
          </li>
        );
      })}
    </ul>
  );
}
