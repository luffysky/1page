import { hasSupabaseConfig } from "@/lib/supabase/client";

import { inMemoryPortfolioRepository } from "./in-memory-repository";
import type { PortfolioRepository } from "./repository";
import { supabasePortfolioRepository } from "./supabase-repository";

/**
 * 作品資料來源的唯一入口。頁面一律從這裡取得 repository。
 *
 * ⚠️ 缺少 Supabase 設定時的行為是刻意分環境的：
 *
 *   development  退回 in-memory 並在主控台明確警告
 *                （沒有憑證的人 clone 下來仍能跑起來看畫面）
 *   production   直接拋錯
 *
 * 在 production 靜默退回假資料是最糟的失敗模式：網站看起來完全正常，
 * 只是展示的全是不存在的作品。寧可整個頁面掛掉，也不要對訪客說謊。
 */
export function getPortfolioRepository(): PortfolioRepository {
  if (hasSupabaseConfig()) return supabasePortfolioRepository;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "production 環境缺少 Supabase 設定。拒絕退回種子資料——" +
        "那會讓網站展示不存在的作品且外觀完全正常。請設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。",
    );
  }

  console.warn(
    "[portfolio] 未設定 Supabase，暫時使用 in-memory 種子資料。正式環境不會允許這個退路。",
  );
  return inMemoryPortfolioRepository;
}

export type { PortfolioRepository } from "./repository";
