"use client";

import { useState } from "react";

import { buildEmbed, EMBED_SANDBOX } from "../embeds";
import { site } from "../site-classes";

import { type SectionProps, text } from "./shared";

/**
 * 嵌入區塊（CR-003-3）
 *
 * ── 為什麼要先按一下才載入 ────────────────────────────────────
 *
 * 這個預覽長在**我們自己的首頁**上。直接放 iframe 的話，
 * 每一個訪客光是捲到模板區，就會向 Google 與 YouTube 送出請求，
 * 帶著他的 IP 與我們的網域。他只是來看看我們接不接案。
 *
 * 除此之外還有兩件事：一個 YouTube 播放器是幾百 KB 的 JS，
 * 而首頁有效能預算；以及第三方 iframe 會把自己的可聚焦元素
 * 塞進我們的 Tab 順序裡。
 *
 * 所以預設只畫一個佔位＋一顆按鈕，按了才真的建立 iframe。
 * 這在真實網站上本來就是該做的（facade pattern），
 * 所以這個示範同時也是在示範正確做法。
 */
export function EmbedFrame({ section }: SectionProps) {
  const [loaded, setLoaded] = useState(false);
  const result = buildEmbed(section.variant, section.content);

  if (!result.ok) {
    /*
     * 設定錯誤要看得見，而不是一個白框。
     * Agent 會產生這些內容，而「影片沒出來」與「id 打錯了」
     * 對使用者來說得分得出來。
     */
    return (
      <section className={`${site.bg} ${site.muted} ${site.body} ${site.sectionYTight} px-6`}>
        <div className={`${site.surface} ${site.radius} ${site.cardPad} mx-auto max-w-3xl`}>
          <p className="text-sm">{result.reason}</p>
        </div>
      </section>
    );
  }

  const { spec } = result;
  const heading = text(section, "title");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-3xl">
        {heading ? <h2 className={`${site.heading} mb-6 text-2xl`}>{heading}</h2> : null}

        <div className={`${site.surface} ${site.radius} aspect-video w-full overflow-hidden`}>
          {loaded ? (
            <iframe
              src={spec.src}
              title={spec.title}
              allow={spec.allow}
              sandbox={EMBED_SANDBOX}
              referrerPolicy={spec.referrerPolicy}
              loading="lazy"
              className="h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              data-embed-facade=""
              onClick={() => setLoaded(true)}
              className={`${site.body} flex h-full w-full flex-col items-center justify-center gap-2`}
            >
              <span
                className={`${site.accentBg} ${site.onAccent} ${site.radius} px-5 py-2.5 text-sm font-bold`}
              >
                {spec.facadeLabel}
              </span>
              <span className={`${site.muted} text-xs`}>
                {/* 講清楚按下去會發生什麼事，而不是等他按了才連線 */}
                按下後才會連線到 {spec.provider}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
