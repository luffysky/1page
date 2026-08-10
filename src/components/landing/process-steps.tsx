import { PROCESS_STEPS } from "@/config/home-copy";

/**
 * Process（Spec §4 IA）
 *
 * 刻意用「上緣粗線 + 編號」的排版而非卡片：
 * 這是首頁倒數第二個 Section，前面已有 Goal / Work / Services 三處網格，
 * 再來一排圓角卡就會踩到 §3.1 的卡片文法紅線。
 */
export function ProcessSteps() {
  return (
    <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {PROCESS_STEPS.map((item) => (
        <li key={item.step} className="border-brand-ink border-t-2 pt-5">
          <p className="text-caption text-brand-accent-strong font-black">{item.step}</p>
          <h3 className="text-heading-2 mt-3">{item.title}</h3>
          <p className="text-body-sm text-brand-muted mt-2">{item.summary}</p>
        </li>
      ))}
    </ol>
  );
}
