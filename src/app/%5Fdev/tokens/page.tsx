import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Tokens — /_dev",
};

/**
 * Token 樣本頁 — Gate 第 5 項 visual review 的固定靶（Plan §4）。
 *
 * 此頁刻意不顯示任何 hex 色碼，只顯示 token 名稱與 utility class：
 * 使用端應該引用 token 名稱，需要數值時去看 src/styles/tokens.css。
 */

const COLORS: { token: string; utility: string; swatch: string; note: string }[] = [
  { token: "--color-brand-bg", utility: "bg-brand-bg", swatch: "bg-brand-bg", note: "頁面底色" },
  {
    token: "--color-brand-paper",
    utility: "bg-brand-paper",
    swatch: "bg-brand-paper",
    note: "卡片／浮起表面",
  },
  {
    token: "--color-brand-cream",
    utility: "bg-brand-cream",
    swatch: "bg-brand-cream",
    note: "次要區塊底色",
  },
  {
    token: "--color-brand-ink",
    utility: "bg-brand-ink",
    swatch: "bg-brand-ink",
    note: "主文字／深色區塊",
  },
  {
    token: "--color-brand-muted",
    utility: "text-brand-muted",
    swatch: "bg-brand-muted",
    note: "次要文字",
  },
  {
    token: "--color-brand-line",
    utility: "border-brand-line",
    swatch: "bg-brand-line",
    note: "分隔線／邊框",
  },
  {
    token: "--color-brand-accent",
    utility: "bg-brand-accent",
    swatch: "bg-brand-accent",
    note: "Rocket Red",
  },
  {
    token: "--color-brand-accent-soft",
    utility: "bg-brand-accent-soft",
    swatch: "bg-brand-accent-soft",
    note: "hover／漸層端點",
  },
  {
    token: "--color-brand-focus",
    utility: "outline-brand-focus",
    swatch: "bg-brand-focus",
    note: "Focus ring",
  },
];

/**
 * `font` 欄位不是裝飾——樣本必須以該字級「實際使用的字族」呈現，
 * 否則樣本頁會謊報：display-* 若以內文黑體呈現，就看不出宋體標題的真實樣貌。
 */
const TYPE_SCALE: { token: string; utility: string; font: string; note: string }[] = [
  {
    token: "--text-display-1",
    utility: "text-display-1",
    font: "font-display",
    note: "Hero H1 — 桌機 72–112px",
  },
  {
    token: "--text-display-2",
    utility: "text-display-2",
    font: "font-display",
    note: "Section H2 — 36–60px",
  },
  { token: "--text-heading-1", utility: "text-heading-1", font: "font-display", note: "H3" },
  {
    token: "--text-heading-2",
    utility: "text-heading-2",
    font: "font-display",
    note: "H4／卡片標題",
  },
  { token: "--text-lead", utility: "text-lead", font: "font-sans", note: "Hero 副標／導言" },
  { token: "--text-body", utility: "text-body", font: "font-sans", note: "內文" },
  { token: "--text-body-sm", utility: "text-body-sm", font: "font-sans", note: "次要內文" },
  { token: "--text-caption", utility: "text-caption", font: "font-sans", note: "註解" },
  {
    token: "--text-kicker",
    utility: "text-kicker",
    font: "font-sans",
    note: "Section 標籤（大寫字距）",
  },
];

const SPACING: { token: string; utility: string; width: string }[] = [
  { token: "--spacing-gutter", utility: "px-gutter", width: "w-gutter" },
  { token: "--spacing-gutter-lg", utility: "px-gutter-lg", width: "w-gutter-lg" },
  { token: "--spacing-section", utility: "py-section", width: "w-section" },
  { token: "--spacing-section-lg", utility: "py-section-lg", width: "w-section-lg" },
];

const RADII: { token: string; utility: string; box: string }[] = [
  { token: "--radius-sm", utility: "rounded-sm", box: "rounded-sm" },
  { token: "--radius-md", utility: "rounded-md", box: "rounded-md" },
  { token: "--radius-lg", utility: "rounded-lg", box: "rounded-lg" },
  { token: "--radius-xl", utility: "rounded-xl", box: "rounded-xl" },
  { token: "--radius-2xl", utility: "rounded-2xl", box: "rounded-2xl" },
  { token: "--radius-pill", utility: "rounded-pill", box: "rounded-pill" },
];

const SHADOWS: { token: string; utility: string; box: string }[] = [
  { token: "--shadow-soft", utility: "shadow-soft", box: "shadow-soft" },
  { token: "--shadow-lifted", utility: "shadow-lifted", box: "shadow-lifted" },
];

const BREAKPOINTS: { token: string; utility: string; px: string }[] = [
  { token: "--breakpoint-sm", utility: "sm:", px: "430px — 大尺寸手機" },
  { token: "--breakpoint-md", utility: "md:", px: "768px — 平板" },
  { token: "--breakpoint-lg", utility: "lg:", px: "1024px — 小筆電" },
  { token: "--breakpoint-xl", utility: "xl:", px: "1280px — 桌機" },
  { token: "--breakpoint-2xl", utility: "2xl:", px: "1440px — 大桌機" },
  { token: "--breakpoint-3xl", utility: "3xl:", px: "1920px — 寬螢幕" },
];

const MOTION: { token: string; utility: string; ease: string }[] = [
  { token: "--ease-brand", utility: "ease-brand", ease: "ease-brand" },
  { token: "--ease-brand-out", utility: "ease-brand-out", ease: "ease-brand-out" },
];

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-brand-line border-t pt-8 pb-16">
      <p className="text-kicker text-brand-accent uppercase">{index}</p>
      <h2 className="text-heading-1 mt-2 mb-8">{title}</h2>
      {children}
    </section>
  );
}

