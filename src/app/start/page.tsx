import type { Metadata } from "next";

import { Navbar } from "@/components/shared/navbar";
import { PUBLIC_NAV } from "@/config/nav";
import { SiteFooter } from "@/components/shared/site-footer";
import { absoluteUrl } from "@/config/site";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { readCmsDocument } from "@/features/cms/read";

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
  // 這一頁會帶著 ?ref= 之類的參數進來，canonical 一律指向乾淨的網址，
  // 否則搜尋引擎會把每一個來源各收錄成一頁。
  alternates: { canonical: absoluteUrl("/start") },
};

export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const params = await searchParams;
  const [adminEntry, accountEntry, intro] = await Promise.all([
    getAdminEntry(),
    getAccountEntry(),
    readCmsDocument("start.intro"),
  ]);

  // 從作品頁過來時帶著參考作品（Spec §30 Selected Portfolio Reference）。
  const raw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  // 網址上的東西是不可信輸入。只留 slug 的形狀，其餘丟掉——
  // 這個值會被顯示出來。
  const reference = typeof raw === "string" && /^[a-z0-9-]{1,64}$/.test(raw) ? raw : undefined;

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={[...PUBLIC_NAV]}
        cta={{ label: "回首頁", href: "/" }}
      />

      <main className="max-w-page px-gutter lg:px-gutter-lg mx-auto w-full py-16">
        <p className="text-kicker text-brand-accent-strong uppercase">{intro.section.kicker}</p>

        <h1 className="text-display-1 mt-3 max-w-[14em]">{intro.section.title}</h1>

        <p className="text-lead text-brand-muted mt-5 max-w-prose">{intro.section.lead}</p>

        <div className="mt-12 max-w-2xl">
          <ProjectBuilder reference={reference} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
