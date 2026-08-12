// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SitePreviewProvider, useSitePreview } from "@/features/website-engine/preview-context";

import { AgentHandoffProvider, useAgentHandoff } from "./handoff";

/**
 * Spec §8.15：
 *   「訪客在此累積的 SiteConfig 必須能無損傳入 Agent 與 Project Builder，
 *     不可要求訪客重新選一次。」
 *
 * 「無損」不是「有帶到品牌名稱」。這裡的判準是**整份 config 相等**——
 * 挑欄位傳的實作在今天看起來一樣，但 Phase 5 加一個新欄位時會靜默遺失，
 * 而表現是「Agent 忘記了訪客選過的東西」，很難連回這裡。
 */

function Harness() {
  const { config, setBrandName } = useSitePreview();
  const { handoff, openAgent } = useAgentHandoff();

  return (
    <div>
      <button type="button" onClick={() => openAgent({ intent: "template", config })}>
        交接
      </button>
      <button type="button" onClick={() => setBrandName("交接之後才改的名字")}>
        改名
      </button>
      <pre data-testid="current">{JSON.stringify(config)}</pre>
      <pre data-testid="handoff">{handoff ? JSON.stringify(handoff.config) : ""}</pre>
    </div>
  );
}

function renderHarness() {
  return render(
    <SitePreviewProvider>
      <AgentHandoffProvider>
        <Harness />
      </AgentHandoffProvider>
    </SitePreviewProvider>,
  );
}

const read = (testId: string) => screen.getByTestId(testId).textContent ?? "";

describe("Template Experience → Agent 交接", () => {
  it("尚未交接時 Agent 手上沒有東西", () => {
    renderHarness();
    expect(read("handoff")).toBe("");
  });

  it("交接的是整份 SiteConfig，不是摘要", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "交接" }));

    expect(JSON.parse(read("handoff"))).toEqual(JSON.parse(read("current")));
  });

  it("交接之後再改預覽，Agent 手上的那份不受影響", async () => {
    // 交接的意思是「那個時間點的快照」。
    // 若兩邊共用同一份可變狀態，訪客送出後隨手再改一下預覽，
    // Agent 收到的東西就跟著變了——那不是交接。
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "交接" }));
    const sent = read("handoff");

    await user.click(screen.getByRole("button", { name: "改名" }));

    expect(read("current")).toContain("交接之後才改的名字");
    expect(read("handoff")).toBe(sent);
    expect(read("handoff")).not.toContain("交接之後才改的名字");
  });
});

describe("Preview 的跨頁保存", () => {
  it("重新掛載後回到訪客上次調好的狀態", async () => {
    const user = userEvent.setup();
    const first = renderHarness();

    await user.click(screen.getByRole("button", { name: "改名" }));
    expect(read("current")).toContain("交接之後才改的名字");

    // 離開頁面再回來 = 元件樹整個卸載後重新掛載
    first.unmount();
    renderHarness();

    expect(read("current")).toContain("交接之後才改的名字");
  });

  it("儲存的內容壞掉時回到預設值，不是整個炸掉", () => {
    // sessionStorage 的內容使用者改得到，所以它是不可信輸入。
    window.sessionStorage.setItem("1page:preview-draft", '{"templateId":"不存在的模板"}');

    renderHarness();

    expect(read("current")).not.toBe("");
    expect(JSON.parse(read("current")).brand.name).toBeTruthy();
  });
});
