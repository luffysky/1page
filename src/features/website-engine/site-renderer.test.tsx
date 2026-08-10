// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { implementedSectionTypes, resolveSection, variantsFor } from "./registry";
import type { SiteConfig, SiteSection } from "./schema";
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
    // 靜默略過會讓人以為「Agent 沒做事」，實際上是「這個 type 還沒有元件」
    const config = makeConfig([
      { id: "pricing", type: "pricing", variant: "table", content: { title: "方案" } },
    ]);

    render(<SiteRenderer config={config} />);
    expect(screen.getByText(/尚未實作的區塊類型/)).toBeInTheDocument();
  });

  it("未實作的 type 不影響其他 section", () => {
    const config = makeConfig([
      HERO,
      { id: "faq", type: "faq", variant: "list", content: {} },
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
