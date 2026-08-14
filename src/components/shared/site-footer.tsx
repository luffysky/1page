import Link from "next/link";

/**
 * Footer（Spec §28 AI Disclosure）
 *
 * > AI-assisted · Human-reviewed
 *
 * 揭露不是免責聲明，是承諾：AI 是生產工具，正式交付仍經人工判斷與品質確認。
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-page px-gutter pt-10 pb-20 lg:px-gutter-lg">
      <div className="border-brand-line flex flex-wrap items-start justify-between gap-6 border-t pt-8">
        <div className="flex items-center gap-3">
          <span className="bg-brand-ink text-brand-on-ink grid h-10 w-10 place-items-center rounded-md text-xl font-black">
            1
          </span>
          <span className="text-heading-2">一頁起家</span>
        </div>

        <p className="text-body-sm text-brand-muted max-w-prose">
          AI-assisted · Human-reviewed
          <br />
          我們會合理使用 AI 協助研究、內容整理、設計探索與程式開發。AI
          是生產工具，正式交付成果仍經人工判斷、測試與品質確認。
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
          © {new Date().getFullYear()} SnowRealm 斯諾瑞姆企業社
          <span className="mx-2">·</span>
          一頁起家
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
