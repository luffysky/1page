import { Fragment } from "react";

import { resolveSection, UnknownSection } from "./registry";
import { type SiteConfig, type SiteSection, validateSiteConfig } from "./schema";
import { SiteScope } from "./site-scope";

/**
 * SiteRenderer（Spec §11）
 *
 * > 唯一正式 Rendering 入口。
 * > Preview 與正式 Template Website 必須共用 renderer。
 *
 * 流程（Spec §11）：
 *   SiteConfig → Schema Validation → Theme Resolver → Section Resolver
 *   → Section Components → Rendered Website
 *
 * ── 為什麼是「唯一」入口 ──────────────────────────────────────
 *
 * 如果 Preview 與正式網站各有一套渲染路徑，兩者遲早會分歧——
 * 而分歧的表現是「預覽看起來對，上線後不一樣」，那是最傷信任的一種 bug。
 * 訪客在 Preview 看到什麼，正式網站就必須是什麼。
 *
 * 這也是 Spec §36「禁止 arbitrary HTML / JS」得以成立的前提：
 * 只有一條路徑，才有可能保證那條路徑上沒有 `dangerouslySetInnerHTML`。
 */

export interface SiteRendererProps {
  /**
   * 已驗證的設定。
   *
   * 型別上要求 `SiteConfig`（3A 的 z.infer），代表呼叫端應該先過 schema。
   * 但 renderer 仍會再驗一次——見下方說明。
   */
  config: SiteConfig;
  className?: string;
  /**
   * 在每一塊外面包一層（CR-003-4 的編輯器用）。
   *
   * 不給就照常渲染，所以首頁與 Agent 預覽完全不受影響——
   * 它們與編輯器共用的仍然是同一條渲染路徑（Spec §11）。
   */
  wrapSection?: (section: SiteSection, index: number, rendered: React.ReactNode) => React.ReactNode;
}

/**
 * 渲染已驗證的設定。
 *
 * ⚠️ 這裡刻意**再驗一次** schema，即使型別已經是 SiteConfig。
 *
 * 理由：TypeScript 的型別只在編譯期存在。設定會經過 JSON 序列化
 * （Server → Client、資料庫、Agent 的 tool call 回傳），
 * 而那些邊界都可能讓一個「型別上是 SiteConfig」的值實際上不是。
 * 渲染是最後一站，這裡漏掉就直接進到使用者的瀏覽器。
 */
export function SiteRenderer({ config, className, wrapSection }: SiteRendererProps) {
  const validated = validateSiteConfig(config);

  if (!validated.ok) {
    return <RenderError errors={validated.errors} className={className} />;
  }

  const site = validated.config;

  return (
    <SiteScope theme={site.theme} className={className}>
      {site.sections.length === 0 ? (
        <EmptySite />
      ) : (
        site.sections.map((section, index) => {
          const resolved = resolveSection(section);

          // 未知的 type：顯示可辨識的佔位，不中斷其餘區塊的渲染
          const rendered = resolved ? (
            <resolved.component section={section} />
          ) : (
            <UnknownSection section={section} />
          );

          /*
           * 編輯器用 wrapSection 在每一塊外面包一層 widget 外框（CR-003-4）。
           *
           * 為什麼是加一個 prop，而不是讓編輯器自己 map 一次 sections：
           * Spec §11 規定 SiteRenderer 是唯一的正式渲染入口。編輯器自己 map
           * 就會複製一份 validate + resolve + 降級的邏輯，
           * 而那份複製品遲早與這裡分歧——分歧的表現是「編輯器裡好好的，
           * 存出去卻不一樣」，那是最難查的一種。
           */
          return (
            <Fragment key={section.id}>
              {wrapSection ? wrapSection(section, index, rendered) : rendered}
            </Fragment>
          );
        })
      )}
    </SiteScope>
  );
}

/**
 * 設定無效時的呈現。
 *
 * 不拋例外：拋例外會讓 React error boundary 吃掉整棵樹，
 * 使用者看到的是整片白。Spec §36 要求「明確錯誤而非崩潰」。
 *
 * 開發環境列出詳細路徑；正式環境只說「這份設定有問題」——
 * 錯誤訊息本身也是資訊，不該對訪客揭露內部結構。
 */
function RenderError({
  errors,
  className,
}: {
  errors: { path: string; message: string }[];
  className?: string;
}) {
  // 判準是「不是正式環境」而非「是開發環境」：
  // 要防的是對訪客洩漏內部結構，而測試環境同樣需要看得到細節。
  const showDetails = process.env.NODE_ENV !== "production";

  return (
    <div className={`bg-brand-paper border-brand-line rounded-lg border p-8 ${className ?? ""}`}>
      <p className="text-body font-bold">這份網站設定目前無法呈現。</p>

      {showDetails ? (
        <ul className="text-caption text-brand-muted mt-4 space-y-1 font-mono">
          {errors.slice(0, 10).map((error) => (
            <li key={`${error.path}-${error.message}`}>
              {error.path}：{error.message}
            </li>
          ))}
          {errors.length > 10 ? <li>…還有 {errors.length - 10} 項</li> : null}
        </ul>
      ) : (
        <p className="text-body-sm text-brand-muted mt-2">請重新調整內容後再試一次。</p>
      )}
    </div>
  );
}

function EmptySite() {
  return (
    <div className="p-12 text-center">
      <p className="text-body-sm opacity-70">這個網站還沒有任何區塊。</p>
    </div>
  );
}
