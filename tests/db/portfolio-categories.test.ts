import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { PORTFOLIO_CATEGORIES } from "@/config/portfolio-categories";
import { supabasePortfolioRepository } from "@/features/portfolio/supabase-repository";

/**
 * 分類清單：資料庫與種子不能分岔
 *
 * ── 這條在守什麼 ──────────────────────────────────────────────
 *
 * 2A 建了 `portfolio_categories` 並灌了 11 筆種子，2D 的註解寫著
 * 「換上真實資料庫後改由 DB 供應」——**而那件事一直沒做**。
 * 畫面上的篩選器讀的是 `config/portfolio-categories.ts` 的陣列，
 * 資料表則從建立起就沒有任何讀取端（`active` 欄位也一樣）。
 *
 * 兩份內容剛好一樣，所以看不出來。但沒有任何機制保證它們維持一樣。
 *
 * 現在畫面改讀資料庫了，程式碼那份退成種子——而它還有一個讀取端：
 * Agent 的 `search_portfolio` 工具，它的分類 enum 是模組載入時算好的
 * JSON Schema，沒辦法每次請求都查資料庫。
 *
 * 所以「種子 == 資料庫」這件事現在是一條**必須成立的前提**，
 * 而這條測試就是那個前提的守衛。分岔的表現是
 * 「AI 說得出一個篩選器上沒有的分類」——沒有任何地方會報錯。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("分類清單", () => {
  beforeAll(() => {
    // 不靜默跳過：分類對不對是畫面與 AI 都會用到的事實
    if (!url || !serviceKey) {
      throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("資料庫裡啟用的分類，與程式碼的種子完全一致", async () => {
    const fromDb = await supabasePortfolioRepository.listCategories();

    expect(
      fromDb,
      "資料庫與種子分岔了。改分類要同時改 seed.sql 與 config/portfolio-categories.ts",
    ).toEqual(
      PORTFOLIO_CATEGORIES.map((category) => ({ slug: category.slug, name: category.name })),
    );
  });

  it("停用的分類不會被讀出來（擋它的是 RLS，不是查詢條件）", async () => {
    /*
     * 這條真的去停用一筆再讀一次，最後還原。
     *
     * ⚠️ 擋住它的是 policy `using (active or is_admin())`，
     * 不是查詢裡的條件——我原本在 `listCategories` 寫了
     * `.eq("active", true)`，把那一行拿掉之後這條**照樣綠**，
     * 那一行從頭到尾沒有擋過任何東西。
     *
     * 所以這條驗的是資料庫的邊界。要驗應用層有沒有寫對條件，
     * 得換一個沒有 RLS 保護的情境，而這裡沒有那種情境。
     */
    const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    const victim = PORTFOLIO_CATEGORIES.at(-1)!.slug;

    await admin.from("portfolio_categories").update({ active: false }).eq("slug", victim);

    try {
      const slugs = (await supabasePortfolioRepository.listCategories()).map((c) => c.slug);
      expect(slugs, `停用了 ${victim}，它卻還在清單裡`).not.toContain(victim);
    } finally {
      await admin.from("portfolio_categories").update({ active: true }).eq("slug", victim);
    }
  });

  it("排序照 sort_order，不是照建立時間", async () => {
    // 篩選器上的順序是設計過的（Web 在最前面），亂掉不會報錯，只是變得難用
    const fromDb = await supabasePortfolioRepository.listCategories();
    expect(fromDb[0]?.slug).toBe(PORTFOLIO_CATEGORIES[0]!.slug);
  });
});
