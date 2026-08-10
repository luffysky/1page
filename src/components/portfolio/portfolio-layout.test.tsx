// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";

import { PortfolioLayout, type PortfolioCard } from "./portfolio-layout";

/**
 * Spec §8.2 / §29 的自動化防線：
 * > 不得將 Demo / Concept 冒充真實客戶案例。
 *
 * 標示類型不是選配。若哪天有人為了畫面乾淨把標籤拿掉，這裡會擋下來。
 */

const ITEMS: PortfolioCard[] = [
  { id: "a", title: "作品 A", kicker: "Landing Page", projectType: "demo", href: "/work/a" },
  { id: "b", title: "作品 B", kicker: "Identity", projectType: "internal", href: "/work/b" },
  { id: "c", title: "作品 C", kicker: "Website", projectType: "client", href: "/work/c" },
  { id: "d", title: "作品 D", kicker: "Concept", projectType: "concept", href: "/work/d" },
];

describe("PortfolioLayout — 來源類型標示", () => {
  it("每件作品都顯示來源類型標籤", () => {
    render(<PortfolioLayout items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByText(PROJECT_TYPE_LABELS[item.projectType])).toBeInTheDocument();
    }
  });

  it("Demo 顯示為 Demo，不會被寫成 Client Project", () => {
    render(<PortfolioLayout items={[ITEMS[0]!]} />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.queryByText("Client Project")).not.toBeInTheDocument();
  });

  it("每件作品都可連結至詳細頁", () => {
    render(<PortfolioLayout items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole("link", { name: item.title })).toHaveAttribute("href", item.href);
    }
  });

  it("無封面時不產生缺少替代文字的圖片", () => {
    render(<PortfolioLayout items={ITEMS} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("空清單不會 crash", () => {
    expect(() => render(<PortfolioLayout items={[]} />)).not.toThrow();
  });
});
