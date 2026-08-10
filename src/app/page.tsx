/**
 * Phase 1A 的首頁為佔位頁。
 *
 * 真正的首頁組裝在 1D（Implementation Plan §7），
 * 需要 1B 的 Home Goal Context 與 1C 的 Layout Primitives 先就位。
 * 這裡刻意不提前實作任何 Section，以免走回「先做得像、之後再重寫」的老路。
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-page px-gutter py-section lg:px-gutter-lg">
      <p className="text-kicker text-brand-accent uppercase">Phase 1A</p>
      <h1 className="text-display-1 mt-5">從第一頁，開始你的生意。</h1>
      <p className="text-lead text-brand-muted mt-6 max-w-prose">
        本頁為 Phase 1A 佔位頁。Design Token 系統已建立，首頁組裝於 1D 進行。
      </p>
      {process.env.NODE_ENV === "development" ? (
        <p className="text-body-sm text-brand-muted mt-10">
          開發工具：
          <a className="text-brand-ink underline underline-offset-4" href="/_dev/tokens">
            /_dev/tokens
          </a>
        </p>
      ) : null}
    </main>
  );
}
