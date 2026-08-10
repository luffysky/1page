// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeGoal } from "@/config/home-goals";

import { HomeGoalProvider, useHomeGoal } from "./goal-context";

/**
 * Plan §5 的 1B 驗收清單，逐條對應：
 *   URL ?goal=website → context = website
 *   點選 goal → URL 同步更新
 *   ?goal=<不存在> → unsure，不拋錯      （見 home-goals.test.ts）
 *   unsure → 不套用任何 filter
 *   重新整理保留 goal
 *   瀏覽器上一頁可回到前一個 goal
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

function setLocationSearch(search: string) {
  window.history.replaceState({}, "", `/${search}`);
}

function GoalProbe() {
  const { goal, definition, isFiltering, setGoal } = useHomeGoal();
  return (
    <div>
      <output data-testid="goal">{goal}</output>
      <output data-testid="filtering">{String(isFiltering)}</output>
      <output data-testid="work">{definition.workCategories.join(",")}</output>
      <button type="button" onClick={() => setGoal("ai")}>
        選 AI
      </button>
      <button type="button" onClick={() => setGoal("unsure")}>
        選 unsure
      </button>
    </div>
  );
}

function renderWithGoal(initialGoal: HomeGoal) {
  return render(
    <HomeGoalProvider initialGoal={initialGoal}>
      <GoalProbe />
    </HomeGoalProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  setLocationSearch("");
});

describe("初始渲染：URL → state", () => {
  it("?goal=website 進入時 context 即為 website", () => {
    renderWithGoal("website");
    expect(screen.getByTestId("goal")).toHaveTextContent("website");
    expect(screen.getByTestId("work")).toHaveTextContent("web");
  });

  it("unsure 不套用任何 filter", () => {
    renderWithGoal("unsure");
    expect(screen.getByTestId("filtering")).toHaveTextContent("false");
    expect(screen.getByTestId("work")).toBeEmptyDOMElement();
  });
});

describe("互動：state 立即更新，URL 隨後同步", () => {
  it("選取 goal 後畫面立即反應，不等 server", async () => {
    const user = userEvent.setup();
    renderWithGoal("unsure");

    await user.click(screen.getByRole("button", { name: "選 AI" }));

    // 未經任何 RSC round-trip，context 已是新值
    expect(screen.getByTestId("goal")).toHaveTextContent("ai");
    expect(screen.getByTestId("work")).toHaveTextContent("ai,automation");
  });

  it("選取 goal 後寫回 URL，且不捲動頁面", async () => {
    const user = userEvent.setup();
    renderWithGoal("unsure");

    await user.click(screen.getByRole("button", { name: "選 AI" }));

    expect(push).toHaveBeenCalledWith("/?goal=ai", { scroll: false });
  });

  it("選回 unsure 時把 goal 參數移除，不留預設值在網址上", async () => {
    const user = userEvent.setup();
    setLocationSearch("?goal=ai");
    renderWithGoal("ai");

    await user.click(screen.getByRole("button", { name: "選 unsure" }));

    expect(push).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("保留網址上的其他查詢參數", async () => {
    const user = userEvent.setup();
    setLocationSearch("?utm_source=ig");
    renderWithGoal("unsure");

    await user.click(screen.getByRole("button", { name: "選 AI" }));

    expect(push).toHaveBeenCalledWith("/?utm_source=ig&goal=ai", { scroll: false });
  });
});

describe("上一頁／重新整理", () => {
  it("上一頁使 server 帶回舊 goal 時，state 同步回退", () => {
    const { rerender } = renderWithGoal("ai");
    expect(screen.getByTestId("goal")).toHaveTextContent("ai");

    // 上一頁 → RSC 以新的 searchParams 重新渲染 → initialGoal 改變
    rerender(
      <HomeGoalProvider initialGoal="website">
        <GoalProbe />
      </HomeGoalProvider>,
    );

    expect(screen.getByTestId("goal")).toHaveTextContent("website");
    expect(screen.getByTestId("work")).toHaveTextContent("web");
  });

  it("重新整理等同以 URL 的 goal 重新掛載，狀態保留", () => {
    renderWithGoal("brand");
    expect(screen.getByTestId("goal")).toHaveTextContent("brand");
  });
});

describe("誤用防護", () => {
  it("在 Provider 之外使用 useHomeGoal 會明確報錯", () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<GoalProbe />)).toThrow(/HomeGoalProvider/);
    silence.mockRestore();
  });
});
