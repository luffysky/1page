import type { Metadata } from "next";

import { SaveBar } from "@/components/editor/save-bar";
import { SectionEditor } from "@/components/editor/section-editor";
import { Navbar, type NavLink } from "@/components/shared/navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { PreviewControls } from "@/components/website-preview/preview-controls";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { getAccountEntry } from "@/features/account/auth";
import { getAdminEntry } from "@/features/admin/auth";
import { SitePreviewProvider } from "@/features/website-engine/preview-context";
import { listTemplates } from "@/features/website-engine/templates";

/**
 * 網站編輯器（CR-003-4 / Spec §47）
 *
 * 定價 B：免費編輯，存檔／匯出才付費。所以這一頁對所有人開放，
 * 不需要登入——訪客排了十分鐘之後，「要留下來」才是付費的理由。
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

export default async function EditPage() {
  // 編輯器不綁 goal，四套版型都給——這裡的訪客是來排版的，不是來被推薦的
  const templates = listTemplates();
  const [adminEntry, accountEntry] = await Promise.all([getAdminEntry(), getAccountEntry()]);

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

        <SitePreviewProvider>
          <div className="mt-10 flex flex-col gap-6">
            <TemplatePicker templates={templates} />
            <PreviewControls />
            <SectionEditor />
            <SaveBar signedIn={accountEntry !== null} />
          </div>
        </SitePreviewProvider>
      </main>

      <SiteFooter />
    </>
  );
}
