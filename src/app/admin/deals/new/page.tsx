import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { listClients } from "@/features/backoffice/clients";

import { DealForm } from "../deal-form";

/**
 * 新增報價（CR-004 / Phase B BE）
 *
 * `?client=<id>` 會預選客戶——從客戶詳細頁按「新增報價」進來時用得到。
 */

export default async function AdminNewDealPage({ searchParams }: PageProps<"/admin/deals/new">) {
  const params = await searchParams;
  const preselect = typeof params.client === "string" ? params.client : "";

  const clients = await listClients();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">新增報價</h1>
          <p className="text-body text-brand-muted mt-3">
            先把名稱與客戶記下來就好。金額與明細可以之後再補—— 談到一半才知道要報多少是常態。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/deals")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回報價列表
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="border-brand-line text-body-sm mt-8 rounded-lg border border-dashed p-8 text-center">
          還沒有任何客戶，報價要掛在客戶底下。
          <Link href={toAdminUrl("/admin/clients/new")} className="ml-1 underline">
            先建一個客戶
          </Link>
        </p>
      ) : (
        <DealForm
          listHref={toAdminUrl("/admin/deals")}
          detailHrefPrefix={toAdminUrl("/admin/deals")}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          initial={{
            clientId: clients.some((client) => client.id === preselect)
              ? preselect
              : (clients[0]?.id ?? ""),
            title: "",
            stage: "inquiry",
            amount: "",
            expectedClose: "",
            lostReason: "",
          }}
        />
      )}
    </>
  );
}
