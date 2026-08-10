import type { Metadata } from "next";

import { SiteFooter } from "@/components/shared/site-footer";
import { sanitizeNextPath } from "@/features/admin/safe-redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "登入｜一頁起家",
  // 登入頁沒有理由出現在搜尋結果裡
  robots: { index: false, follow: false },
};

/**
 * 登入頁。
 *
 * 這是一個只有工作人員會用到的頁面，因此不放導覽列——
 * 導覽列會顯示後台入口，而後台入口只該在已驗證身分後出現。
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // 淨化邏輯抽到 safe-redirect.ts 並有獨立測試涵蓋各種變形寫法
  // （//evil.com、/\evil.com、控制字元等）
  const next = sanitizeNextPath(params.next);

  return (
    <>
      <main className="mx-auto flex w-full max-w-page flex-col justify-center px-gutter py-section lg:px-gutter-lg">
        <div className="w-full max-w-[26rem]">
          <p className="text-kicker text-brand-accent-strong uppercase">一頁起家</p>
          <h1 className="text-display-2 mt-3">登入</h1>
          <p className="text-body-sm text-brand-muted mt-4">此頁供工作人員使用。</p>

          <LoginForm next={next} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
