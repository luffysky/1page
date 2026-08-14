import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SaveBar } from "@/components/editor/save-bar";
import { SectionEditor } from "@/components/editor/section-editor";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { PreviewControls } from "@/components/website-preview/preview-controls";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import type { StoredEditorState } from "@/features/website-engine/editor-state";
import { SitePreviewProvider } from "@/features/website-engine/preview-context";
import { loadSavedSite } from "@/features/website-engine/saved-sites";
import { listTemplates } from "@/features/website-engine/templates";

/**
 * 網站編輯器（CR-003-4 / Spec §47）
 *
 * 定價 B：免費編輯，存檔／匯出才付費。所以這一頁對所有人開放，
 * 不需要登入——訪客排了十分鐘之後，「要留下來」才是付費的理由。
 *
 * `?draft=<id>` 是從會員中心點「編輯」進來的：載回自己存過的那一份。
 * 沒有這條路的話，「存到我的帳號」就是一個只寫不讀的功能——
 * 存得進去，然後再也打不開。
 */

export const metadata: Metadata = {
  title: "編輯你的網站",
  description: "挑一套版型，然後把區塊排成你要的樣子。不用登入，也不用付費。",
};

const NAV_LINKS: NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "自己排版", href: "/edit" },
  { label: "開始一個專案", href: "/start" },
];

export default async function EditPage({ searchParams }: PageProps<"/edit">) {
  const params = await searchParams;
  const draftId = typeof params.draft === "string" ? params.draft : null;

  // 編輯器不綁 goal，四套版型都給——這裡的訪客是來排版的，不是來被推薦的
  const templates = listTemplates();
  const [adminEntry, accountEntry] = await Promise.all([getAdminEntry(), getAccountEntry()]);

  /*
   * 草稿是登入者的東西，未登入直接送去登入頁。
   *
   * 不這樣做的話 RLS 會回「找不到」，而使用者看到的是
   * 「你存的東西不見了」——那比「請先登入」嚇人得多。
   */
  if (draftId && !accountEntry) {
    redirect(`/login?next=${encodeURIComponent(`/edit?draft=${draftId}`)}`);
  }

  const loaded = draftId ? await loadSavedSite(draftId) : null;

  const initialState: StoredEditorState | undefined = loaded?.ok
    ? { ...loaded.draft, savedSiteId: draftId }
    : undefined;

  return (
    <>
      <Navbar
        adminEntry={adminEntry}
        accountEntry={accountEntry}
        links={NAV_LINKS}
        cta={{ label: "回首頁", href: "/" }}
      />

      <main className="mx-auto w-full max-w-page px-gutter py-14 lg:px-gutter-lg">
        <h1 className="text-heading-1">把區塊排成你要的樣子</h1>
        <p className="text-body text-brand-muted mt-3 max-w-prose">
          挑一套版型，選一塊，然後搬動它。滑鼠或鍵盤都可以。
          排好的東西會留著，不用登入也不用付費——要把它變成一個真的網站時再說。
        </p>

        {/*
         * 載入失敗要說出來。
         *
         * 安靜地退回空白編輯器的話，使用者會以為自己存的那份被清掉了，
         * 而且他接著排的東西一存檔就真的多出一份無關的草稿。
         */}
        {loaded && !loaded.ok ? (
          <p
            role="status"
            className="border-brand-line text-body-sm text-brand-accent-strong mt-6 rounded-md border p-4 font-bold"
          >
            {loaded.error}下面是一份全新的版型，跟你存過的那些無關。
          </p>
        ) : null}

        {loaded?.ok ? (
          <p role="status" className="text-body-sm text-brand-muted mt-6">
            正在編輯「<strong className="text-brand-ink">{loaded.name}</strong>
            」。按「更新這一份」會蓋掉它。
          </p>
        ) : null}

        <SitePreviewProvider initialState={initialState}>
          <div className="mt-10 flex flex-col gap-6">
            <TemplatePicker templates={templates} />
            <PreviewControls />
            <SectionEditor signedIn={accountEntry !== null} />
            <SaveBar
              signedIn={accountEntry !== null}
              savedName={loaded?.ok ? loaded.name : undefined}
            />
          </div>
        </SitePreviewProvider>
      </main>

      <SiteFooter />
    </>
  );
}
