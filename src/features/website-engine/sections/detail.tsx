import { site } from "../site-classes";

import { items, type SectionProps, text } from "./shared";

/**
 * 讓人搞懂細節的區塊：FAQ、流程、方案、表單。
 *
 * 這幾個是訪客已經有興趣、正在找理由說服自己的時候會看的東西。
 */

export function FaqList({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-3xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "常見問題")}</h2>

        <div className="mt-8 flex flex-col gap-2">
          {entries.map((item, index) => (
            /*
             * 用原生 details/summary，不自己做展開收合。
             *
             * 自己做的話要處理 aria-expanded、鍵盤 Enter/Space、焦點順序，
             * 而且那些全都得在**沒有 JS 的伺服器元件**裡做——做不到。
             * 原生元素這些全部免費，而且鍵盤與螢幕閱讀器的行為
             * 是瀏覽器保證的，不是我們保證的。
             */
            <details
              key={`${item.label}-${index}`}
              className={`${site.surface} ${site.radius} ${site.cardPad}`}
            >
              <summary className={`${site.heading} cursor-pointer`}>{item.label}</summary>
              {item.text ? (
                <p className={`${site.muted} ${site.body} mt-3 leading-relaxed`}>{item.text}</p>
              ) : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProcessSteps({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "怎麼進行")}</h2>

        {/*
         * ol 而不是 ul：流程的順序就是它的內容。
         * 編號用 CSS counter 會讓螢幕閱讀器讀不到「第幾步」，
         * 所以這裡讓 ol 自己的語意帶順序，視覺上的數字另外畫。
         */}
        <ol className="mt-8 grid gap-6 @2xl:grid-cols-2 @5xl:grid-cols-4">
          {entries.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <span className={`${site.heading} ${site.accent} text-3xl`} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className={`${site.heading} mt-2 text-lg`}>{item.label}</h3>
              {item.text ? (
                <p className={`${site.muted} ${site.body} mt-1 text-sm leading-relaxed`}>
                  {item.text}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PricingTiers({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "方案")}</h2>

        <ul className="mt-8 grid gap-4 @3xl:grid-cols-3">
          {entries.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className={`${site.surface} ${site.radius} ${site.cardPad} flex flex-col`}
            >
              <h3 className={`${site.heading} text-lg`}>{item.label}</h3>
              {item.text ? (
                <p className={`${site.muted} ${site.body} mt-2 text-sm leading-relaxed`}>
                  {item.text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FormSimple({ section }: SectionProps) {
  const fields = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-2xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "聯絡我們")}</h2>
        {text(section, "body") ? (
          <p className={`${site.muted} ${site.body} mt-3`}>{text(section, "body")}</p>
        ) : null}

        {/*
         * ⚠️ 這裡刻意**不是** <form>，送出鈕也刻意是 type="button"。
         *
         * 這一塊是版面示意——它長在我們自己的首頁預覽裡，沒有後端可以收。
         * 包成真的 <form> 的話，在欄位裡按 Enter 就會送出，
         * 而「送得出去、但沒有人收」比沒有表單更糟：訪客會以為留言成功了。
         *
         * 這和 ActionButton 沒有 href 時渲染成 <span> 是同一個判斷：
         * 不要做出一個承諾了動作、卻什麼都不會發生的控制項。
         *
         * 真正會收的表單是 Lead 表單（Phase 5），那條路徑有 repository、
         * 有 RLS、有速率限制——不是這裡。
         */}
        {/*
         * 欄位講出來一次，給讀不到畫面的人。
         *
         * 下面那組欄位是 aria-hidden 的圖片，所以這裡要補一句——
         * 不然螢幕閱讀器的使用者會完全不知道這個模板裡有一張表單，
         * 那是在挑模板時真的會影響決定的資訊。
         */}
        <p className="sr-only">
          版面示意：這裡在實際網站上是一張可以填寫的表單，欄位有
          {fields.map((field) => field.label).join("、")}。
        </p>

        {/*
         * ⚠️ 整組欄位是 aria-hidden + 不可聚焦的「表單的照片」。
         *
         * 原本用 readOnly input，畫面上對、鍵盤上不對：readOnly 仍然吃 Tab，
         * 使用者會依序停在三個打不了字的框，然後找不到送出鈕（它是 span）。
         * axe 不會報這件事——沒有任何規則在問「這個可聚焦的東西有用嗎」。
         *
         * 用 disabled 也不行：它會把欄位變灰，而這一塊的用途正是給人看
         * 「表單在我的網站上長什麼樣子」，灰掉就看不出來了。
         *
         * 所以做成純視覺，語意由上面那句 sr-only 負責。
         */}
        <div className="mt-8 flex flex-col gap-4" aria-hidden="true">
          {fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="flex flex-col gap-1.5">
              <span className={`${site.body} text-sm`}>{field.label}</span>
              <span
                className={`${site.surface} ${site.radius} ${site.muted} ${site.body} px-3 py-2`}
              >
                {field.text ?? ""}
              </span>
            </div>
          ))}

          <span
            className={`${site.accentBg} ${site.onAccent} ${site.radius} mt-2 inline-flex justify-center px-6 py-3 font-bold`}
          >
            {text(section, "submitLabel", "送出")}
          </span>
        </div>
      </div>
    </section>
  );
}
