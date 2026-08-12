"use client";

import { type Lead, leadSchema } from "./schema";

/**
 * Agent Lead Context 的跨頁保存（Spec §30）
 *
 * §30 的出口條件是「從 Agent / Template / Portfolio 任一入口進入都不需重填」。
 * Agent 那條線的難處是：對話在首頁、表單在 /start，兩個頁面之間
 * 除了網址什麼都不共用。
 *
 * 用 sessionStorage 與預覽狀態同一套做法（見 website-engine/preview-context.tsx）：
 *   - 只存這一次瀏覽，關掉分頁就沒了。這是**別人的個資**，
 *     不該在他的電腦上放到下次
 *   - 讀回來一律過 schema。使用者可以直接編輯 storage，
 *     那是不可信輸入
 *
 * ⚠️ 這裡存的是「Agent 問到的東西」，不是已經送出的 lead。
 * 已經送出的那份在資料庫裡，不會、也不該回到瀏覽器。
 */

const STORAGE_KEY = "1page:lead-context";

export function saveLeadContext(lead: Lead): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
  } catch {
    // 無痕模式等情境下會拋例外。帶入是加分項，不該讓表單掛掉。
  }
}

export function readLeadContext(): Lead | null {
  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const result = leadSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function clearLeadContext(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
