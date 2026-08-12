import type { Metadata } from "next";
import Link from "next/link";

import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { getAccountEntry, requireMember } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { listSavedSites } from "@/features/website-engine/saved-sites";

import { removeSavedSite } from "../edit/actions";

import { signOut, updateDisplayName } from "./actions";

/**
 * 會員中心（Spec V1.3 §47 CR-002 / Phase M）
 *
 * ── 這裡是「我的帳號」，不是網站管理後台 ──────────────────────
 *
 * 兩個後台是分開的：
 *   /account            一般人的。路徑公開，任何登入者都進得來。
 *   ADMIN_SEGMENT 那條  員工的。路徑保密，非員工一律 404。
 *
 * 合成同一個的話，一般會員與站務管理會共用同一組頁面與權限判斷，
 * 而那正是 CR-002 明確決定不要的結構。
 */

export const metadata: Metadata = {
  title: "會員中心",
  // 帳號頁沒有任何對搜尋引擎有意義的內容，而且它是個人資料
  robots: { index: false, follow: false },
};

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "自己排版", href: "/edit" },
  { label: "開始一個專案", href: "/start" },
];

export default async function AccountPage() {
  const member = await requireMember("/account");
  const [adminEntry, accountEntry, savedSites] = await Promise.all([
    getAdminEntry(),
    getAccountEntry(),
    listSavedSites(),
  ]);

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={NAV_LINKS}
        cta={{ label: "回首頁", href: "/" }}
      />

      <main className="mx-auto w-full max-w-2xl px-gutter py-16 lg:px-gutter-lg">
        <h1 className="text-heading-1">會員中心</h1>
        <p className="text-body text-brand-muted mt-3">你的帳號資料。</p>

        <section className="border-brand-line mt-10 rounded-lg border p-6">
          <h2 className="text-heading-2">帳號</h2>

          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <dt className="text-body-sm text-brand-muted w-24">Email</dt>
              <dd className="text-body">{member.email ?? "（未設定）"}</dd>
            </div>
          </dl>

          {/*
           * Email 目前不開放自行修改。
           *
           * 改 email 要走驗證信（確認新信箱真的是本人的），
           * 而 SMTP 還沒設定——做一個按了會失敗的按鈕，
           * 比沒有那個按鈕更糟。等 SMTP 上線再補。
           */}
          <p className="text-caption text-brand-muted mt-4">
            要更換 Email 請從下方聯繫我們；自助更換需要驗證信，等信件服務設定完成後開放。
          </p>
        </section>

        <section className="border-brand-line mt-6 rounded-lg border p-6">
          <h2 className="text-heading-2">顯示名稱</h2>
          <p className="text-body-sm text-brand-muted mt-2">
            我們回覆你的詢問時會這樣稱呼你。留空就用 Email。
          </p>

          <form action={updateDisplayName} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="displayName" className="text-body-sm block font-bold">
                顯示名稱
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                maxLength={40}
                defaultValue={member.displayName ?? ""}
                className="border-brand-line bg-brand-paper text-body mt-2 w-full rounded-md border px-4 py-3"
              />
            </div>

            <button
              type="submit"
              className="bg-brand-ink text-brand-on-ink text-body rounded-pill px-6 py-3.5 font-bold"
            >
              儲存
            </button>
          </form>
        </section>

        {/*
         * 存下來的網站。
         *
         * 沒有這一段的話，「存到我的帳號」就是又一個
         * 「做好了但畫面上進不去」——存進資料庫，然後永遠找不到。
         */}
        <section className="border-brand-line mt-6 rounded-lg border p-6">
          <h2 className="text-heading-2">存下來的網站</h2>

          {savedSites.length === 0 ? (
            <p className="text-body-sm text-brand-muted mt-2">
              還沒有。到{" "}
              <Link href="/edit" className="underline">
                自己排版
              </Link>{" "}
              排一個，排好可以存下來。
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {savedSites.map((site) => (
                <li
                  key={site.id}
                  className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="text-body font-bold">{site.name}</p>
                    <p className="text-caption text-brand-muted mt-0.5">
                      最後更新 {new Date(site.updatedAt).toLocaleString("zh-TW")}
                    </p>
                  </div>

                  <form action={removeSavedSite}>
                    <input type="hidden" name="id" value={site.id} />
                    <button
                      type="submit"
                      className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
                    >
                      刪除
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-brand-line mt-6 rounded-lg border p-6">
          <h2 className="text-heading-2">登出</h2>
          <p className="text-body-sm text-brand-muted mt-2">
            登出後這台裝置就要重新輸入密碼才能進來。
          </p>

          <form action={signOut} className="mt-5">
            <button
              type="submit"
              className="border-brand-ink text-body rounded-pill border px-6 py-3.5 font-bold"
            >
              登出
            </button>
          </form>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
