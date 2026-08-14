import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { addNote, deleteContact } from "@/features/backoffice/actions";
import { CLIENT_STATUS_LABELS } from "@/features/backoffice/client-types";
import { getClient } from "@/features/backoffice/clients";
import { DEAL_STAGE_LABELS, formatAmount } from "@/features/backoffice/deal-types";
import { listDealsForClient } from "@/features/backoffice/deals";
import { ENGAGEMENT_STATUS_LABELS } from "@/features/backoffice/engagement-types";
import { listEngagementsForClient } from "@/features/backoffice/engagements";
import { INVOICE_STATUS_LABELS, balanceOf, formatMoney } from "@/features/backoffice/invoice-types";
import { listInvoicesForClient } from "@/features/backoffice/invoices";

import { AddContactForm } from "../client-actions";
import { ClientForm } from "../client-form";

/**
 * 客戶詳細頁（CR-004 / Phase B BD）
 *
 * 一頁看完：基本資料、聯絡人、備註、時間軸、以及它是從哪幾筆詢問來的。
 *
 * ⚠️ 詢問只連過去，不在這裡編輯。`leads` 是訪客當時說的話——那是證據，
 * 不該被後續的理解覆蓋。
 */

/** 時間軸的事件名。程式產生的 kind → 給人看的字 */
const ACTIVITY_LABELS: Record<string, string> = {
  created: "建立了這個客戶",
  updated: "更新了資料",
  status_changed: "改了狀態",
};

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export default async function AdminClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const [detail, deals, engagements, invoices] = await Promise.all([
    getClient(id),
    listDealsForClient(id),
    listEngagementsForClient(id),
    listInvoicesForClient(id),
  ]);

  if (!detail) notFound();

  const { client, contacts, notes, activities, leads } = detail;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">{client.name}</h1>
          <p className="text-caption text-brand-muted mt-2">
            {CLIENT_STATUS_LABELS[client.status]}
            {client.industry ? ` · ${client.industry}` : ""}
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/clients")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回客戶列表
        </Link>
      </div>

      <ClientForm
        listHref={toAdminUrl("/admin/clients")}
        detailHrefPrefix={toAdminUrl("/admin/clients")}
        initial={{
          id: client.id,
          name: client.name,
          kind: client.kind,
          status: client.status,
          industry: client.industry ?? "",
          source: client.source ?? "",
          note: client.note ?? "",
        }}
      />

      {/* ── 聯絡人 ───────────────────────────────────────────── */}
      <section className="border-brand-line mt-12 border-t pt-8">
        <h2 className="text-heading-2">聯絡人</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          主要聯絡人只能有一位——寄信時要挑一個，兩位「主要」等於沒有主要。
        </p>

        {contacts.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">
                    {contact.name}
                    {contact.isPrimary ? (
                      <span className="border-brand-ink text-caption ml-2 rounded-pill border px-2 py-0.5">
                        主要
                      </span>
                    ) : null}
                  </p>
                  <p className="text-caption text-brand-muted mt-1">
                    {contact.title ? `${contact.title} · ` : ""}
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="underline">
                        {contact.email}
                      </a>
                    ) : null}
                    {contact.phone ? ` · ${contact.phone}` : ""}
                  </p>
                </div>

                <form action={deleteContact}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="clientId" value={client.id} />
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
          <p className="text-body-sm text-brand-muted mt-4">還沒有聯絡人。</p>
        )}

        <AddContactForm clientId={client.id} />
      </section>

      {/* ── 報價 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading-2">報價</h2>
          <Link
            href={toAdminUrl(`/admin/deals/new?client=${client.id}`)}
            className="border-brand-ink text-body-sm rounded-pill border px-5 py-2.5 font-bold"
          >
            新增報價
          </Link>
        </div>

        {deals.length === 0 ? (
          <p className="text-body-sm text-brand-muted mt-4">還沒有跟這個客戶談過任何一筆。</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={toAdminUrl(`/admin/deals/${deal.id}`)}
                  className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="text-body-sm font-bold">{deal.title}</span>
                  <span className="text-caption text-brand-muted">
                    {DEAL_STAGE_LABELS[deal.stage]} · {formatAmount(deal.amount, deal.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 專案 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading-2">專案</h2>
          <Link
            href={toAdminUrl(`/admin/engagements/new?client=${client.id}`)}
            className="border-brand-ink text-body-sm rounded-pill border px-5 py-2.5 font-bold"
          >
            新增專案
          </Link>
        </div>

        {engagements.length === 0 ? (
          <p className="text-body-sm text-brand-muted mt-4">還沒有替這個客戶做過任何案子。</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {engagements.map((engagement) => (
              <li key={engagement.id}>
                <Link
                  href={toAdminUrl(`/admin/engagements/${engagement.id}`)}
                  className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="text-body-sm font-bold">{engagement.title}</span>
                  <span className="text-caption text-brand-muted">
                    {ENGAGEMENT_STATUS_LABELS[engagement.status]}
                    {engagement.dueOn ? ` · 截止 ${engagement.dueOn}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 請款 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading-2">請款</h2>
          <Link
            href={toAdminUrl(`/admin/invoices/new?client=${client.id}`)}
            className="border-brand-ink text-body-sm rounded-pill border px-5 py-2.5 font-bold"
          >
            開一張請款單
          </Link>
        </div>

        {invoices.length === 0 ? (
          <p className="text-body-sm text-brand-muted mt-4">還沒有跟這個客戶請過款。</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={toAdminUrl(`/admin/invoices/${invoice.id}`)}
                  className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="text-body-sm font-bold">{invoice.number}</span>
                  <span className="text-caption text-brand-muted">
                    {INVOICE_STATUS_LABELS[invoice.status]} · {formatMoney(invoice.total)}
                    {balanceOf(invoice.total, invoice.paid) > 0
                      ? ` · 還差 ${formatMoney(balanceOf(invoice.total, invoice.paid))}`
                      : " · 已收足"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 備註 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">備註</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          單次的事寫在這裡（通過電話、對方在考慮、報價寄出）。 長期有效的事實寫在上面的「備註」欄。
        </p>

        <form action={addNote} className="mt-4">
          <input type="hidden" name="subjectType" value="client" />
          <input type="hidden" name="subjectId" value={client.id} />

          <label htmlFor="note-body" className="sr-only">
            新增一則備註
          </label>
          <textarea
            id="note-body"
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="今天發生了什麼？"
            className={input}
          />

          <button
            type="submit"
            className="border-brand-ink text-body-sm rounded-pill mt-3 border px-5 py-2.5 font-bold"
          >
            新增備註
          </button>
        </form>

        {notes.length > 0 ? (
          <ul className="mt-6 flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="border-brand-line rounded-md border p-3">
                <p className="text-body-sm whitespace-pre-wrap">{note.body}</p>
                <p className="text-caption text-brand-muted mt-2">
                  {new Date(note.createdAt).toLocaleString("zh-TW")}
                  {note.internal ? " · 內部" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ── 時間軸 ───────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">時間軸</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          由資料庫的 trigger 記錄，不靠人記得寫——漏掉的那一筆會變成一段空白，
          而「沒發生過」與「發生了但沒記」看起來一模一樣。
        </p>

        {activities.length === 0 ? (
          <p className="text-body-sm text-brand-muted mt-4">還沒有紀錄。</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-2">
            {activities.map((activity) => (
              <li key={activity.id} className="text-body-sm flex flex-wrap gap-x-3">
                <span className="text-brand-muted text-caption">
                  {new Date(activity.createdAt).toLocaleString("zh-TW")}
                </span>
                <span>{ACTIVITY_LABELS[activity.kind] ?? activity.kind}</span>
                {activity.kind === "status_changed" && Array.isArray(activity.detail.status) ? (
                  <span className="text-brand-muted">
                    {String((activity.detail.status as unknown[])[0])} →{" "}
                    {String((activity.detail.status as unknown[])[1])}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── 來自哪幾筆詢問 ───────────────────────────────────── */}
      {leads.length > 0 ? (
        <section className="border-brand-line mt-10 border-t pt-8">
          <h2 className="text-heading-2">來自這幾筆詢問</h2>
          <p className="text-body-sm text-brand-muted mt-2">
            訪客當時說的話。這裡只連過去，不編輯——那是證據，不該被後續的理解覆蓋。
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id} className="text-body-sm">
                <Link href={toAdminUrl("/admin/inbox")} className="underline">
                  {lead.businessName || "（沒有填名稱）"}
                </Link>
                <span className="text-brand-muted text-caption ml-2">
                  {new Date(lead.createdAt).toLocaleString("zh-TW")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
