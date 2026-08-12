import { site } from "../site-classes";

import { items, type SectionProps, text } from "./shared";

/**
 * 讓人相信你的區塊：見證、數字、團隊。
 *
 * 這三個都在回答訪客心裡的同一個問題——「你行嗎？」
 * 分別用別人的話、用數字、用人臉來回答。
 *
 * ── 欄位怎麼對應 ──────────────────────────────────────────────
 *
 * `items()` 回傳的是 `{ label, text? }`，兩個欄位在不同區塊裡意思不同。
 * 判準是「哪一個少了就沒意義」——那個放 label（它是必填）：
 *
 *   testimonials  label = 說話的人   text = 他說的話
 *   stats         label = 數字       text = 這個數字在算什麼
 *   team          label = 名字       text = 職稱或一句話
 *
 * stats 看起來反直覺（數字放 label），但「120+」少了會只剩一句
 * 「服務過的客戶」，那不是一個數字區塊；反過來還看得懂。
 */

export function TestimonialsQuotes({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "客戶怎麼說")}</h2>

        <ul className="mt-8 grid gap-4 @3xl:grid-cols-2">
          {entries.map((item) => (
            <li key={item.label} className={`${site.surface} ${site.radius} ${site.cardPad}`}>
              {/*
               * 用 blockquote + cite 而不是兩個 p。
               * 見證的重點是「這是別人說的」，那是語意，不是排版——
               * 螢幕閱讀器會念出引言的邊界，視覺使用者靠縮排看出來。
               */}
              <blockquote className={`${site.body} leading-relaxed`}>
                {item.text ? `「${item.text}」` : null}
              </blockquote>
              <p className={`${site.muted} ${site.body} mt-3 text-sm`}>
                <cite className="not-italic">{item.label}</cite>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function StatsRow({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionYTight} px-6`}>
      <div className="mx-auto max-w-5xl">
        {text(section, "title") ? (
          <h2 className={`${site.heading} text-2xl`}>{text(section, "title")}</h2>
        ) : null}

        {/*
         * dl 而不是 ul：這是一組「名稱 → 值」的配對，而不是同質的清單項。
         * dd 在前、dt 在後是視覺順序（數字大、說明小），
         * DOM 順序仍然是 dt 先——瀏覽器與輔助技術讀的是 DOM。
         */}
        <dl className="mt-8 grid gap-8 @2xl:grid-cols-2 @5xl:grid-cols-4">
          {entries.map((item) => (
            <div key={item.label} className="flex flex-col-reverse gap-1">
              <dt className={`${site.muted} ${site.body} text-sm`}>{item.text}</dt>
              <dd className={`${site.heading} ${site.accent} text-4xl`}>{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function TeamGrid({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "團隊")}</h2>

        <ul className="mt-8 grid gap-6 @2xl:grid-cols-2 @5xl:grid-cols-4">
          {entries.map((item) => (
            <li key={item.label}>
              {/*
               * 頭像用色塊佔位，理由與 GalleryGrid 相同：
               * Spec §36 不允許任意圖片來源，而「先放張示意圖」
               * 正是那條規則最常被繞過的方式。
               */}
              <div className={`${site.surface} ${site.radius} aspect-square w-full`} />
              <p className={`${site.heading} mt-3`}>{item.label}</p>
              {item.text ? (
                <p className={`${site.muted} ${site.body} mt-1 text-sm`}>{item.text}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
