// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentWorkspaceShell } from "@/components/agent/agent-workspace-shell";
import { TemplateExperienceShell } from "@/components/website-preview/template-experience-shell";
import { SITE_SCOPE_ATTRIBUTE } from "@/features/website-engine/types";

/**
 * Plan §1「兩個 Shell 只做殼」與「禁止假互動」的自動化防線。
 *
 * 這是針對 V3 Demo 的具體防呆：Demo 用 `element.style.background = ...`
 * 偽造主題切換、用 setTimeout 假裝 AI 在回覆（Spec §45.1）。
 * Phase 1 若為了 demo 效果重蹈覆轍，Phase 3 / 5 會整段重寫。
 *
 * 寧可讓按鈕不能按，也不要讓它假裝會動。
 */

describe("TemplateExperienceShell", () => {
  it("Theme / Device 切換控制項全部 disabled", () => {
    render(<TemplateExperienceShell />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("site scope 容器存在，Phase 3 才注入 --site-* 變數", () => {
    const { container } = render(<TemplateExperienceShell />);
    expect(container.querySelector(`[${SITE_SCOPE_ATTRIBUTE}]`)).not.toBeNull();
  });

  it("scope 容器上沒有任何 inline style —— Phase 1 不做主題注入", () => {
    const { container } = render(<TemplateExperienceShell />);
    const scope = container.querySelector(`[${SITE_SCOPE_ATTRIBUTE}]`);
    expect(scope?.getAttribute("style")).toBeNull();
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
