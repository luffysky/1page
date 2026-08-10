import { site } from "../site-classes";

import { items, type SectionProps, text } from "./shared";

/** CTA / Contact / Footer：導向動作的區塊 */

export function CtaBanner({ section }: SectionProps) {
  const actions = items(section, "actions");

  return (
    <section className={`${site.surface} ${site.text} px-6 py-20 text-center`}>
      <h2 className={`${site.heading} mx-auto max-w-[16em] text-3xl`}>{text(section, "title")}</h2>

      {text(section, "subtitle") ? (
        <p className={`${site.muted} ${site.body} mx-auto mt-4 max-w-prose`}>
          {text(section, "subtitle")}
        </p>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions.map((action) => (
            <a
              key={action.label}
              href={action.href ?? "#"}
              className={`${site.accentBg} ${site.onAccent} ${site.radius} inline-flex px-6 py-3 font-bold`}
            >
              {action.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ContactSimple({ section }: SectionProps) {
  const entries = items(section, "items");

  return (
    <section className={`${site.bg} ${site.text} px-6 py-20`}>
      <div className="mx-auto max-w-5xl">
        <h2 className={`${site.heading} text-2xl`}>{text(section, "title", "聯絡")}</h2>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {entries.map((item) => (
            <div key={item.label}>
              <dt className={`${site.muted} ${site.body} text-sm`}>{item.label}</dt>
              <dd className={`${site.body} mt-1`}>
                {item.href ? (
                  <a href={item.href} className={site.accent}>
                    {item.text ?? item.href}
                  </a>
                ) : (
                  (item.text ?? "")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function FooterSimple({ section }: SectionProps) {
  return (
    <footer className={`${site.surface} ${site.muted} ${site.body} px-6 py-10 text-sm`}>
      <div className="mx-auto max-w-5xl">{text(section, "text")}</div>
    </footer>
  );
}
