import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { addNote, deleteDealItem } from "@/features/backoffice/actions";
import { DEAL_STAGE_LABELS, dealItemsTotal, formatAmount } from "@/features/backoffice/deal-types";
import { listClients } from "@/features/backoffice/clients";
import { getDeal } from "@/features/backoffice/deals";

import { AddDealItemForm } from "../deal-actions";
import { DealForm } from "../deal-form";

/**
 * 報價詳細頁（CR-004 / Phase B BE）
 */

const ACTIVITY_LABELS: Record<string, string> = {
  created: "建立了這筆報價",
  updated: "更新了資料",
  stage_changed: "改了階段",
};

const input = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

export default async function AdminDealDetailPage({ params }: PageProps<"/admin/deals/[id]">) {
  const { id } = await params;

  const [detail, clients] = await Promise.all([getDeal(id), listClients()]);
  if (!detail) notFound();

  const { deal, items, notes, activities } = detail;
  const itemsTotal = dealItemsTotal(items);

  /*
   * 明細合計與報價金額對不起來時要說出來。
   *
   * 這是真的會發生的事：加了一個項目卻忘了把上面的金額改掉，
   * 然後寄出去的報價單與系統裡的數字差一截。
   * 兩個都是人填的，系統不該自作主張改哪一個——但可以指出來。
   */
  const mismatch =
    items.length > 0 && deal.amount !== null && Math.abs(itemsTotal - deal.amount) > 0.005;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">{deal.title}</h1>
          <p className="text-caption text-brand-muted mt-2">
            <Link href={toAdminUrl(`/admin/clients/${deal.clientId}`)} className="underline">
              {deal.clientName}
            </Link>
            {` · ${DEAL_STAGE_LABELS[deal.stage]} · ${formatAmount(deal.amount, deal.currency)}`}
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/deals")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回報價列表
        </Link>
      </div>

      {deal.stage === "lost" && deal.lostReason ? (
        <p className="border-brand-line text-body-sm mt-6 rounded-lg border border-dashed p-4">
          <strong>沒成的原因：</strong>
          {deal.lostReason}
        </p>
      ) : null}

      <DealForm
        listHref={toAdminUrl("/admin/deals")}
        detailHrefPrefix={toAdminUrl("/admin/deals")}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        initial={{
          id: deal.id,
          clientId: deal.clientId,
          title: deal.title,
          stage: deal.stage,
          amount: deal.amount === null ? "" : String(deal.amount),
          expectedClose: deal.expectedClose ?? "",
          lostReason: deal.lostReason ?? "",
        }}
      />

      {/* ── 明細 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-12 border-t pt-8">
        <h2 className="text-heading-2">明細</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          單價存下來，不是每次去查現在的定價——寄出去的報價不能因為之後調價而跟著變。
        </p>

        {items.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">{item.description}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {item.quantity} × {formatAmount(item.unitPrice, deal.currency)}
                    {item.serviceId ? ` · ${item.serviceId}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-body-sm font-bold">
                    {formatAmount(dealItemsTotal([item]), deal.currency)}
                  </span>

                  <form action={deleteDealItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="dealId" value={deal.id} />
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
          <p className="text-body-sm text-brand-muted mt-4">還沒有明細。</p>
        )}

        {items.length > 0 ? (
          <p className="text-body mt-4 text-right font-bold">
            明細合計 {formatAmount(itemsTotal, deal.currency)}
          </p>
        ) : null}

        {mismatch ? (
          <p
            role="status"
            className="border-brand-line text-body-sm mt-3 rounded-md border border-dashed p-3"
          >
            明細合計與上面填的報價金額不一樣（{formatAmount(itemsTotal, deal.currency)} vs{" "}
            {formatAmount(deal.amount, deal.currency)}）。
            <span className="text-brand-muted mt-1 block">
              兩個都是人填的，系統不改任何一邊——但寄出去之前記得先對一下。
            </span>
          </p>
        ) : null}

        <AddDealItemForm dealId={deal.id} />
      </section>

      {/* ── 備註 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">備註</h2>

        <form action={addNote} className="mt-4">
          <input type="hidden" name="subjectType" value="deal" />
          <input type="hidden" name="subjectId" value={deal.id} />

          <label htmlFor="deal-note-body" className="sr-only">
            新增一則備註
          </label>
          <textarea
            id="deal-note-body"
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="這次談了什麼？"
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
          階段與金額的每一次變化都由資料庫的 trigger 記下來。
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
                {Array.isArray(activity.detail.stage) ? (
                  <span className="text-brand-muted">
                    {String((activity.detail.stage as unknown[])[0])} →{" "}
                    {String((activity.detail.stage as unknown[])[1])}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
