/**
 * 客戶的型別與標籤（CR-004 / Phase B BD）
 *
 * ── 為什麼與 clients.ts 分開 ──────────────────────────────────
 *
 * `clients.ts` 匯入 `server-only`（它會碰資料庫）。而表單是
 * client component，需要的只有型別與中文標籤——
 * 從那個檔案匯入會讓整份伺服器程式碼被拉進瀏覽器端的相依圖，
 * 而 `server-only` 正是為了讓那件事**在建置時就失敗**。
 *
 * （這次就是這樣被擋下來的：build 直接紅，不是上線後才發現。）
 */

export type ClientStatus = "prospect" | "active" | "past";
export type ClientKind = "company" | "individual";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "潛在",
  active: "合作中",
  past: "已結束",
};

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  company: "公司",
  individual: "個人",
};

export interface ClientRow {
  id: string;
  name: string;
  kind: ClientKind;
  industry: string | null;
  status: ClientStatus;
  source: string | null;
  note: string | null;
  updatedAt: string;
}

export interface ClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
}

export interface ClientNote {
  id: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface ClientActivity {
  id: string;
  kind: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
