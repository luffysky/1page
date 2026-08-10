import { parseHomeGoal } from "@/config/home-goals";
import { GoalDebugPanel } from "@/features/home/goal-debug-panel";
import { HomeGoalProvider } from "@/features/home/goal-context";

/**
 * Phase 1B：首頁仍是佔位頁，但 Home Goal Context 的骨架已就位。
 *
 * 真正的 Section 組裝在 1D（Plan §7）。Goal Context 之所以必須先於 Section 存在，
 * 是因為它決定首頁如何組裝——後補等同重寫首頁（Plan §6.2）。
 *
 * searchParams 於此讀取，因此本路由為動態渲染。Phase 1 無資料庫，成本可忽略；
 * Phase 2 接 Supabase 後需重新評估快取策略。
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const goal = parseHomeGoal(params.goal);

  return (
    <HomeGoalProvider initialGoal={goal}>
      <main className="mx-auto w-full max-w-page px-gutter py-section lg:px-gutter-lg">
        <p className="text-kicker text-brand-accent uppercase">Phase 1B</p>
        <h1 className="text-display-1 mt-5">從第一頁，開始你的生意。</h1>
        <p className="text-lead text-brand-muted mt-6 max-w-prose">
          本頁為佔位頁。Design Token 與 Home Goal Context 已建立，首頁組裝於 1D 進行。
        </p>

        {process.env.NODE_ENV === "development" ? (
          <>
            <GoalDebugPanel />
            <p className="text-body-sm text-brand-muted mt-10">
              開發工具：
              <a className="text-brand-ink underline underline-offset-4" href="/_dev/tokens">
                /_dev/tokens
              </a>
            </p>
          </>
        ) : null}
      </main>
    </HomeGoalProvider>
  );
}
