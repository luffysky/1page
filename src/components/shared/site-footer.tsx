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
    </footer>
  );
}
