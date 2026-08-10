import { site } from "../site-classes";

import { items, list, type SectionProps, text } from "./shared";

/** About / Services / Gallery：以文字與清單為主的區塊 */

export function AboutSimple({ section }: SectionProps) {
  return (
    <section className={`${site.bg} ${site.text} px-6 py-20`}>
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[16rem_1fr]">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "關於")}</h2>
        <p className={`${site.body} max-w-prose leading-relaxed`}>{text(section, "body")}</p>
      </div>
    </section>
  );
}

export function ServicesList({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} px-6 py-20`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "服務")}</h2>

        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((item) => (
            <li key={item.label} className={`${site.surface} ${site.radius} p-6`}>
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

  /*
   * 尚無真實圖片：Preview 的圖片資產要等 Phase 4 的模板。
   * 此處以 surface 色塊佔位，而不是放外部圖片——
   * Spec §36 的 image source validation 不允許任意來源，
   * 而「先放個示意圖」正是那條規則最常被繞過的方式。
   */
  const cells = captions.length > 0 ? captions : ["", "", ""];

  return (
    <section className={`${site.bg} ${site.text} px-6 py-20`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "作品")}</h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cells.map((caption, index) => (
            <li key={`${caption}-${index}`}>
              <div className={`${site.surface} ${site.radius} aspect-[4/3] w-full`} />
              {caption ? (
                <p className={`${site.muted} ${site.body} mt-2 text-sm`}>{caption}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
