// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  implementedSectionTypes,
  resolveSection,
  SECTION_REGISTRY,
  UnknownSection,
  variantsFor,
} from "./registry";
import { SITE_SECTION_TYPES, type SiteConfig, type SiteSection } from "./schema";
import { newSection } from "./section-presets";
import { SiteRenderer } from "./site-renderer";

/**
 * SiteRenderer 是唯一正式渲染入口（Spec §11）。
 *
 * 這組測試的重點是**降級行為**：Phase 6 的 Agent 會直接產生 section 與 variant，
 * LLM 生出不存在的名稱是遲早的事。那時該壞的只有那一塊，不是整頁。
 */

const THEME = {
  colors: {
    background: "#ffffff",
    surface: "#f5f5f5",
    text: "#111111",
    muted: "#777777",
    accent: "#cc3300",
  },
  typography: { heading: "Noto Serif TC", body: "Inter" },
  radius: "8px",
  spacingScale: "1rem",
};

function makeConfig(sections: SiteSection[]): SiteConfig {
  return {
    id: "test",
    brand: { name: "測試品牌" },
    theme: THEME,
    sections,
    settings: { language: "zh-Hant" },
  } as SiteConfig;
}

const HERO: SiteSection = {
  id: "hero",
  type: "hero",
  variant: "editorial",
  content: { title: "把今天的甜留久一點", subtitle: "手作甜點", eyebrow: "甜點品牌" },
};

describe("正常渲染", () => {
  it("渲染 section 的內容", () => {
    render(<SiteRenderer config={makeConfig([HERO])} />);
    expect(screen.getByText("把今天的甜留久一點")).toBeInTheDocument();
    expect(screen.getByText("手作甜點")).toBeInTheDocument();
  });

  it("包在 site scope 容器內，主題不會外洩", () => {
    const { container } = render(<SiteRenderer config={makeConfig([HERO])} />);
    const scope = container.querySelector("[data-site-scope]");
    expect(scope).not.toBeNull();
    expect(scope!.getAttribute("style")).toContain("--site-color-background");
  });

  it("多個 section 依序渲染", () => {
    const config = makeConfig([
      HERO,
      { id: "about", type: "about", variant: "simple", content: { title: "關於我們" } },
      { id: "cta", type: "cta", variant: "banner", content: { title: "現在就開始" } },
    ]);

    render(<SiteRenderer config={config} />);
    expect(screen.getByText("關於我們")).toBeInTheDocument();
    expect(screen.getByText("現在就開始")).toBeInTheDocument();
  });

  it("沒有 section 時給出說明，不是空白", () => {
    render(<SiteRenderer config={makeConfig([])} />);
    expect(screen.getByText(/還沒有任何區塊/)).toBeInTheDocument();
  });
});

describe("降級：未知 variant", () => {
  it("退回該 type 的預設 variant，內容照常呈現", () => {
    // 排版錯了還能看，內容不見了就沒得救
    const config = makeConfig([{ ...HERO, variant: "nonexistent" }]);
    render(<SiteRenderer config={config} />);

    expect(screen.getByText("把今天的甜留久一點")).toBeInTheDocument();
  });

  it("resolveSection 明確標示發生了降級", () => {
    const resolved = resolveSection({ ...HERO, variant: "nonexistent" });
    expect(resolved?.fallback).toBe("variant");
    expect(resolved?.variant).not.toBe("nonexistent");
  });

  it("variant 正確時不標示降級", () => {
    expect(resolveSection(HERO)?.fallback).toBe("none");
  });
});

describe("降級：未實作的 type", () => {
  it("顯示可辨識的佔位，而非靜默略過", () => {
    /*
     * 靜默略過會讓人以為「Agent 沒做事」，實際上是「這個 type 還沒有元件」。
     *
     * ⚠️ 這裡的 type 是**算出來的**，不是寫死的。
     *
     * 原本寫死 "pricing"，CR-003-2 把 pricing 實作出來之後這條就紅了——
     * 測試釘住了「哪一個還沒做」這種一定會過期的事實。
     *
     * 換成不在 enum 裡的字串也不對：SiteRenderer 會先整份驗 schema，
     * 非法的 type 在那一關就被擋成「這份網站設定目前無法呈現」，
     * 根本走不到 UnknownSection。這個佔位真正的觸發條件很窄——
     * **type 合法、但 registry 裡沒有它**——也就是 registry.test.ts 的
     * DEFERRED 清單裡那些。所以直接去問 registry 現在缺哪一個。
     */
    const unimplemented = SITE_SECTION_TYPES.find((type) => !SECTION_REGISTRY[type]);

    // 全部都實作完了的話，這個佔位就只剩「新增 type 卻忘了接元件」那個
    // 開發中的空窗期會用到——那時直接驗元件本身，測試不會因此變成空殼。
    if (!unimplemented) {
      render(
        <UnknownSection
          section={{ id: "x", type: "hero", variant: "nope", content: {} } as SiteSection}
        />,
      );
      expect(screen.getByText(/尚未實作的區塊類型/)).toBeInTheDocument();
      return;
    }

    const config = makeConfig([
      { id: "deferred", type: unimplemented, variant: "table", content: { title: "方案" } },
    ]);

    render(<SiteRenderer config={config} />);
    expect(screen.getByText(/尚未實作的區塊類型/)).toBeInTheDocument();
  });

  it("未實作的 type 不影響其他 section", () => {
    // 同樣算出來而不是寫死。原本這裡放 "faq"，CR-003-2 之後它有元件了——
    // 測試照樣是綠的，但驗的已經不是它名字說的那件事：一個名不副實的綠燈。
    const unimplemented = SITE_SECTION_TYPES.find((type) => !SECTION_REGISTRY[type]) ?? "faq";

    const config = makeConfig([
      HERO,
      { id: "gap", type: unimplemented, variant: "list", content: {} },
      { id: "cta", type: "cta", variant: "banner", content: { title: "現在就開始" } },
    ]);

    render(<SiteRenderer config={config} />);
    expect(screen.getByText("把今天的甜留久一點")).toBeInTheDocument();
    expect(screen.getByText("現在就開始")).toBeInTheDocument();
  });
});

