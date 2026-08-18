import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * 每一張開了 RLS 的表，匿名到底讀不讀得到（0818 收尾稽核）
 *
 * ── 為什麼要有這一份 ──────────────────────────────────────────
 *
 * 收尾清查時數出來：27 張表開了 RLS，而 db 測試只驗過其中 7 張。
 * 另外 20 張（clients、deals、invoices、time_entries、cms_documents……）
 * 的政策從來沒有任何測試去敲過——它們可能全都是對的，
 * 但「可能是對的」與「驗過」是兩件事。
 *
 * CLAUDE.md 記著同一種錯的另一面：
 *
 * > Security 稽核 21 項全綠，而整個專案一行 CSP 都沒有。
 * > 沒有任何一項在問這件事。一份稽核只證明它問過的問題。
 *
 * ── 問法是反過來的 ────────────────────────────────────────────
 *
 * 不列「哪幾張表要擋住匿名」，而是**去資料庫問有哪些表開了 RLS**，
 * 然後逐一敲。新加一張表、忘了寫政策，這裡自己會發現——
 * 逐一列舉的清單則要靠人記得補。
 *
 * 讀得到的必須寫進 `PUBLIC_BY_DESIGN` 並附理由。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 匿名**讀得到**是設計如此的表。每一張都要說得出為什麼。
 *
 * ⚠️ 「它沒有敏感資料」不是理由。理由要說明**誰靠這條路讀它**。
 */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  portfolio_projects: "前台作品列表要讀（政策只放行 status = published）",
  portfolio_categories: "前台的分類篩選要讀",
  portfolio_tags: "前台的標籤篩選要讀",
  portfolio_project_categories: "作品與分類的關聯，前台篩選要讀",
  portfolio_project_tags: "作品與標籤的關聯，前台篩選要讀",
  portfolio_media: "已發布作品的圖片，前台要讀",
  cms_documents: "全站文案與版面，未登入的訪客看首頁就是在讀它",
};

/**
 * 匿名讀得到、但那是**只讀得到公開的那一部分**的表。
 *
 * 這幾張要另外驗「非公開的那些讀不到」——那件事既有的測試已經在做，
 * 這裡只負責點名，避免它們被當成「完全公開」而漏掉。
 */
const PARTIALLY_PUBLIC = new Set(["portfolio_projects", "portfolio_media"]);

/**
 * 政策的 `using` 條件是**無條件 true**（大門敞開）的表。
 *
 * ⚠️ 這一份與 PUBLIC_BY_DESIGN 不一樣，而且比它重要。
 *
 * 上面那份問的是「匿名現在讀不讀得到資料」——**空的表一定通過**，
 * 因為讀不到零筆與被擋下來長得一模一樣。一張政策寫成 `true` 的
 * 空表會安靜地過關，等到有資料的那天才開始漏。
 *
 * 這一份改問政策本身，與資料多寡無關。
 */
const OPEN_DOOR_BY_DESIGN: Record<string, string> = {
  cms_documents: "全站文案與版面。未登入的訪客打開首頁就是在讀它，沒有條件可加",
  portfolio_tags: "標籤名稱本身就是要顯示在前台篩選器上的",
};

async function sql(query: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`SQL 失敗：${await response.text()}`);
  return response.json() as Promise<Record<string, unknown>[]>;
}

let tables: string[] = [];

