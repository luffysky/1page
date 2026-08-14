import Link from "next/link";

import { readCmsDocument } from "@/features/cms/read";

/**
 * Footer（Spec §28 AI Disclosure）
 *
 * > AI-assisted · Human-reviewed
 *
 * 揭露不是免責聲明，是承諾：AI 是生產工具，正式交付仍經人工判斷與品質確認。
 *
 * ── 為什麼自己讀 CMS，而不是由呼叫端傳進來 ────────────────────
 *
 * 頁尾出現在六個頁面上。改成收 props 的話，那六個頁面每一個都要
 * 記得讀一次再傳進來——而**忘記傳的那一頁不會報錯**，它只是繼續
 * 顯示舊的字。那正是這個專案一直在避開的壞法。
 *
 * 這個元件是 server component，讀取端有快取，所以自己讀的代價
 * 就只是多一次快取命中。
 */
export async function SiteFooter() {
  const footer = await readCmsDocument("shared.footer");

  return (
    <footer className="mx-auto w-full max-w-page px-gutter pt-10 pb-20 lg:px-gutter-lg">
      <div className="border-brand-line flex flex-wrap items-start justify-between gap-6 border-t pt-8">
        <div className="flex items-center gap-3">
          <span className="bg-brand-ink text-brand-on-ink grid h-10 w-10 place-items-center rounded-md text-xl font-black">
            1
          </span>
          <span className="text-heading-2">{footer.wordmark}</span>
        </div>

        <p className="text-body-sm text-brand-muted max-w-prose">
          AI-assisted · Human-reviewed
          <br />
          {footer.disclosure}
        </p>
      </div>

      {/*
       * 版權歸屬 SnowRealm。
       *
       * 一頁起家是斯諾瑞姆企業社（SnowRealm）旗下的產品，不是一個獨立品牌——
       * 這一行是它與其他 SnowRealm 產品之間唯一的可見連結，
       * 也是訪客判斷「這是誰做的」時會看的地方。
       *
       * 年份用當下的年，不寫死：寫死的版權年會在跨年的那一天過期，
       * 而那是一種「看起來沒人在維護」的訊號。
       */}
      <div className="text-caption text-brand-muted mt-8 flex flex-wrap items-center justify-between gap-3">
        <p>
          © {new Date().getFullYear()} {footer.copyright}
          <span className="mx-2">·</span>
          {footer.wordmark}
        </p>

        {/*
         * 工作人員入口放頁尾而非主選單，是刻意的。
         *
         * ⚠️ 原本的理由是「這個站沒有一般使用者帳號」——CR-002 之後那句話
         * 不成立了：現在有會員，導覽列上也有「登入／會員中心」。
         *
         * 但這條連結仍然留著，理由換了：它連到的是**同一個** /login，
         * 而工作人員的習慣是從頁尾進去。多一個入口不會洩漏密路徑
         * （密路徑從來不出現在任何地方），少一個則要靠人背網址。
         */}
        <Link href="/login" className="hover:text-brand-ink underline underline-offset-4">
          工作人員登入
        </Link>
      </div>
    </footer>
  );
}
