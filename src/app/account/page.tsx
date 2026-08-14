import Link from "next/link";

import { requireMember } from "@/features/account/auth";
import { listMyInquiries } from "@/features/account/inquiries";
import { MEMBER_NAV, navItems } from "@/features/dashboard/nav";
import { listSavedSites } from "@/features/website-engine/saved-sites";

/**
 * 會員 dashboard 的總覽（CR-004 / Phase B BB）
 *
 * ── 為什麼總覽只有數字與入口 ──────────────────────────────────
 *
 * 把所有東西都塞在這一頁的話，它會隨著功能變多而越來越長，
 * 最後變成一個誰都不想捲的頁面。總覽回答的是「我在這裡有什麼」，
 * 細節在各自的區段。
 *
 * 卡片直接讀 `MEMBER_NAV`：導覽是一份資料，這裡不再抄一次標題與說明。
 * 抄一次的話，改了選單名稱而忘了改卡片，兩個地方會對同一頁有兩種說法。
 */

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="border-brand-line bg-brand-paper rounded-lg border p-6">
      <p className="text-caption text-brand-muted">{label}</p>
      <p className="text-display-2 mt-2">{value}</p>
      <p className="text-caption text-brand-muted mt-1">{hint}</p>
    </div>
  );
}

export default async function AccountOverview() {
  const member = await requireMember("/account");

  const [sites, inquiries] = await Promise.all([listSavedSites(), listMyInquiries(member.userId)]);

  return (
    <>
      <h1 className="text-display-2">總覽</h1>
      <p className="text-body text-brand-muted mt-3">
        {member.displayName ? `${member.displayName}，` : ""}這裡是你在一頁起家累積的東西。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Stat label="存下來的網站" value={sites.length} hint="最多 20 份" />
        <Stat label="留過的需求" value={inquiries.length} hint="我們收到的詢問" />
      </div>

      {/*
       * 什麼都還沒有的時候，總覽不該是兩個 0 加一排選單。
       * 說一句「從哪裡開始」比較有用——這一頁的訪客多半是剛註冊完的人。
       */}
      {sites.length === 0 && inquiries.length === 0 ? (
        <div className="border-brand-line mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-body">還沒有東西。要不要先排一個網站看看？</p>
          <p className="text-body-sm text-brand-muted mt-3">
            排版與修改都是免費的，排好可以存下來，之後隨時接著改。
          </p>
          <Link
            href="/edit"
            className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-6 inline-flex px-6 py-3 font-bold"
          >
            開始排版
          </Link>
        </div>
      ) : null}

      <h2 className="text-heading-2 mt-12">你可以做的事</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {navItems(MEMBER_NAV)
          .filter((item) => item.href !== "/account")
          .map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
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
