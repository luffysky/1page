import type { Metadata } from "next";

import { SiteFooter } from "@/components/shared/site-footer";
import { sanitizeNextPath } from "@/features/admin/safe-redirect";
import { readCmsDocument } from "@/features/cms/read";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "登入｜一頁起家",
  // 登入頁沒有理由出現在搜尋結果裡
  robots: { index: false, follow: false },
};

/**
 * 登入頁。
 *
 * 不放導覽列：導覽列會顯示後台入口，而後台入口只該在已驗證身分後出現。
 *
 * ⚠️ 這一頁的說明文字曾經寫著「此頁供工作人員使用」。
 * CR-002 之後那句話就不成立了——一般會員也從這裡進自己的後台，
 * 而一句過期的說明會讓真的想登入的人以為自己走錯地方。
 * 現在文案在 CMS 的 `login.intro`。
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // 淨化邏輯抽到 safe-redirect.ts 並有獨立測試涵蓋各種變形寫法
  // （//evil.com、/\evil.com、控制字元等）
  const next = sanitizeNextPath(params.next);
  const copy = await readCmsDocument("login.intro");

  return (
    <>
      <main className="mx-auto flex w-full max-w-page flex-col justify-center px-gutter py-section lg:px-gutter-lg">
        <div className="w-full max-w-[26rem]">
          <p className="text-kicker text-brand-accent-strong uppercase">{copy.kicker}</p>
          <h1 className="text-display-2 mt-3">{copy.title}</h1>
          <p className="text-body-sm text-brand-muted mt-4">{copy.lead}</p>

          <LoginForm next={next} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
