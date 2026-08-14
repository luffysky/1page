import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { listAllProjects } from "@/features/admin/portfolio-repository";
import { listClients } from "@/features/backoffice/clients";
import { listDeals } from "@/features/backoffice/deals";

import { EngagementForm } from "../engagement-form";

/**
 * 新增專案（CR-004 / Phase B BF）
 *
 * `?client=<id>` 會預選客戶——從客戶詳細頁按「新增專案」進來時用得到。
 */

export default async function AdminNewEngagementPage({
  searchParams,
}: PageProps<"/admin/engagements/new">) {
  const params = await searchParams;
  const preselect = typeof params.client === "string" ? params.client : "";

  const [clients, deals, projects] = await Promise.all([
    listClients(),
    listDeals("won"),
    listAllProjects(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">新增專案</h1>
          <p className="text-body text-brand-muted mt-3">
            成交的報價可以直接在報價詳細頁按「開成專案」，名稱與客戶會一起帶過來。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/engagements")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回專案列表
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="border-brand-line text-body-sm mt-8 rounded-lg border border-dashed p-8 text-center">
          還沒有任何客戶，專案要掛在客戶底下。
          <Link href={toAdminUrl("/admin/clients/new")} className="ml-1 underline">
            先建一個客戶
          </Link>
        </p>
      ) : (
        <EngagementForm
          listHref={toAdminUrl("/admin/engagements")}
          detailHrefPrefix={toAdminUrl("/admin/engagements")}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          deals={deals.map((deal) => ({ id: deal.id, title: deal.title }))}
          portfolioProjects={projects.map((project) => ({
            id: project.id,
            title: project.title,
          }))}
          initial={{
            clientId: clients.some((client) => client.id === preselect)
              ? preselect
              : (clients[0]?.id ?? ""),
            dealId: "",
            title: "",
            status: "planning",
            startedOn: "",
            dueOn: "",
            deliveredOn: "",
            portfolioProjectId: "",
          }}
        />
      )}
    </>
  );
}
