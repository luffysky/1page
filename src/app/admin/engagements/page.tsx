import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import {
  ENGAGEMENT_STATUSES,
  ENGAGEMENT_STATUS_LABELS,
  OPEN_ENGAGEMENT_STATUSES,
  type EngagementStatus,
} from "@/features/backoffice/engagement-types";
import { getEngagementCounts, listEngagements } from "@/features/backoffice/engagements";

/**
 * 專案列表（CR-004 / Phase B BF）
 *
 * ⚠️ 這裡的「專案」是接的案子，不是作品集裡的作品。
 * 兩個都叫 project 的話半年後沒有人分得出哪個是哪個——
 * 所以資料表叫 engagements，畫面上叫「專案」而作品那邊叫「作品」。
 */

/** 逾期：有截止日、還沒交付、而且已經過了 */
function isOverdue(dueOn: string | null, deliveredOn: string | null, today: string): boolean {
  return Boolean(dueOn) && !deliveredOn && dueOn! < today;
}

export default async function AdminEngagementsPage({
  searchParams,
}: PageProps<"/admin/engagements">) {
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "";
  const status = ENGAGEMENT_STATUSES.includes(raw as EngagementStatus)
    ? (raw as EngagementStatus)
    : undefined;

  const [engagements, counts] = await Promise.all([listEngagements(status), getEngagementCounts()]);

  const today = new Date().toISOString().slice(0, 10);
  const openCount = OPEN_ENGAGEMENT_STATUSES.reduce((total, item) => total + counts[item], 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">專案</h1>
          <p className="text-body text-brand-muted mt-3">
            接下來的案子。手上同時有 <strong>{openCount}</strong> 個還沒交付。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/engagements/new")}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          新增專案
        </Link>
      </div>

      <nav aria-label="依狀態篩選" className="mt-8 flex flex-wrap gap-2">
        <Link
          href={toAdminUrl("/admin/engagements")}
          aria-current={status === undefined ? "page" : undefined}
          className={`text-body-sm rounded-pill border px-4 py-2 ${
            status === undefined
              ? "border-brand-ink bg-brand-ink text-brand-on-ink"
              : "border-brand-line"
          }`}
        >
          全部（{counts.all}）
        </Link>

        {ENGAGEMENT_STATUSES.map((item) => (
          <Link
            key={item}
            href={toAdminUrl(`/admin/engagements?status=${item}`)}
            aria-current={status === item ? "page" : undefined}
            className={`text-body-sm rounded-pill border px-4 py-2 ${
              status === item
                ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                : "border-brand-line"
            }`}
          >
            {ENGAGEMENT_STATUS_LABELS[item]}（{counts[item]}）
          </Link>
        ))}
      </nav>

      {engagements.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          {status
            ? "這個狀態下沒有專案。"
            : "還沒有任何專案。成交的報價可以在報價詳細頁按「開成專案」。"}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {engagements.map((engagement) => (
            <li key={engagement.id}>
              <Link
                href={toAdminUrl(`/admin/engagements/${engagement.id}`)}
                className="border-brand-line hover:border-brand-ink flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="text-body font-bold">{engagement.title}</p>
                  <p className="text-caption text-brand-muted mt-1">
                    {engagement.clientName}
                    {engagement.dueOn ? ` · 截止 ${engagement.dueOn}` : ""}
                    {engagement.deliveredOn ? ` · 已交付 ${engagement.deliveredOn}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/*
                   * 逾期要看得出來。
                   *
                   * 只顯示日期的話，要自己心算「今天是幾號、這個過了沒」——
                   * 而那件事在忙的時候不會發生。
                   */}
                  {isOverdue(engagement.dueOn, engagement.deliveredOn, today) ? (
                    <span className="border-brand-ink text-caption rounded-pill border px-3 py-1 font-bold">
                      已逾期
                    </span>
                  ) : null}

                  <span className="border-brand-line text-caption rounded-pill border px-3 py-1">
                    {ENGAGEMENT_STATUS_LABELS[engagement.status]}
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
