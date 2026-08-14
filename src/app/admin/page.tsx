import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { countLeads } from "@/features/admin/leads-repository";
import { getProjectCounts } from "@/features/admin/portfolio-repository";
import { ADMIN_NAV, navItems } from "@/features/dashboard/nav";

/**
 * 後台總覽（CR-004 / Phase B BC）
 *
 * 卡片直接讀 `ADMIN_NAV`：導覽是一份資料，這裡不再抄一次標題與說明。
 * 抄一次的話，改了選單名稱而忘了改卡片，兩個地方會對同一頁有兩種說法。
 * 後台頁面會長到 30+ 個（CR-004 的 CRM / ERP / CMS），那時這一頁
 * 就是找路的地方。
 */

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="border-brand-line bg-brand-paper rounded-lg border p-6">
      <p className="text-caption text-brand-muted">{label}</p>
      <p className="text-display-2 mt-2">{value}</p>
      {hint ? <p className="text-caption text-brand-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export default async function AdminDashboard() {
  const [counts, leadCount] = await Promise.all([getProjectCounts(), countLeads()]);

  return (
    <>
      <h1 className="text-display-2">總覽</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="作品總數" value={counts.all} />
        <Stat label="已發布" value={counts.published} hint="訪客看得到的" />
        <Stat label="草稿" value={counts.draft} hint="只有後台看得到" />
        <Stat label="收到的需求" value={leadCount} hint="訪客留下的詢問" />
      </div>

      {counts.featured > 6 ? (
        <p className="border-brand-accent bg-brand-paper text-body-sm mt-6 rounded-lg border-l-4 p-4">
          首頁精選有 {counts.featured} 件。Spec §8.11 建議 3～6
          件——太多會稀釋「一眼證明我們做得出來」的效果。
        </p>
      ) : null}

      <h2 className="text-heading-2 mt-12">管理區</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {navItems(ADMIN_NAV)
          .filter((item) => item.href !== "/admin")
          .map((item) => (
            <li key={item.href}>
              <Link
                href={toAdminUrl(item.href)}
                className="border-brand-line hover:border-brand-ink block h-full rounded-lg border p-5"
              >
                <p className="text-body font-bold">{item.label}</p>
                {item.hint ? (
                  <p className="text-body-sm text-brand-muted mt-1">{item.hint}</p>
                ) : null}
              </Link>
            </li>
          ))}
      </ul>
    </>
  );
}