function TokenName({ children }: { children: React.ReactNode }) {
  return <code className="text-caption text-brand-ink font-mono">{children}</code>;
}

export default function TokensPage() {
  return (
    <main className="mx-auto w-full max-w-page px-gutter py-16 lg:px-gutter-lg">
      <header className="pb-12">
        <p className="text-kicker text-brand-accent uppercase">Dev · Phase 1A</p>
        <h1 className="text-display-2 mt-3">Design Tokens</h1>
        <p className="text-lead text-brand-muted mt-5 max-w-prose">
          全站唯一設計數值來源為 <TokenName>src/styles/tokens.css</TokenName>。 此頁只呈現 token
          名稱與對應 utility，不顯示數值——使用端應引用名稱，而非複製色碼。
        </p>
      </header>

      <Section index="01" title="Color">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {COLORS.map((c) => (
            <li
              key={c.token}
              className="border-brand-line bg-brand-paper overflow-hidden rounded-lg border"
            >
              <div className={`${c.swatch} h-20 w-full`} />
              <div className="p-4">
                <TokenName>{c.token}</TokenName>
                <p className="text-caption text-brand-muted mt-2">{c.note}</p>
                <p className="text-caption text-brand-muted mt-1 font-mono">{c.utility}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="02" title="Typography">
        <p className="text-body-sm text-brand-muted mb-8 max-w-prose">
          標題採思源宋體（<TokenName>--font-display</TokenName>），內文與功能性文字採黑體（
          <TokenName>--font-sans</TokenName>）。Agent 對話、表單、價格一律使用黑體。
        </p>
        <ul className="space-y-10">
          {TYPE_SCALE.map((t) => (
            <li key={t.token} className="border-brand-line border-b pb-8">
              <div className="text-caption text-brand-muted mb-3 flex flex-wrap gap-x-4 gap-y-1">
                <TokenName>{t.token}</TokenName>
                <span className="font-mono">{t.utility}</span>
                <span className="font-mono">{t.font}</span>
                <span>{t.note}</span>
              </div>
              <p className={`${t.font} ${t.utility}`}>從第一頁，開始你的生意 Aa Bb 0123</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="03" title="Spacing">
        <ul className="space-y-5">
          {SPACING.map((s) => (
            <li key={s.token}>
              <div className="text-caption text-brand-muted mb-2 flex gap-4">
                <TokenName>{s.token}</TokenName>
                <span className="font-mono">{s.utility}</span>
              </div>
              <div className={`${s.width} bg-brand-accent h-3 rounded-pill`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section index="04" title="Radius">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {RADII.map((r) => (
            <li key={r.token}>
              <div className={`${r.box} border-brand-line bg-brand-paper h-24 w-full border`} />
              <p className="mt-3">
                <TokenName>{r.token}</TokenName>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="05" title="Shadow">
        <ul className="grid gap-8 md:grid-cols-2">
          {SHADOWS.map((s) => (
            <li key={s.token}>
              <div className={`${s.box} bg-brand-paper h-28 w-full rounded-xl`} />
              <p className="mt-4">
                <TokenName>{s.token}</TokenName>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="06" title="Container">
        <div className="space-y-4">
          <div>
            <TokenName>--container-page</TokenName>
            <div className="bg-brand-ink mt-2 h-3 w-full max-w-page rounded-pill" />
          </div>
          <div>
            <TokenName>--container-prose</TokenName>
            <div className="bg-brand-muted mt-2 h-3 w-full max-w-prose rounded-pill" />
          </div>
        </div>
      </Section>

      <Section index="07" title="Breakpoint">
        <p className="text-body-sm text-brand-muted mb-6 max-w-prose">
          Spec §34 要求驗證 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920。 375 與 390
          低於最小斷點，落在 base 樣式。
        </p>
        <ul className="border-brand-line divide-brand-line divide-y rounded-lg border">
          {BREAKPOINTS.map((b) => (
            <li key={b.token} className="text-body-sm flex flex-wrap gap-x-6 gap-y-1 p-4">
              <TokenName>{b.token}</TokenName>
              <span className="font-mono">{b.utility}</span>
              <span className="text-brand-muted">{b.px}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="08" title="Motion">
        <p className="text-body-sm text-brand-muted mb-6 max-w-prose">
          滑鼠移入下方色塊可看到緩動差異。全站已套用 <TokenName>prefers-reduced-motion</TokenName>
          覆寫，開啟系統減少動態後此處不會有動畫。
        </p>
        <ul className="space-y-6">
          {MOTION.map((m) => (
            <li key={m.token}>
              <div className="text-caption text-brand-muted mb-2 flex gap-4">
                <TokenName>{m.token}</TokenName>
                <span className="font-mono">{m.utility}</span>
              </div>
              <div className="border-brand-line bg-brand-paper rounded-lg border p-3">
                <div
                  className={`${m.ease} bg-brand-accent h-8 w-16 rounded-md transition-all duration-500 hover:w-full`}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="text-body-sm text-brand-muted mt-8 space-y-1">
          <p>
            <TokenName>--duration-fast</TokenName> / <TokenName>--duration-base</TokenName> /{" "}
            <TokenName>--duration-slow</TokenName>
          </p>
        </div>
      </Section>

      <footer className="border-brand-line text-caption text-brand-muted border-t pt-8">
        <p>
          此路由僅存在於開發環境。Production 直接 404，且排除於 sitemap、robots 與 analytics
          之外（Plan §11 C.1）。
        </p>
      </footer>
    </main>
  );
}
