import type { Metadata } from "next";

import { validateSiteConfig } from "@/features/website-engine/schema";
import { SiteScope } from "@/features/website-engine/site-scope";
import { SiteRenderer } from "@/features/website-engine/site-renderer";
import { SITE_VARS } from "@/features/website-engine/theme";

export const metadata: Metadata = {
  title: "Theme Engine — /_dev",
};

/**
 * Theme Engine 的視覺驗證（3B Gate 第 5 項）。
 *
 * 這一頁要證明三件事，而且要用眼睛看得出來：
 *   1. 同一份標記在不同 theme 下呈現不同外觀
 *   2. 兩個 scope 並排時互不干擾
 *   3. **官網自己的品牌色完全不受影響**——這是最容易出錯也最難察覺的一項
 */

const BASE = {
  id: "preview",
  brand: { name: "示範品牌" },
  sections: [],
  settings: { language: "zh-Hant" },
};

const WARM = validateSiteConfig({
  ...BASE,
  theme: {
    colors: {
      background: "#f4e6d5",
      surface: "#fffaf3",
      text: "#2a211c",
      muted: "#8a7a6a",
      accent: "#b65d43",
    },
    typography: { heading: "Noto Serif TC", body: "Inter" },
    radius: "16px",
    spacingScale: "1rem",
  },
});

const LUXURY = validateSiteConfig({
  ...BASE,
  theme: {
    colors: {
      background: "#28231f",
      surface: "#332c27",
      text: "#f5eadc",
      muted: "#a89a8a",
      accent: "#b98b5c",
    },
    typography: { heading: "Noto Serif TC", body: "Inter" },
    radius: "4px",
    spacingScale: "1.25rem",
  },
});

/**
 * 示範用的區塊。
 *
 * 刻意只使用 `--site-*` 變數，完全不碰官網的 `--color-brand-*`——
 * 這正是 3C 的 Section 元件必須遵守的規則，此處先立範例。
 */
function ThemedCard({ title }: { title: string }) {
  return (
    <div
      className="p-6"
      style={{
        background: `var(${SITE_VARS.background})`,
        color: `var(${SITE_VARS.text})`,
        borderRadius: `var(${SITE_VARS.radius})`,
        fontFamily: `var(${SITE_VARS.fontBody})`,
      }}
    >
      <p
        className="text-caption"
        style={{ color: `var(${SITE_VARS.muted})`, letterSpacing: "0.1em" }}
      >
        {title}
      </p>

      <h3 className="text-heading-1 mt-2" style={{ fontFamily: `var(${SITE_VARS.fontHeading})` }}>
        讓空間替生活說話
      </h3>

      <div
        className="mt-4 p-4"
        style={{
          background: `var(${SITE_VARS.surface})`,
          borderRadius: `var(${SITE_VARS.radius})`,
        }}
      >
        <p className="text-body-sm">這一塊使用 surface 色，用來檢查層次是否分得出來。</p>
      </div>

      <span
        className="text-body-sm mt-4 inline-flex px-5 py-2.5 font-bold"
        style={{
          background: `var(${SITE_VARS.accent})`,
          color: `var(${SITE_VARS.background})`,
          borderRadius: `var(${SITE_VARS.radius})`,
        }}
      >
        預約諮詢
      </span>
    </div>
  );
}

/**
 * 走完整條 SiteRenderer 鏈路的示範設定。
 * 最後一個 section 的 type 刻意是尚未實作的 pricing——
 * 用來確認降級行為在真實渲染中也成立，而不只在單元測試裡。
 */
const DEMO = validateSiteConfig({
  ...BASE,
  theme: WARM.ok ? WARM.config.theme : undefined,
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "editorial",
      content: {
        eyebrow: "甜點品牌",
        title: "把今天的甜，留久一點。",
        subtitle: "手作甜點、季節風味與一點剛好的儀式感。",
        actions: [{ label: "看看今日甜點", href: "#menu" }],
      },
    },
    {
      id: "services",
      type: "services",
      variant: "list",
      content: {
        title: "我們提供",
        items: [
          { label: "季節限定", text: "依當季水果調整的甜點組合。" },
          { label: "訂製蛋糕", text: "生日與節慶的訂製設計。" },
          { label: "外燴甜點", text: "活動與婚禮的甜點桌。" },
        ],
      },
    },
    { id: "cta", type: "cta", variant: "banner", content: { title: "今天想吃點什麼甜的？" } },
    { id: "pricing", type: "pricing", variant: "table", content: { title: "方案" } },
  ],
});

export default function ThemePage() {
  if (!WARM.ok || !LUXURY.ok || !DEMO.ok) {
    return <p>示範主題未通過 schema 驗證：這本身就是錯誤，請檢查 schema。</p>;
  }

  return (
    <main className="mx-auto w-full max-w-page px-gutter py-16 lg:px-gutter-lg">
      <p className="text-kicker text-brand-accent-strong uppercase">Dev · Phase 3B</p>
      <h1 className="text-display-2 mt-3">Theme Engine</h1>
      <p className="text-lead text-brand-muted mt-5 max-w-prose">
        同一份標記、兩個 <code className="font-mono">[data-site-scope]</code>{" "}
        容器、兩份主題。下方「官網品牌色」區塊必須完全不受影響——那是這頁真正要看的東西。
      </p>

      <section className="mt-12">
        <h2 className="text-heading-1">兩個 scope 並排</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <SiteScope theme={WARM.config.theme}>
            <ThemedCard title="WARM" />
          </SiteScope>

          <SiteScope theme={LUXURY.config.theme}>
            <ThemedCard title="LUXURY" />
          </SiteScope>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-heading-1">巢狀 scope</h2>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
          內層應完全覆蓋外層，不會混出第三種顏色。
        </p>
        <div className="mt-6">
          <SiteScope theme={WARM.config.theme} className="p-6">
            <ThemedCard title="外層 WARM" />
            <div className="mt-4">
              <SiteScope theme={LUXURY.config.theme}>
                <ThemedCard title="內層 LUXURY" />
              </SiteScope>
            </div>
          </SiteScope>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-heading-1">SiteRenderer（3D）</h2>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
          同一份 SiteConfig 走完整條鏈路：驗證 → 主題 → Section 解析 → 元件。
          最後一個區塊是刻意寫錯的 type，應顯示佔位而非讓整頁崩潰。
        </p>
        <div className="border-brand-line mt-6 overflow-hidden rounded-lg border">
          <SiteRenderer config={DEMO.config} />
        </div>
      </section>

      <section className="mt-16" data-testid="brand-untouched">
        <h2 className="text-heading-1">官網品牌色（必須不受影響）</h2>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
          若上面的主題有滲漏到 <code className="font-mono">:root</code>，這裡會跟著變。
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "bg", className: "bg-brand-bg" },
            { label: "paper", className: "bg-brand-paper" },
            { label: "ink", className: "bg-brand-ink" },
            { label: "accent", className: "bg-brand-accent" },
            { label: "line", className: "bg-brand-line" },
          ].map((swatch) => (
            <li key={swatch.label}>
              <div className={`${swatch.className} border-brand-line h-16 rounded-lg border`} />
              <p className="text-caption text-brand-muted mt-2 font-mono">{swatch.label}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
