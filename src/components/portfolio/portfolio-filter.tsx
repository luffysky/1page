"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  ALL_CATEGORIES,
  ALL_PROJECT_TYPES,
  type CategoryFilter,
  type PortfolioCategory,
  type ProjectTypeFilter,
} from "@/config/portfolio-categories";
import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";
import { track } from "@/lib/analytics/track";

/**
 * Portfolio Filter（Spec §8.7）
 *
 * 沿用 Home Goal 建立的 URL-as-source-of-truth 模式（Plan §5）：
 *   初始渲染   URL → state
 *   互動當下   state → 立即渲染
 *   互動之後   state → URL（可分享、可作為廣告落地頁）
 *
 * 桌機水平排列，行動裝置橫向 scroll chips（Spec §8.7）。
 */

interface Props {
  category: CategoryFilter;
  projectType: ProjectTypeFilter;
  /**
   * 可選的分類，由 server 從資料庫讀來。
   *
   * ⚠️ 不在這裡直接讀 PORTFOLIO_CATEGORIES 常數：那份是種子，
   * 資料庫才是現在啟用哪幾個分類的真相。讀常數的話，
   * 停用一個分類之後它還會出現在篩選器上，按下去就是零筆結果。
   */
  categories: readonly PortfolioCategory[];
  /** 目前篩選結果數量，顯示於篩選列旁 */
  resultCount: number;
}

const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as PortfolioProjectType[];

export function PortfolioFilter({ category, projectType, resultCount, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(category);
  const [activeType, setActiveType] = useState<ProjectTypeFilter>(projectType);

  // 上一頁／下一頁或外部連結進入時，server 會以新的 searchParams 重新渲染。
  // 在 render 期間由 props 校正 state，比 useEffect 少一次多餘 paint。
  const [syncedCategory, setSyncedCategory] = useState(category);
  if (syncedCategory !== category) {
    setSyncedCategory(category);
    setActiveCategory(category);
  }
  const [syncedType, setSyncedType] = useState(projectType);
  if (syncedType !== projectType) {
    setSyncedType(projectType);
    setActiveType(projectType);
  }

  const commit = useCallback(
    (nextCategory: CategoryFilter, nextType: ProjectTypeFilter) => {
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );

      // 預設值不留在網址上（與 Home Goal 的 unsure 同樣處理）
      if (nextCategory === ALL_CATEGORIES) params.delete("category");
      else params.set("category", nextCategory);

      if (nextType === ALL_PROJECT_TYPES) params.delete("type");
      else params.set("type", nextType);

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });

      track("portfolio_filtered", { category: nextCategory, projectType: nextType });
    },
    [pathname, router],
  );

  const chooseCategory = (next: CategoryFilter) => {
    setActiveCategory(next);
    commit(next, activeType);
  };

  const chooseType = (next: ProjectTypeFilter) => {
    setActiveType(next);
    commit(activeCategory, next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="sr-only">依分類篩選</h2>
        {/*
         * 行動裝置橫向捲動（Spec §8.7）。
         * -mx + px 讓 chips 可捲到螢幕邊緣，同時保留內容區的左右留白。
         */}
        <ul className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 lg:-mx-gutter-lg lg:flex-wrap lg:px-gutter-lg lg:overflow-visible">
          {[{ slug: ALL_CATEGORIES, name: "All" }, ...categories].map((item) => {
            const active = item.slug === activeCategory;
            return (
              <li key={item.slug} className="shrink-0">
                <button
                  type="button"
                  onClick={() => chooseCategory(item.slug)}
                  aria-pressed={active}
                  className={`text-body-sm rounded-pill border px-4 py-2 whitespace-nowrap transition-colors ${
                    active
                      ? "border-brand-ink bg-brand-ink text-brand-on-ink"
                      : "border-brand-line hover:border-brand-ink"
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-caption text-brand-muted">來源</h2>
          {[
            { id: ALL_PROJECT_TYPES as ProjectTypeFilter, label: "不限" },
            ...PROJECT_TYPES.map((id) => ({
              id: id as ProjectTypeFilter,
              label: PROJECT_TYPE_LABELS[id],
            })),
          ].map((item) => {
            const active = item.id === activeType;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseType(item.id)}
                aria-pressed={active}
                className={`text-caption rounded-pill border px-3 py-1.5 transition-colors ${
                  active ? "border-brand-ink text-brand-ink" : "border-brand-line text-brand-muted"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* 結果數以 aria-live 播報，鍵盤與螢幕閱讀器使用者才知道篩選生效了 */}
        <p className="text-caption text-brand-muted" aria-live="polite">
          共 {resultCount} 件
        </p>
      </div>
    </div>
  );
}
