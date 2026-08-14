import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireMember } from "@/features/account/auth";
import { MEMBER_NAV } from "@/features/dashboard/nav";

import { signOut } from "./actions";

/**
 * 會員 dashboard 的版面（CR-004 / Phase B BB）
 *
 * ── 這裡是「我的帳號」，不是網站管理後台 ──────────────────────
 *
 * 兩個後台是分開的：
 *   /account            一般人的。路徑公開，任何登入者都進得來。
 *   ADMIN_SEGMENT 那條  員工的。路徑保密，非員工一律 404。
 *
 * ⚠️ 身分驗證在**這一層**做一次，個別頁面不再各自驗——分散驗證遲早
 * 會漏掉一頁，而漏掉的那頁不會有任何徵兆。
 *
 * 但 Server Action 仍必須各自驗（見 ./actions.ts）：它們是獨立的端點，
 * 不經過這個版面。
 *
 * `DashboardShell` 只負責長相，它不知道使用者是誰——共用外殼最容易滑向
 * 共用權限判斷，而那正是 CR-002 拒絕的結構。
 */

export const metadata: Metadata = {
  title: "我的帳號｜一頁起家",
  // 帳號頁沒有任何對搜尋引擎有意義的內容，而且它是個人資料
  robots: { index: false, follow: false, nocache: true },
};

// 會員頁永遠反映當下狀態，不快取
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember("/account");

  return (
    <DashboardShell
      brand="我的帳號"
      nav={MEMBER_NAV}
      identity={<span>{member.displayName || member.email}</span>}
      signOut={
        // 表單而非連結：登出會改變狀態，不該是可被預抓（prefetch）的東西
        <form action={signOut}>
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
