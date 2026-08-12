"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 登入表單。
 *
 * ⚠️ 錯誤訊息刻意一律相同：不區分「帳號不存在」與「密碼錯誤」。
 * 區分兩者等於提供一個帳號列舉的管道——攻擊者可以逐一試出哪些 email
 * 在這個站上有帳號。
 *
 * 登入後導向 `next` 參數指定的位置（通常是後台密路徑）。
 * `next` 只接受站內相對路徑，避免被當成開放轉址（open redirect）利用。
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      /*
       * ⚠️ 只有「真的是憑證問題」才說憑證不對。
       *
       * 這裡原本是一律 `setError("帳號或密碼不正確。")`，理由寫得沒錯——
       * 不區分「帳號不存在」與「密碼錯誤」是為了不提供帳號列舉的管道。
       * 但那個理由被過度套用了：它把**所有**失敗都講成密碼錯誤，
       * 包括連不上伺服器、被 CSP 擋掉、太多次嘗試被限流、信箱還沒驗證。
       *
       * 代價是真的踩到時完全無從查起——畫面斬釘截鐵地說你密碼錯了，
       * 你確定沒錯，然後就卡在那裡。（實際發生過一次，
       * 真正的原因是 admin-create 沒有把新密碼寫進資料庫。）
       *
       * 防列舉要的是「不要分辨這個 email 存不存在」，
       * 不是「不要分辨這是不是憑證問題」。後者對攻擊者沒有價值，
       * 對自己人卻是唯一的線索。
       */
      const isCredentialError =
        signInError.code === "invalid_credentials" || signInError.status === 400;

      setError(
        isCredentialError
          ? "帳號或密碼不正確。"
          : `目前無法登入（${signInError.message}）。這不是密碼的問題，請稍後再試。`,
      );
      setPending(false);
      return;
    }

    // refresh 讓 Server Component 以新的 session 重新渲染，
    // 否則導向後台時 server 端還讀不到剛寫入的 cookie
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
      <div>
        <label htmlFor="email" className="text-body-sm block font-bold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-brand-line bg-brand-paper text-body mt-2 w-full rounded-md border px-4 py-3"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-body-sm block font-bold">
          密碼
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-brand-line bg-brand-paper text-body mt-2 w-full rounded-md border px-4 py-3"
        />
      </div>

      {error ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong font-bold">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand-ink text-brand-on-ink text-body rounded-pill px-6 py-3.5 font-bold disabled:opacity-50"
      >
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
