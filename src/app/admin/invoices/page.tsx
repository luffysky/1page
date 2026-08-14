import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  balanceOf,
  formatMoney,
  isOverdue,
  type InvoiceStatus,
} from "@/features/backoffice/invoice-types";
import { getInvoiceSummary, listInvoices } from "@/features/backoffice/invoices";

/**
 * 請款列表（CR-004 / Phase B BG）
 *
 * ⚠️ 這一整塊沒有金流，也不打算有。這是**記帳**：
 * 自己開發票、自己對帳，系統只把「誰欠多少、收了沒」記下來。
 *
 * ── 上面那一行是這一頁真正的內容 ──────────────────────────────
 *
 * 「還有多少錢沒收回來」是接案最痛的一個數字，而它幾乎不可能靠印象估——
 * 記得住的是最近寄出去的那幾張，忘掉的是三個月前那一張。
 */

export default async function AdminInvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "";
  const status = INVOICE_STATUSES.includes(raw as InvoiceStatus)
    ? (raw as InvoiceStatus)
    : undefined;

  const [invoices, summary] = await Promise.all([listInvoices(status), getInvoiceSummary()]);

  const today = new Date().toISOString().slice(0, 10);
  const outstanding = balanceOf(summary.openTotal, summary.openPaid);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">請款</h1>
          <p className="text-body text-brand-muted mt-3">
            開了哪些單、收了多少、還差多少。這裡只記帳，不經手金流。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/invoices/new")}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          開一張請款單
        </Link>
      </div>

      <p className="border-brand-line text-body mt-8 rounded-lg border p-5">
        還沒收回來 <strong>{formatMoney(outstanding)}</strong>
        <span className="text-caption text-brand-muted mt-2 block">
          只算草稿與已寄出這兩種，扣掉已經收到的部分。作廢與已收款不列入。 開出去共{" "}
          {formatMoney(summary.openTotal)}，已收 {formatMoney(summary.openPaid)}。
        </span>
      </p>

      <nav aria-label="依狀態篩選" className="mt-6 flex flex-wrap gap-2">
        <Link
          href={toAdminUrl("/admin/invoices")}
          aria-current={status === undefined ? "page" : undefined}
          className={`text-body-sm rounded-pill border px-4 py-2 ${
            status === undefined
              ? "border-brand-ink bg-brand-ink text-brand-on-ink"
              : "border-brand-line"
          }`}
        >
          全部（{summary.counts.all}）
        </Link>

        {INVOICE_STATUSES.map((item) => (
          <Link
            key={item}
            href={toAdminUrl(`/admin/invoices?status=${item}`)}
            aria-current={status === item ? "page" : undefined}
            className={`text-body-sm rounded-pill border px-4 py-2 ${
              status === item
                ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                : "border-brand-line"
            }`}
          >
            {INVOICE_STATUS_LABELS[item]}（{summary.counts[item]}）
          </Link>
        ))}
      </nav>

      {invoices.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          {status ? "這個狀態下沒有請款單。" : "還沒有任何請款單。"}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {invoices.map((invoice) => {
            const balance = balanceOf(invoice.total, invoice.paid);

            return (
              <li key={invoice.id}>
                <Link
                  href={toAdminUrl(`/admin/invoices/${invoice.id}`)}
                  className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="text-body font-bold">{invoice.number}</p>
                    <p className="text-caption text-brand-muted mt-1">
                      {invoice.clientName}
                      {invoice.issuedOn ? ` · 開立 ${invoice.issuedOn}` : ""}
                      {invoice.dueOn ? ` · 到期 ${invoice.dueOn}` : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-body-sm font-bold">{formatMoney(invoice.total)}</p>
                    <p className="text-caption text-brand-muted mt-0.5">
                      {balance > 0 ? `還差 ${formatMoney(balance)}` : "已收足"}
                    </p>

                    <span className="mt-1 inline-flex flex-wrap gap-2">
                      {/*
                       * 逾期要看得出來。只顯示日期的話，要自己心算
                       * 「今天是幾號、這個過了沒」——而那件事在忙的時候不會發生。
                       */}
                      {isOverdue(invoice, today) ? (
                        <span className="border-brand-ink text-caption rounded-pill border px-3 py-1 font-bold">
                          已逾期
                        </span>
                      ) : null}
                      <span className="border-brand-line text-caption rounded-pill border px-3 py-1">
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
