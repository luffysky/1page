import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { deleteInvoiceLine, deletePayment } from "@/features/backoffice/actions";
import { listClients } from "@/features/backoffice/clients";
import { listEngagements } from "@/features/backoffice/engagements";
import {
  INVOICE_STATUS_LABELS,
  balanceOf,
  formatMoney,
  invoiceWarnings,
  linesSubtotal,
} from "@/features/backoffice/invoice-types";
import { getInvoice } from "@/features/backoffice/invoices";

import { AddInvoiceLineForm, AddPaymentForm } from "../invoice-actions";
import { InvoiceForm } from "../invoice-form";

/**
 * 請款單詳細頁（CR-004 / Phase B BG）
 */

export default async function AdminInvoiceDetailPage({
  params,
}: PageProps<"/admin/invoices/[id]">) {
  const { id } = await params;

  const [detail, clients, engagements] = await Promise.all([
    getInvoice(id),
    listClients(),
    listEngagements(),
  ]);

  if (!detail) notFound();

  const { invoice, lines, payments } = detail;
  const today = new Date().toISOString().slice(0, 10);
  const balance = balanceOf(invoice.total, invoice.paid);
  const warnings = invoiceWarnings(invoice);

  /*
   * 存下來的稅率反推回百分比。
   *
   * migration 只存結果（subtotal / tax / total），沒有稅率欄位——
   * 那是刻意的：**已經開出去的請款單金額不能因為之後改稅率而變**。
   * 所以編輯時把當初的比例算回來當預設值，不是套用一個「現在的稅率」。
   */
  const taxPercent = invoice.subtotal > 0 ? (invoice.tax / invoice.subtotal) * 100 : 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">{invoice.number}</h1>
          <p className="text-caption text-brand-muted mt-2">
            <Link href={toAdminUrl(`/admin/clients/${invoice.clientId}`)} className="underline">
              {invoice.clientName}
            </Link>
            {` · ${INVOICE_STATUS_LABELS[invoice.status]} · ${formatMoney(invoice.total)}`}
            {invoice.engagementId ? (
              <>
                {" · "}
                <Link
                  href={toAdminUrl(`/admin/engagements/${invoice.engagementId}`)}
                  className="underline"
                >
                  對應的專案
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/invoices")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回請款列表
        </Link>
      </div>

      {/*
       * 狀態與收款對不上時要說出來，但**不自己改**。
       *
       * 收了一半就把單改成已收款的話，帳就對不起來了——
       * 而「還差多少」是這整張表存在的理由。什麼時候算收完是人的判斷。
       */}
      {/*
       * ⚠️ `role="status"` 放在外面那層 div，不是 <ul> 上。
       *
       * 給 <ul> 一個 role 會**取代**它的 list 語意，於是裡面的 <li>
       * 變成沒有列表父容器的孤兒——axe 會報 `listitem`，
       * 而讀螢幕的人聽不到「共三項」這種資訊。
       *
       * 這是我自己寫的測試抓到的，不是靠看的。
       */}
      {warnings.length > 0 ? (
        <div role="status" className="border-brand-line mt-6 rounded-lg border border-dashed p-4">
          <ul>
            {warnings.map((warning) => (
              <li key={warning} className="text-body-sm">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <InvoiceForm
        listHref={toAdminUrl("/admin/invoices")}
        detailHrefPrefix={toAdminUrl("/admin/invoices")}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        engagements={engagements.map((engagement) => ({
          id: engagement.id,
          title: engagement.title,
        }))}
        initial={{
          id: invoice.id,
          clientId: invoice.clientId,
          engagementId: invoice.engagementId ?? "",
          number: invoice.number,
          status: invoice.status,
          issuedOn: invoice.issuedOn ?? "",
          dueOn: invoice.dueOn ?? "",
          taxPercent: String(Math.round(taxPercent * 100) / 100),
        }}
      />

      {/* ── 明細 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-12 border-t pt-8">
        <h2 className="text-heading-2">明細</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          金額由這裡算出來後<strong>存進請款單</strong>
          ，不是每次重算——之後改稅率不會動到已經開出去的單。
        </p>

        {lines.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {lines.map((line) => (
              <li
                key={line.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">{line.description}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {line.quantity} × {formatMoney(line.unitPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-body-sm font-bold">
                    {formatMoney(linesSubtotal([line]))}
                  </span>

                  <form action={deleteInvoiceLine}>
                    <input type="hidden" name="id" value={line.id} />
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <button
                      type="submit"
                      className="border-brand-line text-caption rounded-pill border px-3 py-1"
                    >
                      刪除
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-brand-muted mt-4">還沒有明細，所以金額是 0。</p>
        )}

        <dl className="mt-4 flex flex-col gap-1 text-right">
          <div className="text-body-sm">
            <dt className="inline">小計 </dt>
            <dd className="inline font-bold">{formatMoney(invoice.subtotal)}</dd>
          </div>
          <div className="text-body-sm">
            <dt className="inline">稅 </dt>
            <dd className="inline font-bold">{formatMoney(invoice.tax)}</dd>
          </div>
          <div className="text-body">
            <dt className="inline">總計 </dt>
            <dd className="inline font-bold">{formatMoney(invoice.total)}</dd>
          </div>
        </dl>

        <AddInvoiceLineForm invoiceId={invoice.id} />
      </section>

      {/* ── 收款 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">
          收款
          <span className="text-body-sm text-brand-muted ml-3 font-normal">
            已收 {formatMoney(invoice.paid)}
            {balance > 0 ? ` · 還差 ${formatMoney(balance)}` : " · 已收足"}
          </span>
        </h2>
        <p className="text-body-sm text-brand-muted mt-2">
          分期收款是<strong>多筆紀錄</strong>，不是改狀態。收了一半就把單改成已收款的話，
          「還差多少」就再也算不出來了。
        </p>

        <AddPaymentForm invoiceId={invoice.id} today={today} />

        {payments.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">{formatMoney(payment.amount)}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {payment.paidOn}
                    {payment.method ? ` · ${payment.method}` : ""}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>

                <form action={deletePayment}>
                  <input type="hidden" name="id" value={payment.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <button
                    type="submit"
                    className="border-brand-line text-caption rounded-pill border px-3 py-1"
                  >
                    刪除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-brand-muted mt-4">還沒有收款紀錄。</p>
        )}
      </section>
    </>
  );
}
