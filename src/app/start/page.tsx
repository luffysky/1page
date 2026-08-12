import type { Metadata } from "next";

import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { getAdminEntry } from "@/features/admin/auth";

import { ProjectBuilder } from "./project-builder";

/**
 * Project Builder（Spec §30）
 *
 * Final CTA 後面的那一頁。首頁的「開始一個專案」與 Workshop Gate 的
 * CTA 都指到這裡。
 */
export const metadata: Metadata = {
  title: "開始一個專案｜一頁起家",
  description: "你不需要先知道怎麼做。只需要告訴我們，你想完成什麼。",
};

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "首頁", href: "/" },
];

export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const params = await searchParams;
  const adminEntry = await getAdminEntry();

  // 從作品頁過來時帶著參考作品（Spec §30 Selected Portfolio Reference）。
  const raw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  // 網址上的東西是不可信輸入。只留 slug 的形狀，其餘丟掉——
  // 這個值會被顯示出來。
  const reference = typeof raw === "string" && /^[a-z0-9-]{1,64}$/.test(raw) ? raw : undefined;

  return (
    <>
      <Navbar adminEntry={adminEntry} links={NAV_LINKS} cta={{ label: "回首頁", href: "/" }} />

      <main className="max-w-page px-gutter lg:px-gutter-lg mx-auto w-full py-16">
        <p className="text-kicker text-brand-accent-strong uppercase">Project Builder</p>

        <h1 className="text-display-1 mt-3 max-w-[14em]">
          你不需要
          <br />
          先知道怎麼做。
        </h1>

        <p className="text-lead text-brand-muted mt-5 max-w-prose">
          只需要告訴我們，你想完成什麼。空著的欄位不影響送出——
          我們寧可先接到一份不完整的需求，也不要你為了填完而放棄。
        </p>

        <div className="mt-12 max-w-2xl">
          <ProjectBuilder reference={reference} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
