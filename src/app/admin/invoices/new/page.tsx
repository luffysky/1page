import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { listClients } from "@/features/backoffice/clients";
import { listEngagements } from "@/features/backoffice/engagements";
import { suggestInvoiceNumber } from "@/features/backoffice/invoice-types";
import { existingInvoiceNumbers } from "@/features/backoffice/invoices";

import { InvoiceForm } from "../invoice-form";

/**
 * 開一張請款單（CR-004 / Phase B BG）
 *
 * `?client=` 與 `?engagement=` 會預選——從客戶頁或專案頁進來時用得到。
 */

export default async function AdminNewInvoicePage({
  searchParams,
}: PageProps<"/admin/invoices/new">) {
  const params = await searchParams;
  const preselectClient = typeof params.client === "string" ? params.client : "";
  const preselectEngagement = typeof params.engagement === "string" ? params.engagement : "";

  const [clients, engagements, numbers] = await Promise.all([
    listClients(),
    listEngagements(),
    existingInvoiceNumbers(),
  ]);

  /*
   * 編號先幫他填好。
   *
   * ⚠️ 這只是建議值：兩個人同時開單時算出來的會是同一個號碼，
   * 而真正的唯一性由資料庫的 unique constraint 擋。
   * 那時畫面上要看到的是「編號已經用過了，換一個」，
   * 不是一個看不懂的資料庫錯誤。
   */
  const suggested = suggestInvoiceNumber(numbers, new Date().getFullYear());

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">開一張請款單</h1>
          <p className="text-body text-brand-muted mt-3">
            先把編號與客戶記下來，明細可以之後再加。金額由明細算出來。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/invoices")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回請款列表
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="border-brand-line text-body-sm mt-8 rounded-lg border border-dashed p-8 text-center">
          還沒有任何客戶，請款單要掛在客戶底下。
          <Link href={toAdminUrl("/admin/clients/new")} className="ml-1 underline">
            先建一個客戶
          </Link>
        </p>
      ) : (
        <InvoiceForm
          listHref={toAdminUrl("/admin/invoices")}
          detailHrefPrefix={toAdminUrl("/admin/invoices")}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          engagements={engagements.map((engagement) => ({
            id: engagement.id,
            title: engagement.title,
          }))}
          initial={{
            clientId: clients.some((client) => client.id === preselectClient)
              ? preselectClient
              : (clients[0]?.id ?? ""),
            engagementId: engagements.some((item) => item.id === preselectEngagement)
              ? preselectEngagement
              : "",
            number: suggested,
            status: "draft",
            issuedOn: "",
            dueOn: "",
            taxPercent: "0",
          }}
        />
      )}
    </>
  );
}
