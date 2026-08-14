"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import type { NavGroup } from "@/features/dashboard/nav";

/**
 * 兩個 dashboard 共用的外殼（CR-004 / Phase B BA）
 *
 * ── 共用長相，不共用授權 ──────────────────────────────────────
 *
 * ⚠️ 這個元件**不做任何權限判斷**，也不知道使用者是誰。
 * 它只收「導覽資料 + 內容」。
 *
 * CR-002 決定兩個後台要分開，而共用外殼最容易滑向共用權限判斷——
 * 一旦外殼開始問「這個人是員工嗎」，兩邊的判斷就會纏在一起。
 * 判斷留在各自的 layout（`requireMember()` / `requireAdmin()`）：
 * 外殼不知道使用者是誰，就不可能把兩邊搞混。
 *
 * 參考專案兩次踩到「同一個字兩個意思」（ai_island 的 CLAUDE.md 特地
 * 寫了一段警告，SnowRealmSpace 又重複一次）。所以這裡連命名都分開：
 * 員工是 `admin_users.role`，會員沒有角色。
 *
 * ── 手機是抽屜，桌機是固定側欄 ────────────────────────────────
 *
 * 側欄在手機上直接顯示的話會把內容擠到看不見；用 CSS 藏起來則會留下
 * 一整排「看不見但 Tab 得到」的連結——那是表單區塊踩過的坑
 * （readOnly input 仍然吃 Tab）。所以關閉時整個不進 DOM。
 */

export interface DashboardShellProps {
  /** 左上角的標題，例如「我的帳號」或「後台」 */
  brand: string;
  /** 導覽資料。href 已經是最終網址（後台的密路徑在伺服器端換好） */
  nav: NavGroup[];
  /** 右上角顯示的身分資訊。外殼只負責畫，不解讀 */
  identity?: React.ReactNode;
  /** 登出表單由各自的區域提供——兩邊的 session 不是同一套東西 */
  signOut?: React.ReactNode;
  children: React.ReactNode;
}

function NavList({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {nav.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title ? (
            <p className="text-caption text-brand-muted px-3 font-bold tracking-wider uppercase">
              {group.title}
            </p>
          ) : null}

          <ul className="mt-2 flex flex-col gap-1">
            {group.items.map((item) => {
              /*
               * 「目前在哪一頁」用完全相符，不是 startsWith。
               *
               * startsWith 會讓 /account 在每一個子頁面都亮著，
               * 而使用者靠那個亮起來的項目判斷自己在哪裡。
               */
              const current = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`text-body-sm block rounded-md px-3 py-2 ${
                      current
                        ? "bg-brand-ink text-brand-on-ink font-bold"
                        : "text-brand-muted hover:text-brand-ink hover:bg-brand-paper"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DashboardShell({ brand, nav, identity, signOut, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  /*
   * 換頁就把抽屜關掉。
   *
   * 不關的話，點了一個項目之後抽屜還蓋在新頁面上——使用者以為沒反應，
   * 又點一次同一個連結。
   *
   * ⚠️ 在 render 期間比對，不是 useEffect。
   *
   * `useEffect(() => setDrawerOpen(false), [pathname])` 會多一次 paint
   * （抽屜先出現在新頁面上再消失），而且 React 的 lint 規則直接把它
   * 列為錯誤。這是這個專案裡已經用過的同一招——見 portfolio-filter：
   * 「在 render 期間由 props 校正 state，比 useEffect 少一次多餘 paint」。
   *
   * 光靠連結上的 onClick 不夠：上一頁／下一頁不會經過那個 onClick。
   */
  const [syncedPath, setSyncedPath] = useState(pathname);
  if (syncedPath !== pathname) {
    setSyncedPath(pathname);
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-screen">
      <header className="border-brand-line bg-brand-paper sticky top-0 z-20 border-b">
        <div className="mx-auto flex w-full max-w-page items-center justify-between gap-4 px-gutter py-3 lg:px-gutter-lg">
          <div className="flex items-center gap-3">
            {/*
             * 抽屜按鈕只在窄螢幕出現。
             * `lg:hidden` 用的是 display，不是 visibility——
             * 隱藏但仍在 Tab 順序上的按鈕會讓鍵盤使用者撞到一顆按不到的東西。
             */}
            <button
              type="button"
              onClick={() => setDrawerOpen((open) => !open)}
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              className="border-brand-line text-body-sm rounded-md border px-3 py-2 lg:hidden"
            >
              {drawerOpen ? "關閉選單" : "選單"}
            </button>

            <span className="text-heading-2">{brand}</span>
          </div>

          <div className="text-caption text-brand-muted flex items-center gap-4">
            {identity}
            <Link href="/" className="hover:text-brand-ink underline underline-offset-4">
              回到網站
            </Link>
            {signOut}
          </div>
        </div>

        {/*
         * 手機抽屜：關閉時整個不進 DOM。
         * 用 CSS 藏起來的話，鍵盤使用者會在看不見的情況下 Tab 進一整排連結。
         */}
        {drawerOpen ? (
          <nav
            id={drawerId}
            aria-label={`${brand}導覽`}
            className="border-brand-line mx-auto w-full max-w-page border-t px-gutter py-4 lg:hidden lg:px-gutter-lg"
          >
            <NavList nav={nav} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </nav>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-page gap-8 px-gutter py-8 lg:px-gutter-lg">
        <nav
          aria-label={`${brand}側邊導覽`}
          className="hidden w-56 shrink-0 lg:sticky lg:top-24 lg:block lg:self-start"
        >
          <NavList nav={nav} pathname={pathname} />
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
