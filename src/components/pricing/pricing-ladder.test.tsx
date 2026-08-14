// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";

import { PricingLadder } from "./pricing-ladder";

/**
 * Spec §26.1 的自動化防線。
 *
 * V3 Demo 把六級砍成四級，缺了 Template Build 與 Semi-Custom——
 * 那是 990 與 30,000 之間唯一的承接點，缺了它們轉換會斷在這裡（Spec §45.1）。
 * 這組測試讓同樣的退化在 CI 就爆掉，而不是等上線後才發現轉換不見了。
 */

describe("PricingLadder — 六級完整性", () => {
  it("六級全部渲染", () => {
    render(<PricingLadder groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    for (const tier of PRICING_TIERS) {
      expect(screen.getByRole("heading", { name: tier.name })).toBeInTheDocument();
    }
  });

  it("990 與 30,000 之間的兩個承接點必須存在", () => {
    render(<PricingLadder groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    expect(screen.getByRole("heading", { name: "Template Build" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Semi-Custom" })).toBeInTheDocument();
  });

  it("價格文字完整呈現，不遺漏「起」", () => {
    render(<PricingLadder groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    expect(screen.getByText(/NT\$ 8,800/)).toBeInTheDocument();
    expect(screen.getByText(/NT\$ 15,800/)).toBeInTheDocument();
  });

  it("分兩組敘事呈現（§26.2），而非單一清單", () => {
    render(<PricingLadder groups={PRICING_GROUPS} tiers={PRICING_TIERS} />);
    expect(screen.getByText("先想清楚")).toBeInTheDocument();
    expect(screen.getByText("開始建站")).toBeInTheDocument();
  });
});