describe("無效設定不崩潰（Spec §36）", () => {
  it("渲染錯誤說明而非拋例外", () => {
    // 型別上是 SiteConfig，但實際值不是——這正是跨越序列化邊界時會發生的事
    const broken = { ...makeConfig([HERO]), theme: { colors: {} } } as unknown as SiteConfig;

    expect(() => render(<SiteRenderer config={broken} />)).not.toThrow();
    expect(screen.getByText(/無法呈現/)).toBeInTheDocument();
  });

  it("含 CSS 注入的主題被整份擋下", () => {
    const attacked = {
      ...makeConfig([HERO]),
      theme: { ...THEME, colors: { ...THEME.colors, accent: "red; background: url(//evil)" } },
    } as unknown as SiteConfig;

    render(<SiteRenderer config={attacked} />);
    expect(screen.getByText(/無法呈現/)).toBeInTheDocument();
  });

  it("含 HTML 標籤的內容被擋下，不會渲染成標記", () => {
    const attacked = makeConfig([
      { ...HERO, content: { title: "<img src=x onerror=alert(1)>" } },
    ]) as unknown as SiteConfig;

    const { container } = render(<SiteRenderer config={attacked} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/無法呈現/)).toBeInTheDocument();
  });
});

describe("兩個同名的項目", () => {
  /*
   * 編輯器可以「新增一項」，而新增出來的那一項 label 一開始是空字串——
   * 所以「兩個 label 完全一樣的項目」是使用者連按兩下就會做出來的東西，
   * 不是想像中的邊界情況。
   *
   * 各 section 元件原本一律用 `key={item.label}`，於是那兩項的 key 相同。
   *
   * ⚠️ 第一版這條測試斷言「兩項都要畫得出來」，而它**驗不到東西**：
   * React 在首次渲染時本來就會把重複 key 的兩個孩子都畫出來，
   * 把 key 改回 `item.label` 照樣綠。重複 key 真正壞掉的地方是**更新**——
   * 改了第二項卻動到第一項、或該重畫的那項沒重畫，而那是
   * 編輯器每打一個字都會走的路徑。
   *
   * 所以這裡驗的是 React 自己的警告。它是唯一一個不管後果怎麼表現
   * 都一定會出現的訊號。
   */
  function duplicateFirstItem(section: SiteSection) {
    for (const [key, value] of Object.entries(section.content)) {
      if (!Array.isArray(value) || value.length === 0) continue;

      const first = value[0];
      if (typeof first === "string") {
        return { section: { ...section, content: { ...section.content, [key]: [first, first] } } };
      }
      if (typeof first === "object" && first !== null && "label" in first) {
        return {
          section: {
            ...section,
            content: { ...section.content, [key]: [first, { ...first }] },
          },
          label: first.label,
        };
      }
    }
    return null;
  }

  for (const type of implementedSectionTypes()) {
    const duplicated = duplicateFirstItem(newSection(type, []));
    if (!duplicated) continue;

    it(`${type} 的兩個同名項目不會撞到同一個 key`, () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        render(<SiteRenderer config={makeConfig([duplicated.section])} />);

        const complaints = spy.mock.calls
          .map((args) => args.join(" "))
          .filter((message) => /same key|duplicate key/i.test(message));

        expect(complaints, `${type} 用了會重複的 key，更新時會改到錯的那一項`).toEqual([]);
      } finally {
        spy.mockRestore();
      }
    });
  }
});

describe("Registry", () => {
  it("每個已註冊的 type 至少有一個 variant", () => {
    for (const type of implementedSectionTypes()) {
      expect(variantsFor(type).length, `${type} 沒有任何 variant`).toBeGreaterThan(0);
    }
  });

  it("hero 提供 Spec §10 舉例的三種排版", () => {
    expect(variantsFor("hero")).toEqual(
      expect.arrayContaining(["centered", "editorial", "minimal"]),
    );
  });
});
