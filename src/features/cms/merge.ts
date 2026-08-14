import { HOME_GOALS, type HomeGoal } from "@/config/home-goals";

import type { GoalsDocument } from "./registry";

/**
 * 把 CMS 的文案疊到程式碼的行為上（CR-004 / Phase B BI）
 *
 * ── 為什麼不直接用 CMS 那份清單 ────────────────────────────────
 *
 * Goal Selector 是首頁的 Context Controller：選了之後 Selected Work、
 * Template Experience 與 Services 三處要跟著反應，而那些對應
 * （`workCategories`、`serviceId`）留在 `config/home-goals.ts`。
 *
 * 直接用 CMS 那份清單的話，有人在後台刪掉一個項目，
 * 結果是 `?goal=brand` 這個網址仍然有效、篩選仍然會發生，
 * 但**畫面上沒有任何按鈕對應它**——使用者看到一個篩過的首頁
 * 卻找不到是哪個條件造成的，也沒辦法取消。
 *
 * 所以順序與筆數由程式碼決定，CMS 只換字。
 * 後台刪掉一項的效果是「那一項回到程式碼裡的預設文案」，
 * 不是「那一項消失」——而那是一個不會壞掉的失敗方式。
 */

export interface GoalCopy {
  id: HomeGoal;
  label: string;
  description: string;
}

export function mergeGoalCopy(document: GoalsDocument): GoalCopy[] {
  const overrides = new Map(document.items.map((item) => [item.id, item]));

  return HOME_GOALS.map((goal) => {
    const override = overrides.get(goal.id);
    return {
      id: goal.id,
      label: override?.label ?? goal.label,
      description: override?.description ?? goal.description,
    };
  });
}
