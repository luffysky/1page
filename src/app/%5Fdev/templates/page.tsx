import type { Metadata } from "next";

import type { SiteConfig } from "@/features/website-engine/schema";
import { SiteRenderer } from "@/features/website-engine/site-renderer";
import {
  ACCENT_IDS,
  ACCENT_LABELS,
  type AccentId,
  buildSiteConfig,
  draftFromTemplate,
  getTemplate,
  TEMPLATES,
  THEME_PRESETS,
  type ThemeId,
} from "@/features/website-engine/templates";

export const metadata: Metadata = {
  title: "Templates — /_dev",
};

/**
 * Template Registry 的視覺驗證（4A Gate 第 5 項）。
 *
 * 4A 交付的全是資料，首頁要到 4B 才會用到它。沒有這一頁，
 * 「模板長什麼樣子」就得等整合完才第一次被看見——
 * 而那時要改的話，改的是已經接好線的東西。
 *
 * 這一頁也是唯一能一次看到全部 12 組主題配色的地方：
 * 首頁的 axe 掃描只掃得到當下顯示的那一組。
 * （對比度由 `templates.test.ts` 實算，這裡是給眼睛看的那一半。）
 *
 * 刻意全靜態、沒有任何互動控制項——切換是 4B/4C 的事，
 * 這裡若先做一套會變成第二份實作。
 */
/**
 * 只取 hero 與 cta：這兩塊同時用到 accent 的兩種用途
 * （eyebrow 文字、按鈕底色），是對比度最容易出事的地方。
 * 全組合有 12 格，每格都放完整模板的話這一頁會長到沒人看得完。
 */
function accentProbe(templateId: string, themeId: ThemeId, accentId: AccentId): SiteConfig {
  const template = getTemplate(templateId)!;
  const config = buildSiteConfig({ ...draftFromTemplate(template), themeId, accentId });

  return {
    ...config,
    sections: config.sections.filter((section) => ["hero", "cta"].includes(section.id)),
  };
}

export default function TemplatesPage() {
  const [showcase] = TEMPLATES;

  return (
    <main className="max-w-page px-gutter lg:px-gutter-lg mx-auto w-full py-16">
      <p className="text-kicker text-brand-accent-strong uppercase">Dev · Phase 4A</p>
      <h1 className="text-display-2 mt-3">Templates</h1>
      <p className="text-lead text-brand-muted mt-5 max-w-prose">
        {TEMPLATES.length} 套模板、{THEME_PRESETS.length} 組主題、{ACCENT_IDS.length} 個 accent。
        全部經由同一個 <code className="font-mono">SiteRenderer</code>，與首頁 Preview
        走的是同一條路徑（Spec §11）。
      </p>

      <section className="mt-14">
        <h2 className="text-heading-1">各模板的預設樣貌</h2>
        <div className="mt-6 space-y-12">
          {TEMPLATES.map((template) => (
            <article key={template.id}>
              <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="text-heading-2">{template.name}</h3>
                <p className="text-caption text-brand-muted font-mono">
                  {template.id}｜{template.category.join(", ")}｜{template.sections.length} sections
                </p>
              </header>
              <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
                {template.description}
              </p>

              <div className="border-brand-line mt-4 overflow-hidden rounded-lg border">
                <SiteRenderer config={buildSiteConfig(draftFromTemplate(template))} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-heading-1">主題 × Accent 全組合</h2>
        <p className="text-body-sm text-brand-muted mt-2 max-w-prose">
          同一套模板（{showcase!.name}）套上每一種組合。要看的是每一格的文字是否都讀得清楚——
          深色主題的 accent 與淺色主題的 accent 是不同色值，理由見 themes.ts。
        </p>

        <div className="mt-6 space-y-10">
          {THEME_PRESETS.map((preset) => (
            <div key={preset.id}>
              <h3 className="text-heading-2">
                {preset.label}
                <span className="text-caption text-brand-muted ml-3 font-mono">{preset.id}</span>
              </h3>
              <p className="text-body-sm text-brand-muted mt-1">{preset.description}</p>

              {/* 兩欄而非四欄：每格要夠寬才看得出 accent 在真實版面裡的樣子 */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {ACCENT_IDS.map((accentId) => (
                  <div key={accentId}>
                    <p className="text-caption text-brand-muted mb-2 font-mono">
                      {ACCENT_LABELS[accentId]}／{accentId}
                    </p>
                    <div className="border-brand-line overflow-hidden rounded-lg border">
                      <SiteRenderer config={accentProbe(showcase!.id, preset.id, accentId)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
