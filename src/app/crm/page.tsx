import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CrmDesigner } from "@/components/crm/crm-designer";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { loadCrmDesign } from "@/features/crm-builder/store";

/**
 * 前台的 CRM 設計器（CR-003-5 / Spec §47）
 *
 * 定價與網站編輯器一致：**免費設計，存檔才要帳號**。
 * 所以這一頁對所有人開放——訪客設計了十分鐘之後，
 * 「要留下來」才是掏錢（現在是註冊）的理由。
 *
 * `?id=<uuid>` 是從「我的 CRM」點編輯進來的：載回自己存過的那一份。
 * 沒有這條路的話，「存到我的帳號」就是一個只寫不讀的功能——
 * 存得進去，然後再也打不開。那是這個專案已經犯過一次的錯
 * （saved_sites 的草稿載回，0814 才補上）。
 */

export const metadata: Metadata = {
  title: "設計你自己的 CRM",
  description: "要記哪些東西自己決定。不用登入，也不用付費。",
};

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "自己排版", href: "/edit" },
  { label: "設計 CRM", href: "/crm" },
  { label: "開始一個專案", href: "/start" },
];

export default async function CrmPage({ searchParams }: PageProps<"/crm">) {
  const params = await searchParams;
  const designId = typeof params.id === "string" ? params.id : null;

  const [adminEntry, accountEntry] = await Promise.all([getAdminEntry(), getAccountEntry()]);

  /*
   * 存下來的設計是登入者的東西，未登入直接送去登入頁。
   *
   * 不這樣做的話 RLS 會回「找不到」，而使用者看到的是
   * 「我存的東西不見了」——那比「請先登入」嚇人得多。
   */
  if (designId && !accountEntry) {
    redirect(`/login?next=${encodeURIComponent(`/crm?id=${designId}`)}`);
  }

  const loaded = designId ? await loadCrmDesign(designId) : null;

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={NAV_LINKS}
        cta={{ label: "回首頁", href: "/" }}
      />

      <main className="pt-10 pb-4">
        <div className="mx-auto w-full max-w-page px-gutter lg:px-gutter-lg">
          <h1 className="text-display-2">設計你自己的 CRM</h1>
          <p className="text-body text-brand-muted mt-3 max-w-prose">
            要分成幾類、每一類記哪些東西，你自己決定。設計不用登入， 存下來才要帳號。
          </p>

          {/*
           * ⚠️ 界線寫在畫面上，不是只寫在註解裡。
           *
           * 這裡設計的是一份表單的結構，不是一套會自己跑流程的系統。
           * 做一個看起來什麼都能設定、實際上只有六種欄位的畫布，
           * 比誠實說明更糟——前者要等使用者設計了半天才發現。
           */}
          <p className="border-brand-line text-caption text-brand-muted mt-5 max-w-prose rounded-lg border border-dashed p-4">
            這裡設計的是「要記哪些東西」。不會自動寄信、不會自己跑流程，
            欄位之間也不互相連動——需要那些的話，直接跟我們說你想完成什麼。
          </p>

          {loaded && !loaded.ok ? (
            <p role="alert" className="text-body-sm text-brand-accent-strong mt-5 font-bold">
              {loaded.error}
            </p>
          ) : null}
        </div>

        <div className="mt-10">
          <CrmDesigner
            signedIn={Boolean(accountEntry)}
            {...(loaded?.ok ? { initialDefinition: loaded.definition } : {})}
            {...(loaded?.ok && designId ? { initialSavedId: designId } : {})}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
