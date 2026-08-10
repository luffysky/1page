import { hasSupabaseConfig } from "@/lib/supabase/client";

import { inMemoryPortfolioRepository } from "./in-memory-repository";
import type { PortfolioRepository } from "./repository";
import { supabasePortfolioRepository } from "./supabase-repository";

/**
 * 作品資料來源的唯一入口。頁面一律從這裡取得 repository。
 *
 * ⚠️ 缺少 Supabase 設定時的行為是刻意分環境的：
 *
 *   development       退回 in-memory 並在主控台明確警告
 *                     （沒有憑證的人 clone 下來仍能跑起來看畫面）
 *   production 執行期  直接拋錯
 *
 * 在 production 靜默退回假資料是最糟的失敗模式：網站看起來完全正常，
 * 只是展示的全是不存在的作品。寧可整個頁面掛掉，也不要對訪客說謊。
 *
 * ── 為什麼要區分「建置期」 ──────────────────────────────────
 * 第一版沒有 `isBuildPhase` 判斷，結果 Zeabur 部署直接失敗：
 * `next build` 會預先產生某些路由，那些路由呼叫到這裡，
 * 而建置容器沒有資料庫設定 → 整個部署掛掉。
 *
 * 建置期拋錯擋掉的不是「展示假資料」，而是「部署本身」——
 * 那是過度反應。真正需要守住的是**執行期**：使用者實際看到的畫面。
 *
 * 現在建置期缺設定會退回種子資料並警告；那些內容不會出現在使用者面前，
 * 因為所有真正呈現作品的路由都是動態渲染的。
 */
function isBuildPhase(): boolean {
  // Next.js 在 `next build` 期間設定此變數
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getPortfolioRepository(): PortfolioRepository {
  if (hasSupabaseConfig()) return supabasePortfolioRepository;

  if (process.env.NODE_ENV === "production" && !isBuildPhase()) {
    throw new Error(
      "production 執行期缺少 Supabase 設定。拒絕退回種子資料——" +
        "那會讓網站展示不存在的作品，且外觀完全正常。" +
        "請設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。",
    );
  }

  console.warn(
    isBuildPhase()
      ? "[portfolio] 建置期未設定 Supabase，使用種子資料。執行期缺設定仍會拋錯。"
      : "[portfolio] 未設定 Supabase，暫時使用 in-memory 種子資料。正式環境不會允許這個退路。",
  );
  return inMemoryPortfolioRepository;
}

export type { PortfolioRepository } from "./repository";
