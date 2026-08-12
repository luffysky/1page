import { site } from "../site-classes";

import { ActionButton, items, type SectionProps, text } from "./shared";

/**
 * Hero（Spec §10）
 *
 * 三個 variant 對應 Spec §10 舉例的 hero.centered / hero.editorial / hero.minimal。
 * 它們是**版面**差異而非內容差異——同一份 content 可以套任一 variant。
 * 這是 Agent 能「換個排法」而不必重寫文案的前提（Phase 6 的 set_section_variant）。
 */

function Actions({ section }: SectionProps) {
  const actions = items(section, "actions");
  if (actions.length === 0) return null;

  return (
    <div className="mt-10 flex flex-wrap gap-3">
      {actions.map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
    </div>
  );
}

export function HeroCentered({ section }: SectionProps) {
  return (
    <section className={`${site.bg} ${site.text} ${site.sectionYLoose} px-6 text-center`}>
      {text(section, "eyebrow") ? (
        <p className={`${site.muted} text-sm tracking-widest uppercase`}>
          {text(section, "eyebrow")}
        </p>
      ) : null}

      <h1
        className={`${site.heading} mx-auto mt-4 max-w-[18em] text-4xl leading-tight @3xl:text-6xl`}
      >
        {text(section, "title")}
      </h1>

      {text(section, "subtitle") ? (
        <p className={`${site.muted} ${site.body} mx-auto mt-6 max-w-prose text-lg`}>
          {text(section, "subtitle")}
        </p>
      ) : null}

      <div className="flex justify-center">
        <Actions section={section} />
      </div>
    </section>
  );
}

export function HeroEditorial({ section }: SectionProps) {
  return (
    <section className={`${site.bg} ${site.text} ${site.sectionYLoose} px-6`}>
      <div className="mx-auto max-w-5xl">
        {text(section, "eyebrow") ? (
          <p className={`${site.accent} text-sm font-bold tracking-widest uppercase`}>
            {text(section, "eyebrow")}
          </p>
        ) : null}

        <h1 className={`${site.heading} mt-5 max-w-[14em] text-5xl leading-[1.05] @3xl:text-7xl`}>
          {text(section, "title")}
        </h1>

        {text(section, "subtitle") ? (
          <p className={`${site.muted} ${site.body} mt-8 max-w-prose text-lg`}>
            {text(section, "subtitle")}
          </p>
        ) : null}

        <Actions section={section} />
      </div>
    </section>
  );
}

export function HeroMinimal({ section }: SectionProps) {
  return (
    <section className={`${site.bg} ${site.text} ${site.sectionYTight} px-6`}>
      <div className="mx-auto max-w-3xl">
        <h1 className={`${site.heading} text-3xl @3xl:text-4xl`}>{text(section, "title")}</h1>
        {text(section, "subtitle") ? (
          <p className={`${site.muted} ${site.body} mt-3`}>{text(section, "subtitle")}</p>
        ) : null}
      </div>
    </section>
  );
}
