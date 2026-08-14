import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { listAllProjects } from "@/features/admin/portfolio-repository";
import { deleteMilestone, deleteTimeEntry, toggleMilestone } from "@/features/backoffice/actions";
import { listClients } from "@/features/backoffice/clients";
import { listDeals } from "@/features/backoffice/deals";
import {
  ENGAGEMENT_STATUS_LABELS,
  formatMinutes,
  totalMinutes,
} from "@/features/backoffice/engagement-types";
import { getEngagement, getEngagementMinutes } from "@/features/backoffice/engagements";

import { AddMilestoneForm, AddTimeEntryForm } from "../engagement-actions";
import { EngagementForm } from "../engagement-form";

/**
 * 專案詳細頁（CR-004 / Phase B BF）
 */

const ACTIVITY_LABELS: Record<string, string> = {
  created: "開了這個案",
  updated: "更新了資料",
  status_changed: "改了狀態",
};

export default async function AdminEngagementDetailPage({
  params,
}: PageProps<"/admin/engagements/[id]">) {
  const { id } = await params;

  const [detail, minutes, clients, deals, projects] = await Promise.all([
    getEngagement(id),
    getEngagementMinutes(id),
    listClients(),
    listDeals("won"),
    listAllProjects(),
  ]);

  if (!detail) notFound();

  const { engagement, milestones, timeEntries, activities } = detail;
  const today = new Date().toISOString().slice(0, 10);
  const doneCount = milestones.filter((milestone) => milestone.doneOn).length;

  /*
   * 撈回來的工時被 limit 切過，合計則是資料庫算的。
   *
   * 兩個對不上就代表下面那份清單不是全部——說出來，
   * 不然「合計比看得到的多」會被當成算錯。
   */
  const listedMinutes = totalMinutes(timeEntries);
  const truncated = listedMinutes !== minutes;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">{engagement.title}</h1>
          <p className="text-caption text-brand-muted mt-2">
            <Link href={toAdminUrl(`/admin/clients/${engagement.clientId}`)} className="underline">
              {engagement.clientName}
            </Link>
            {` · ${ENGAGEMENT_STATUS_LABELS[engagement.status]} · 已投入 ${formatMinutes(minutes)}`}
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/engagements")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回專案列表
        </Link>
      </div>

      {engagement.dealId ? (
        <p className="text-body-sm mt-6">
          <Link href={toAdminUrl(`/admin/deals/${engagement.dealId}`)} className="underline">
            看當初的報價
          </Link>
          <span className="text-brand-muted text-caption ml-2">
            報價不會被這裡改動——請款時「當初報多少」必須還查得到。
          </span>
        </p>
      ) : null}

      <EngagementForm
        listHref={toAdminUrl("/admin/engagements")}
        detailHrefPrefix={toAdminUrl("/admin/engagements")}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        deals={deals.map((deal) => ({ id: deal.id, title: deal.title }))}
        portfolioProjects={projects.map((project) => ({ id: project.id, title: project.title }))}
        initial={{
          id: engagement.id,
          clientId: engagement.clientId,
          dealId: engagement.dealId ?? "",
          title: engagement.title,
          status: engagement.status,
          startedOn: engagement.startedOn ?? "",
          dueOn: engagement.dueOn ?? "",
          deliveredOn: engagement.deliveredOn ?? "",
          portfolioProjectId: engagement.portfolioProjectId ?? "",
        }}
      />

      {/* ── 里程碑 ───────────────────────────────────────────── */}
      <section className="border-brand-line mt-12 border-t pt-8">
        <h2 className="text-heading-2">
          里程碑
          {milestones.length > 0 ? (
            <span className="text-body-sm text-brand-muted ml-3 font-normal">
              {doneCount} / {milestones.length} 完成
            </span>
          ) : null}
        </h2>
        <p className="text-body-sm text-brand-muted mt-2">
          綁請款比例的那幾個，就是「做到這裡可以收錢」的節點。
        </p>

        {milestones.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">{milestone.title}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {milestone.doneOn ? `已完成 ${milestone.doneOn}` : "尚未完成"}
                    {milestone.dueOn ? ` · 預計 ${milestone.dueOn}` : ""}
                    {milestone.paymentRatio !== null ? ` · 請款 ${milestone.paymentRatio}%` : ""}
                    {!milestone.doneOn && milestone.dueOn && milestone.dueOn < today
                      ? " · 已逾期"
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <form action={toggleMilestone}>
                    <input type="hidden" name="id" value={milestone.id} />
                    <input type="hidden" name="engagementId" value={engagement.id} />
                    <input type="hidden" name="done" value={milestone.doneOn ? "false" : "true"} />
                    <button
                      type="submit"
                      className="border-brand-ink text-caption rounded-pill border px-3 py-1 font-bold"
                    >
                      {milestone.doneOn ? "退回未完成" : "標記完成"}
                    </button>
                  </form>

                  <form action={deleteMilestone}>
                    <input type="hidden" name="id" value={milestone.id} />
                    <input type="hidden" name="engagementId" value={engagement.id} />
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
          <p className="text-body-sm text-brand-muted mt-4">還沒有里程碑。</p>
        )}

        <AddMilestoneForm engagementId={engagement.id} />
      </section>

      {/* ── 工時 ─────────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">
          工時
          <span className="text-body-sm text-brand-muted ml-3 font-normal">
            共 {formatMinutes(minutes)}
          </span>
        </h2>
        <p className="text-body-sm text-brand-muted mt-2">
          存的是分鐘，不是小時的小數——「0.30 到底是 18 分還是 30 分」那個誤會在對帳時會變成真的錢。
        </p>

        <AddTimeEntryForm engagementId={engagement.id} today={today} />

        {truncated ? (
          <p role="status" className="text-caption text-brand-muted mt-4">
            下面只列出最近 200 筆，但上面的合計是全部。
          </p>
        ) : null}

        {timeEntries.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {timeEntries.map((entry) => (
              <li
                key={entry.id}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-body-sm font-bold">{formatMinutes(entry.minutes)}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {entry.workedOn}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>

                <form action={deleteTimeEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="engagementId" value={engagement.id} />
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
          <p className="text-body-sm text-brand-muted mt-4">還沒有工時紀錄。</p>
        )}
      </section>

      {/* ── 時間軸 ───────────────────────────────────────────── */}
      <section className="border-brand-line mt-10 border-t pt-8">
        <h2 className="text-heading-2">時間軸</h2>

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
                {Array.isArray(activity.detail.status) ? (
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
    </>
  );
}
