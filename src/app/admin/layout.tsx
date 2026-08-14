import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isOwnerRole, toAdminUrl } from "@/config/admin";
import { requireAdmin } from "@/features/admin/auth";
import { signOutAction } from "@/features/admin/session-actions";
import { ADMIN_NAV } from "@/features/dashboard/nav";

/**
 * 後台版面（Spec §41 / CR-004 Phase B BC）
 *
 * 此檔是所有後台頁面的單一入口守衛。個別頁面不需要再各自驗證身分——
 * 分散驗證遲早會漏掉一頁，而漏掉的那頁不會有任何徵兆。
 *
 * ⚠️ 但 Server Action 仍必須各自驗證（見 features/admin/actions.ts）：
 * 它們是獨立的端點，不經過這個版面。
 *
 * 網址是 `/<ADMIN_SEGMENT>/admin/*`，proxy 內部改寫到 `/admin/*`。
 * 裸 `/admin` 一律當作不存在。
 *
 * ── 密路徑在這一層才被組出來 ──────────────────────────────────
 *
 * `ADMIN_NAV` 存的是內部路徑（`/admin/portfolio`），到這裡才用
 * `toAdminUrl()` 換成對外網址。`DashboardShell` 是 client component，
 * 讓它自己算的話，`ADMIN_SEGMENT` 就得加 `NEXT_PUBLIC_` 前綴——
 * 那等於把密路徑打包進每一位訪客都會下載的 JS。
 * （ai_island_v3 的 CLAUDE.md 特地為這件事寫了一段警告。）
 */

export const metadata: Metadata = {
  title: "後台｜一頁起家",
  robots: { index: false, follow: false, nocache: true },
};

// 後台永遠反映當下狀態，不快取
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireAdmin();

  const nav = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, href: toAdminUrl(item.href) })),
  }));

  return (
    <DashboardShell
      brand="後台"
      nav={nav}
      identity={
        <span>
          {identity.email}
          <span className="border-brand-line ml-2 rounded-pill border px-2 py-0.5">
            {isOwnerRole(identity.role) ? "owner" : "admin"}
          </span>
        </span>
      }
      signOut={
        // 表單而非連結：登出會改變狀態，不該是可被預抓（prefetch）的東西
        <form action={signOutAction}>
          <button
            type="submit"
            className="border-brand-line hover:border-brand-ink rounded-pill border px-3 py-1"
          >
            登出
          </button>
        </form>
      }
    >
      {children}
    </DashboardShell>
  );
}
