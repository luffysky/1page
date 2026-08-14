import { IMAGE_CONTENT_KEY } from "../schema";
import { site } from "../site-classes";

import { items, list, type SectionProps, text } from "./shared";

/** About / Services / Gallery：以文字與清單為主的區塊 */

export function AboutSimple({ section }: SectionProps) {
  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto grid max-w-5xl gap-10 @3xl:grid-cols-[16rem_1fr]">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "關於")}</h2>
        <p className={`${site.body} max-w-prose leading-relaxed`}>{text(section, "body")}</p>
      </div>
    </section>
  );
}

export function ServicesList({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "服務")}</h2>

        <ul className="mt-8 grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {entries.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className={`${site.surface} ${site.radius} ${site.cardPad}`}
            >
              <h3 className={`${site.heading} text-lg`}>{item.label}</h3>
              {item.text ? <p className={`${site.muted} ${site.body} mt-2`}>{item.text}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GalleryGrid({ section }: SectionProps) {
  const captions = list(section, "captions");
  const images = list(section, IMAGE_CONTENT_KEY);

  /*
   * 有圖就畫圖，沒圖就畫色塊。
   *
   * 色塊不是「還沒做完」的痕跡，是模板本來就該有的樣子：訪客第一次
   * 打開編輯器時還沒有任何圖片，那時放一張別人的示意圖，他會以為
   * 那是自己的網站的一部分，然後就這樣上線了。
   *
   * 圖片來源由 schema 的 IMAGE_CONTENT_KEY 檢查擋住（只認自己的媒體網域）——
   * 「先放個示意圖」正是 Spec §36 那條規則最常被繞過的方式。
   */
  const count = Math.max(images.length, captions.length, 3);
  const cells = Array.from({ length: count }, (_, index) => ({
    image: images[index],
    caption: captions[index] ?? "",
  }));

  return (
    <section className={`${site.bg} ${site.text} ${site.sectionY} px-6`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "作品")}</h2>

        <ul className="mt-8 grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {cells.map((cell, index) => (
            <li key={`${cell.caption}-${index}`}>
              {cell.image ? (
                /*
                 * 用原生 img 而不是 next/image。
                 *
                 * 這裡的容器寬度由 container query 決定，而且訪客正在
                 * 邊拖邊改——next/image 需要固定的 sizes 才不會抓錯解析度，
                 * 在一個會即時變形的預覽裡給不出那個值。
                 *
                 * alt 用圖說。沒有圖說時給空字串（裝飾性圖片的正確作法），
                 * 而不是塞「圖片」這種對螢幕閱讀器沒有意義的字。
                 */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cell.image}
                  alt={cell.caption}
                  loading="lazy"
                  className={`${site.radius} aspect-[4/3] w-full object-cover`}
                />
              ) : (
                <div className={`${site.surface} ${site.radius} aspect-[4/3] w-full`} />
              )}

              {cell.caption ? (
                <p className={`${site.muted} ${site.body} mt-2 text-sm`}>{cell.caption}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
