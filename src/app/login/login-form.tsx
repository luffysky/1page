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
      setError("帳號或密碼不正確。");
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
