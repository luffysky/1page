/**
 * 報價與成交的型別與標籤（CR-004 / Phase B BE）
 *
 * 與 `client-types.ts` 同樣的理由：這裡不匯入 `server-only`，
 * 所以表單那些 client component 用得到。
 */

export type DealStage = "inquiry" | "quoted" | "negotiating" | "won" | "lost";

/**
 * 階段的**順序有意義**：畫面上要照這個順序排。
 *
 * 用一個陣列而不是物件的鍵順序：物件的鍵順序在規格上是有保證的，
 * 但那份保證很細（整數鍵會被提前），而這裡全部是字串——
 * 明寫一個陣列比依賴那條規則好懂。
 */
export const DEAL_STAGES: DealStage[] = ["inquiry", "quoted", "negotiating", "won", "lost"];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  inquiry: "詢問",
  quoted: "已報價",
  negotiating: "洽談中",
  won: "成交",
  lost: "未成交",
};

/** 還在進行中的階段。看板與「要跟進什麼」用得到 */
export const OPEN_STAGES: DealStage[] = ["inquiry", "quoted", "negotiating"];

export interface DealRow {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  stage: DealStage;
  amount: number | null;
  currency: string;
  expectedClose: string | null;
  lostReason: string | null;
  updatedAt: string;
}

export interface DealItem {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

/**
 * 報價總額。
 *
 * ⚠️ 用整數的「分」算，最後才除回來。
 *
 * `0.1 + 0.2 !== 0.3` 在報價單上的表現是「明細加起來與總額差一塊」，
 * 而那種錯誤客戶一定會發現。資料庫那側用 numeric，
 * JavaScript 這側沒有 decimal 型別，所以自己轉成整數算。
 */
export function dealItemsTotal(items: readonly DealItem[]): number {
  const cents = items.reduce(
    (total, item) => total + Math.round(item.quantity * item.unitPrice * 100),
    0,
  );
  return cents / 100;
}

/** 金額顯示。沒有金額時說「未報價」，不是顯示 0 */
export function formatAmount(amount: number | null, currency = "TWD"): string {
  if (amount === null) return "未報價";
  return `${currency} ${amount.toLocaleString("zh-TW", { minimumFractionDigits: 0 })}`;
}
