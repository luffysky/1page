"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  DEFAULT_HOME_GOAL,
  getHomeGoal,
  type HomeGoal,
  type HomeGoalDefinition,
} from "@/config/home-goals";

/**
 * Home Goal Context（Spec §6 / Plan §6.2）
 *
 * ── Source of Truth 的精確定義 ──────────────────────────────
 *   初始渲染   URL → state      Server 讀 searchParams，決定首次輸出
 *   互動當下   state → 立即渲染  client 樂觀更新，畫面不等 server round-trip
 *   互動之後   state → URL      寫回網址，供分享、重整與 analytics
 *
 * 即：URL 是初始來源與可分享紀錄，互動期間由 client state 驅動畫面。
 * 兩者在定義好的時點單向同步，不同時爭奪控制權。
 *
 * ── 為什麼各 Section 要讀這個 context 而不是讀 searchParams ──
 * 若 Section 直接讀 server searchParams，每次切 goal 都要等 RSC 回來才更新，
 * 就會變成 Plan §6.2 警告的「整頁 reload 感」。
 */

interface HomeGoalContextValue {
  goal: HomeGoal;
  definition: HomeGoalDefinition;
  setGoal: (next: HomeGoal) => void;
  /** unsure = 不套用任何篩選 */
  isFiltering: boolean;
}

const HomeGoalContext = createContext<HomeGoalContextValue | null>(null);

export function HomeGoalProvider({
  initialGoal,
  children,
}: {
  initialGoal: HomeGoal;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [goal, setGoalState] = useState<HomeGoal>(initialGoal);

  // 上一頁／下一頁或外部連結進入時，server 會以新的 searchParams 重新渲染，
  // initialGoal 因此改變 —— 在 render 期間校正 state（React 官方建議的
  // 「由 props 調整 state」寫法），比用 useEffect 少一次多餘的 paint。
  const [syncedInitialGoal, setSyncedInitialGoal] = useState<HomeGoal>(initialGoal);
  if (syncedInitialGoal !== initialGoal) {
    setSyncedInitialGoal(initialGoal);
    setGoalState(initialGoal);
  }

  const setGoal = useCallback(
    (next: HomeGoal) => {
      // 1. 先更新 client state：畫面立即反應，不等 server
      setGoalState(next);

      // 2. 再寫回 URL。刻意在事件處理中讀 window.location.search 而非使用
      //    useSearchParams()：後者會讓元件與「頁面是否靜態預先產生」耦合
      //    （靜態頁需 Suspense 包裹），而 goal 只在使用者互動時才需要當前查詢字串。
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );

      if (next === DEFAULT_HOME_GOAL) {
        // unsure 是預設值，不留在網址上造成誤導（Plan §5）
        params.delete("goal");
      } else {
        params.set("goal", next);
      }

      const query = params.toString();

      // 使用 push 而非 replace：goal 選擇是使用者的明確操作，
      // 上一頁應該能回到前一個 goal（見 Plan §5 的驗收項目）。
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });

      // Spec §31 `goal_selected` 的發送點在此。
      // analytics 於 1D 接入（Plan §7），屆時在這裡呼叫，不另尋位置。
    },
    [pathname, router],
  );

  const value = useMemo<HomeGoalContextValue>(
    () => ({
      goal,
      definition: getHomeGoal(goal),
      setGoal,
      isFiltering: goal !== DEFAULT_HOME_GOAL,
    }),
    [goal, setGoal],
  );

  return <HomeGoalContext.Provider value={value}>{children}</HomeGoalContext.Provider>;
}

export function useHomeGoal(): HomeGoalContextValue {
  const context = useContext(HomeGoalContext);
  if (!context) {
    throw new Error("useHomeGoal 必須在 <HomeGoalProvider> 之內使用");
  }
  return context;
}
