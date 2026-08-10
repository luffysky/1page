"use client";

import { PortfolioLayout } from "@/components/portfolio/portfolio-layout";
import { useHomeGoal } from "@/features/home/goal-context";
import { filterByGoal, type PortfolioListItem } from "@/features/portfolio/repository";

/**
 * Selected Work（Spec §8.11 / Plan §6.1）
 *
 * 由 server 一次帶入全部 featured 作品，篩選在 client 完成：
 * 切 goal 時畫面立即反應，不必等 RSC 回來（Plan §6.2）。
 *
 * 篩選規則與 repository 共用 filterByGoal，避免 server 與 client 兩套邏輯分岔。
 */
export function SelectedWork({ items }: { items: PortfolioListItem[] }) {
  const { goal, definition, isFiltering } = useHomeGoal();
  const visible = filterByGoal(items, goal);

  if (visible.length === 0) {
    return (
      <div className="border-brand-line rounded-lg border border-dashed p-10 text-center">
        <p className="text-body text-brand-muted">
          目前還沒有「{definition.label.replace(/^我要/, "")}」相關的公開作品。
        </p>
        <p className="text-body-sm text-brand-muted mt-2">
          不代表做不到——直接問 AI 顧問，我們會告訴你可以先看哪個方向。
        </p>
      </div>
    );
  }

  return (
    <>
      {isFiltering ? (
        <p className="text-body-sm text-brand-muted mb-6">
          已依「{definition.label}」篩選，共 {visible.length} 件。
        </p>
      ) : null}
      <PortfolioLayout items={visible} />
    </>
  );
}
