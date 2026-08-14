import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import {
  CLIENT_KIND_LABELS,
  CLIENT_STATUS_LABELS,
  type ClientStatus,
} from "@/features/backoffice/client-types";
import { getClientCounts, listClients } from "@/features/backoffice/clients";

/**
 * 客戶列表（CR-004 / Phase B BD）
 *
 * 篩選走網址參數，與 /work 同一套模式：可分享、重新整理不掉狀態，
 * 而且不需要 client component。
 */

const STATUSES: ClientStatus[] = ["prospect", "active", "past"];

export default async function AdminClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "";
  const status = STATUSES.includes(raw as ClientStatus) ? (raw as ClientStatus) : undefined;

  const [clients, counts] = await Promise.all([listClients(status), getClientCounts()]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">客戶</h1>
          <p className="text-body text-brand-muted mt-3">
            從詢問轉過來的、或自己找上門的。一筆詢問要轉成客戶，到收件匣按「建立客戶」。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/clients/new")}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          新增客戶
        </Link>
      </div>

      {/*
       * 狀態篩選。用連結而不是按鈕：這是導覽，不是操作——
       * 可以用中鍵開新分頁，也可以複製網址傳給別人。
       */}
      <nav aria-label="依狀態篩選" className="mt-8 flex flex-wrap gap-2">
        <Link
          href={toAdminUrl("/admin/clients")}
          aria-current={status === undefined ? "page" : undefined}
          className={`text-body-sm rounded-pill border px-4 py-2 ${
            status === undefined
              ? "border-brand-ink bg-brand-ink text-brand-on-ink"
              : "border-brand-line"
          }`}
        >
          全部（{counts.all}）
        </Link>

        {STATUSES.map((item) => (
          <Link
            key={item}
            href={toAdminUrl(`/admin/clients?status=${item}`)}
            aria-current={status === item ? "page" : undefined}
            className={`text-body-sm rounded-pill border px-4 py-2 ${
              status === item
                ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                : "border-brand-line"
            }`}
          >
            {CLIENT_STATUS_LABELS[item]}（{counts[item]}）
          </Link>
        ))}
      </nav>

      {clients.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          {status ? "這個狀態下沒有客戶。" : "還沒有任何客戶。"}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={toAdminUrl(`/admin/clients/${client.id}`)}
                className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="text-body font-bold">{client.name}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {CLIENT_KIND_LABELS[client.kind]}
                    {client.industry ? ` · ${client.industry}` : ""}
                    {client.source ? ` · 來自${client.source}` : ""}
                  </p>
                </div>

                <span className="border-brand-line text-caption rounded-pill border px-3 py-1">
                  {CLIENT_STATUS_LABELS[client.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
