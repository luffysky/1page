import { requireMember } from "@/features/account/auth";

import { signOut, updateDisplayName } from "../actions";

/**
 * 帳號設定（CR-004 / Phase B BB）
 */

export default async function AccountSettingsPage() {
  const member = await requireMember("/account/settings");

  return (
    <>
      <h1 className="text-display-2">帳號設定</h1>

      <section className="border-brand-line mt-8 rounded-lg border p-6">
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
         * 改 email 要走驗證信（確認新信箱真的是本人的），而 SMTP 還沒設定——
         * 做一個按了會失敗的按鈕，比沒有那個按鈕更糟。等 SMTP 上線再補。
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
    </>
  );
}
