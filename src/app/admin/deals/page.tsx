import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  OPEN_STAGES,
  formatAmount,
  type DealStage,
} from "@/features/backoffice/deal-types";
import { getDealSummary, listDeals } from "@/features/backoffice/deals";

/**
 * 報價列表（CR-004 / Phase B BE）
 *
 * ── 上面那一排數字是這一頁真正的內容 ──────────────────────────
 *
 * 「手上還有多少沒收的錢」是接案最想知道、也最容易算錯的一件事：
 * 憑印象估通常會高估，因為記得住的都是大案子。
 * 所以進行中的那三個階段要合計出一個金額，不是只有筆數。
 */

export default async function AdminDealsPage({ searchParams }: PageProps<"/admin/deals">) {
  const params = await searchParams;
  const raw = typeof params.stage === "string" ? params.stage : "";
  const stage = DEAL_STAGES.includes(raw as DealStage) ? (raw as DealStage) : undefined;

  const [deals, summary] = await Promise.all([listDeals(stage), getDealSummary()]);

  const openAmount = OPEN_STAGES.reduce((total, item) => total + summary[item].amount, 0);
  const openCount = OPEN_STAGES.reduce((total, item) => total + summary[item].count, 0);
  const allCount = DEAL_STAGES.reduce((total, item) => total + summary[item].count, 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">報價</h1>
          <p className="text-body text-brand-muted mt-3">
            詢問 → 已報價 → 洽談中 → 成交／未成交。每一次階段變化都會自己記進時間軸。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/deals/new")}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          新增報價
        </Link>
      </div>

      <p className="border-brand-line text-body mt-8 rounded-lg border p-5">
        進行中 <strong>{openCount}</strong> 筆，合計{" "}
        <strong>{formatAmount(openAmount === 0 && openCount === 0 ? null : openAmount)}</strong>
        <span className="text-caption text-brand-muted mt-2 block">
          只算詢問、已報價、洽談中這三段——成交的錢已經是帳務的事，未成交的不該算進來。
          沒填金額的那幾筆以 0 計，所以這是一個下限。
        </span>
      </p>

      <nav aria-label="依階段篩選" className="mt-6 flex flex-wrap gap-2">
        <Link
          href={toAdminUrl("/admin/deals")}
          aria-current={stage === undefined ? "page" : undefined}
          className={`text-body-sm rounded-pill border px-4 py-2 ${
            stage === undefined
              ? "border-brand-ink bg-brand-ink text-brand-on-ink"
              : "border-brand-line"
          }`}
        >
          全部（{allCount}）
        </Link>

        {DEAL_STAGES.map((item) => (
          <Link
            key={item}
            href={toAdminUrl(`/admin/deals?stage=${item}`)}
            aria-current={stage === item ? "page" : undefined}
            className={`text-body-sm rounded-pill border px-4 py-2 ${
              stage === item
                ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                : "border-brand-line"
            }`}
          >
            {DEAL_STAGE_LABELS[item]}（{summary[item].count}）
          </Link>
        ))}
      </nav>

      {deals.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          {stage
            ? "這個階段下沒有報價。"
            : "還沒有任何報價。先到客戶頁挑一個客戶，或按右上角新增。"}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <Link
                href={toAdminUrl(`/admin/deals/${deal.id}`)}
                className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="text-body font-bold">{deal.title}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {deal.clientName}
                    {deal.expectedClose ? ` · 預計 ${deal.expectedClose}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-body-sm font-bold">
                    {formatAmount(deal.amount, deal.currency)}
                  </p>
                  <span className="border-brand-line text-caption rounded-pill mt-1 inline-block border px-3 py-1">
                    {DEAL_STAGE_LABELS[deal.stage]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
