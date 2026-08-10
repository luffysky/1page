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
       * 工作人員入口放頁尾而非主選單，是刻意的。
       *
       * 這個站沒有一般使用者帳號（Spec §37 訪客全程匿名、§40 非目標明列
       * Client Portal）。主選單出現「登入」會讓訪客以為需要註冊才能用，
       * 那正好違反 Spec §0 funnel「降低第一步門檻」的目的。
       *
       * 頁尾是放這類連結的慣例位置：訪客不會注意，工作人員找得到，
       * 而且不必背網址。密路徑仍然沒有出現在任何地方。
       */}
      <p className="text-caption text-brand-muted mt-8 text-right">
        <Link href="/login" className="hover:text-brand-ink underline underline-offset-4">
          工作人員登入
        </Link>
      </p>
    </footer>
  );
}
