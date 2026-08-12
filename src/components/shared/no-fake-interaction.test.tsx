// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AgentWorkspaceShell } from "@/components/agent/agent-workspace-shell";
import { TemplatePicker } from "@/components/website-preview/template-picker";
import { SitePreview } from "@/components/website-preview/site-preview";
import { SitePreviewProvider } from "@/features/website-engine/preview-context";
import { TEMPLATES } from "@/features/website-engine/templates";
import { SITE_SCOPE_ATTRIBUTE } from "@/features/website-engine/types";

/**
 * 「禁止假互動」的自動化防線。
 *
 * 針對的是 V3 Demo 的具體失敗：用 `element.style.background = ...` 偽造主題切換、
 * 用 setTimeout 假裝 AI 在回覆（Spec §45.1）。
 *
 * ⚠️ 4B 起，Template Experience 這一半的判準**反過來**了。
 *
 * 1C–3D 期間它是一個殼，測試驗的是「所有控制項都 disabled」——
 * 寧可讓按鈕不能按，也不要讓它假裝會動。
 * 4B 把它接上真的 SiteConfig 之後，同一個位置要驗的變成「按了真的會變」，
 * 而且要驗到**渲染出來的內容**，不是「有沒有呼叫某個函式」。
 *
 * Agent 那一半仍然是殼（Phase 5），所以那組測試原封不動。
 */

function renderPreview() {
  return render(
    <SitePreviewProvider>
      <TemplatePicker templates={[...TEMPLATES]} />
      <SitePreview />
    </SitePreviewProvider>,
  );
}

describe("Template Experience", () => {
  it("模板按鈕可以按，不是 disabled 的裝飾", () => {
    renderPreview();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeEnabled();
    }
  });

  it("切換模板真的換掉了預覽的內容", async () => {
    const user = userEvent.setup();
    renderPreview();

    const [first, second] = TEMPLATES;

    // 預設是第一套：它的預設品牌名稱應該出現在預覽裡
    expect(screen.getAllByText(new RegExp(first!.defaultBrandName)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: new RegExp(second!.name) }));

    // 換過去之後，新模板的內容在、舊模板的不在。
    // 判準是畫面上的字，不是 state——只改 state 沒重新渲染的話，
    // 使用者看到的仍然是舊的那一份。
    expect(screen.getAllByText(new RegExp(second!.defaultBrandName)).length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(first!.defaultBrandName))).toBeNull();
  });

  it("切換模板會換掉主題變數，而不是只換文字", async () => {
    const user = userEvent.setup();
    const { container } = renderPreview();

    const scopeStyle = () =>
      container.querySelector(`[${SITE_SCOPE_ATTRIBUTE}]`)?.getAttribute("style") ?? "";

    const before = scopeStyle();
    // studio 是 minimal 主題、local-business 是 warm，兩者色值不同
    await user.click(screen.getByRole("button", { name: /Local Business/ }));

    expect(scopeStyle()).not.toBe(before);
    expect(scopeStyle()).toContain("--site-color-background");
  });

  it("site scope 容器存在，主題以 CSS 變數注入而非直接改樣式", () => {
    const { container } = renderPreview();
    const scope = container.querySelector(`[${SITE_SCOPE_ATTRIBUTE}]`);

    expect(scope).not.toBeNull();

    // scope 上只該有 --site-* 宣告。任何其他的 inline style 都代表
    // 有人繞過 SiteConfig 直接動了畫面。
    const declarations = (scope?.getAttribute("style") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      expect(declaration.startsWith("--site-"), `非預期的宣告：${declaration}`).toBe(true);
    }
  });
});

describe("AgentWorkspaceShell", () => {
  it("輸入框與送出按鈕 disabled", () => {
    render(<AgentWorkspaceShell initialIntent="website" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "問 AI 顧問" })).toBeDisabled();
  });

  it("聊天內容為靜態範例，不隨時間新增訊息", async () => {
    render(<AgentWorkspaceShell initialIntent="website" />);
    const initial = screen.getAllByRole("listitem").length;
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getAllByRole("listitem")).toHaveLength(initial);
  });
});