describe("RLS 覆蓋率", () => {
  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) {
      throw new Error(
        "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY。\n" +
          "這個測試不會靜默跳過——安全邊界沒驗證過就是沒驗證過。",
      );
    }

    const rows = await sql(`
      select tablename from pg_tables
      where schemaname = 'public' and rowsecurity = true
      order by tablename
    `);
    tables = rows.map((row) => String(row.tablename));
  });

  const anon = () => createClient(url!, anonKey!, { auth: { persistSession: false } });

  it("問得到開了 RLS 的表（守衛本身沒有空轉）", () => {
    /*
     * ⚠️ 少了這一條，查詢寫錯時 tables 會是空陣列，
     * 下面那一條會「通過」——一份掃不到東西的稽核永遠是綠的。
     */
    expect(tables.length).toBeGreaterThan(20);
  });

  it("⚠️ 每一張表：匿名讀不到，或列在 PUBLIC_BY_DESIGN 裡", async () => {
    const leaks: string[] = [];

    for (const table of tables) {
      const { data, error } = await anon().from(table).select("*").limit(1);

      // 錯誤（權限不足、表不存在於 PostgREST）＝讀不到，這是要的結果
      const readable = !error && (data?.length ?? 0) > 0;
      if (readable && !(table in PUBLIC_BY_DESIGN)) leaks.push(table);
    }

    expect(
      leaks,
      "這幾張表匿名讀得到，而且沒有寫進 PUBLIC_BY_DESIGN。要嘛政策漏了，要嘛清單漏了",
    ).toEqual([]);
  });

  it("PUBLIC_BY_DESIGN 裡的每一張都還存在，而且真的讀得到", async () => {
    /*
     * 兩個方向都要驗：
     *   名字過期了 → 下一次有人建一張同名的表，它會自動被放行
     *   讀不到了   → 前台某一塊已經壞了，只是還沒有人打開那一頁
     */
    const stale = Object.keys(PUBLIC_BY_DESIGN).filter((table) => !tables.includes(table));
    expect(stale, "PUBLIC_BY_DESIGN 裡有已經不存在（或沒開 RLS）的表").toEqual([]);

    for (const table of Object.keys(PUBLIC_BY_DESIGN)) {
      const { error } = await anon().from(table).select("*").limit(1);
      expect(error, `${table} 匿名讀不到了——前台有東西已經壞了`).toBeNull();
    }
  });

  it("部分公開的那幾張，公開的界線仍然成立", async () => {
    // 這裡只點名，細節在 rls.test.ts。點名是為了不讓它們被當成「完全公開」
    for (const table of PARTIALLY_PUBLIC) {
      expect(Object.keys(PUBLIC_BY_DESIGN)).toContain(table);
    }

    const { data } = await anon().from("portfolio_projects").select("status");
    const statuses = new Set((data ?? []).map((row) => row.status));
    expect([...statuses], "匿名看得到未發布的作品").toEqual(["published"]);
  });

  it("⚠️ 沒有哪一張表的門是無條件敞開的（這一條不看資料多寡）", async () => {
    /*
     * 上面那條「匿名讀不到」對**空的表**永遠是綠的——
     * 讀到零筆與被擋下來長得一模一樣。新加一張表、政策寫成 `true`、
     * 而它還沒有資料，那條測試不會說任何話。
     *
     * 這一條去問政策本身，所以空表一樣驗得到。
     */
    const policies = await sql(`
      select tablename, policyname, cmd, coalesce(qual, 'true') as qual
      from pg_policies
      where schemaname = 'public' and cmd in ('SELECT', 'ALL')
    `);

    expect(policies.length, "問不到政策——這條守衛在空轉").toBeGreaterThan(20);

    const openDoors = policies
      .filter((policy) => String(policy.qual).trim().toLowerCase() === "true")
      .map((policy) => `${policy.tablename}.${policy.policyname}`)
      .filter((name) => !(name.split(".")[0]! in OPEN_DOOR_BY_DESIGN));

    expect(
      openDoors,
      "這幾條政策沒有任何條件——任何人都讀得到整張表。要嘛加條件，要嘛寫進 OPEN_DOOR_BY_DESIGN",
    ).toEqual([]);
  });

  it("OPEN_DOOR_BY_DESIGN 裡的每一張都還真的是敞開的", async () => {
    // 名字過期了的話，下一次有人建一張同名的表會自動被放行
    const policies = await sql(`
      select tablename, coalesce(qual, 'true') as qual
      from pg_policies
      where schemaname = 'public' and cmd in ('SELECT', 'ALL')
    `);
    const open = new Set(
      policies
        .filter((policy) => String(policy.qual).trim().toLowerCase() === "true")
        .map((policy) => String(policy.tablename)),
    );

    for (const table of Object.keys(OPEN_DOOR_BY_DESIGN)) {
      expect(open.has(table), `${table} 已經不是無條件公開了，可以從清單裡拿掉`).toBe(true);
    }
  });

  it("每一條例外都寫得出理由", () => {
    for (const [table, reason] of Object.entries({
      ...PUBLIC_BY_DESIGN,
      ...OPEN_DOOR_BY_DESIGN,
    })) {
      expect(reason.length, `${table} 的理由太短，說不出誰靠這條路讀它`).toBeGreaterThan(8);
    }
  });
});
