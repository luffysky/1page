import type { Metadata } from "next";
import Link from "next/link";

import { isOwnerRole, toAdminUrl } from "@/config/admin";
import { requireAdmin } from "@/features/admin/auth";

/**
 * 後台版面（Spec §41）
 *
 * 此檔是所有後台頁面的單一入口守衛。個別頁面不需要再各自驗證身分——
 * 分散驗證遲早會漏掉一頁，而漏掉的那頁不會有任何徵兆。
 *
 * ⚠️ 但 Server Action 仍必須各自驗證（見 features/admin/actions.ts）：
 * 它們是獨立的端點，不經過這個版面。
 *
 * 網址是 `/<ADMIN_SEGMENT>/admin/*`，middleware 內部改寫到 `/admin/*`。
 * 裸 `/admin` 一律當作不存在。
 */

export const metadata: Metadata = {
  title: "後台｜一頁起家",
  robots: { index: false, follow: false, nocache: true },
};

// 後台永遠反映當下狀態，不快取
export const dynamic = "force-dynamic";

const NAV = [
  { label: "總覽", href: "/admin" },
  { label: "作品", href: "/admin/portfolio" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-brand-line bg-brand-paper border-b">
        <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-4 px-gutter py-4 lg:px-gutter-lg">
          <div className="flex items-center gap-6">
            <Link href={toAdminUrl("/admin")} className="flex items-center gap-3">
              <span className="bg-brand-ink text-brand-on-ink grid h-9 w-9 place-items-center rounded-md font-black">
                1
              </span>
              <span className="text-heading-2">後台</span>
            </Link>

            <nav aria-label="後台導覽" className="text-body-sm flex gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={toAdminUrl(item.href)}
                  className="text-brand-muted hover:text-brand-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="text-caption text-brand-muted flex items-center gap-4">
            <span>
              {identity.email}
              <span className="border-brand-line ml-2 rounded-pill border px-2 py-0.5">
                {isOwnerRole(identity.role) ? "owner" : "admin"}
              </span>
            </span>
            <Link href="/" className="hover:text-brand-ink underline underline-offset-4">
              回到網站
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-page px-gutter py-12 lg:px-gutter-lg">{children}</main>
    </div>
  );
}
