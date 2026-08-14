/**
 * 接案專案與工時的型別與標籤（CR-004 / Phase B BF）
 *
 * 與 `client-types.ts` / `deal-types.ts` 同樣的理由不匯入 `server-only`：
 * 表單那些 client component 用得到。
 */

export type EngagementStatus = "planning" | "active" | "paused" | "delivered" | "closed";

/** 順序有意義：畫面上照這個排 */
export const ENGAGEMENT_STATUSES: EngagementStatus[] = [
  "planning",
  "active",
  "paused",
  "delivered",
  "closed",
];

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  planning: "籌備中",
  active: "進行中",
  paused: "暫停",
  delivered: "已交付",
  closed: "已結案",
};

/** 還在手上的。「現在到底同時接了幾個案」用這個算 */
export const OPEN_ENGAGEMENT_STATUSES: EngagementStatus[] = ["planning", "active", "paused"];

export interface EngagementRow {
  id: string;
  clientId: string;
  clientName: string;
  dealId: string | null;
  title: string;
  status: EngagementStatus;
  startedOn: string | null;
  dueOn: string | null;
  deliveredOn: string | null;
  portfolioProjectId: string | null;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  dueOn: string | null;
  doneOn: string | null;
  paymentRatio: number | null;
  sortOrder: number;
}

export interface TimeEntry {
  id: string;
  workedOn: string;
  minutes: number;
  note: string | null;
}

/**
 * 分鐘 → 給人看的字。
 *
 * ⚠️ 不寫成「3.33 小時」。
 *
 * 資料庫存分鐘就是為了避開「0.30 到底是 18 分還是 30 分」這個誤會，
 * 顯示時再換回小數等於把那個誤會請回來——而它在對帳時會變成真的錢。
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小時` : `${hours} 小時 ${rest} 分`;
}

export function totalMinutes(entries: readonly TimeEntry[]): number {
  return entries.reduce((total, entry) => total + entry.minutes, 0);
}

/**
 * 「1:30」「90」「1.5h」都收。
 *
 * 這裡刻意寬鬆：要求使用者每次心算成分鐘，實際發生的事是他不記——
 * 而沒記的工時等於沒發生過。回傳 null 代表看不懂，由呼叫端說話。
 */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  // 1:30 / 1：30（全形冒號——中文輸入法下很常打出來）
  const colon = /^(\d{1,2})[:：](\d{1,2})$/.exec(value);
  if (colon) {
    const minutes = Number(colon[1]) * 60 + Number(colon[2]);
    return Number(colon[2]) < 60 && minutes > 0 ? minutes : null;
  }

  // 1.5h / 1.5 小時
  const hours = /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|小時)$/.exec(value);
  if (hours) {
    const minutes = Math.round(Number(hours[1]) * 60);
    return minutes > 0 ? minutes : null;
  }

  // 90 / 90m / 90 分
  const plain = /^(\d+)\s*(?:m|min|分|分鐘)?$/.exec(value);
  if (plain) {
    const minutes = Number(plain[1]);
    return minutes > 0 ? minutes : null;
  }

  return null;
}
