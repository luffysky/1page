import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { getProjectCounts } from "@/features/admin/portfolio-repository";

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
  const counts = await getProjectCounts();

  return (
    <>
      <h1 className="text-display-2">總覽</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="作品總數" value={counts.all} />
        <Stat label="已發布" value={counts.published} hint="訪客看得到的" />
        <Stat label="草稿" value={counts.draft} hint="只有後台看得到" />
        <Stat label="首頁精選" value={counts.featured} hint="建議 3～6 件" />
      </div>

      {counts.featured > 6 ? (
        <p className="border-brand-accent bg-brand-paper text-body-sm mt-6 rounded-lg border-l-4 p-4">
          首頁精選有 {counts.featured} 件。Spec §8.11 建議 3～6
          件——太多會稀釋「一眼證明我們做得出來」的效果。
        </p>
      ) : null}

      <div className="mt-10">
        <Link
          href={toAdminUrl("/admin/portfolio")}
          className="bg-brand-ink text-brand-on-ink text-body-sm inline-flex rounded-pill px-5 py-3 font-bold"
        >
          管理作品
        </Link>
      </div>
    </>
  );
}
