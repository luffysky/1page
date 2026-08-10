import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * RLS 邊界驗證（Spec §41）
 *
 * > 不要只靠前端隱藏按鈕。
 *
 * 這組測試模擬「有人直接拿 anon key 打 REST API」的情境——
 * 不經過我們的任何前端程式碼。如果草稿在這裡讀得到，
 * 前端藏得再乾淨都沒有意義。
 *
 * 刻意不納入 `pnpm test`：它需要一個跑起來的資料庫。
 * 用 `pnpm test:db` 執行，並列為 2A Gate 的必要項目——
 * 安全測試被靜默跳過，比沒有測試更危險。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DRAFT_SLUG = "unpublished-draft";
const PUBLISHED_SLUG = "interior-studio";

describe("Portfolio RLS", () => {
  beforeAll(() => {
    if (!url || !anonKey) {
      throw new Error(
        "缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY。\n" +
          "本機開發：pnpm db:start 後把印出的值寫進 .env.local。\n" +
          "這個測試不會靜默跳過——安全邊界沒驗證過就是沒驗證過。",
      );
    }
  });

  const anon = () => createClient(url!, anonKey!, { auth: { persistSession: false } });

  it("匿名讀得到已發布作品", async () => {
    const { data, error } = await anon()
      .from("portfolio_projects")
      .select("slug,status")
      .eq("slug", PUBLISHED_SLUG);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.status).toBe("published");
  });

  it("匿名讀不到草稿", async () => {
    const { data, error } = await anon()
      .from("portfolio_projects")
      .select("slug")
      .eq("slug", DRAFT_SLUG);

    // RLS 過濾的表現是「查得到零筆」而非報錯——這正是我們要的：
    // 不洩漏「有一筆你看不到的資料存在」這件事本身。
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("匿名列出作品時完全不含任何未發布項目", async () => {
    const { data, error } = await anon().from("portfolio_projects").select("slug,status");

    expect(error).toBeNull();
    expect(data?.every((row) => row.status === "published")).toBe(true);
  });

  it("匿名讀不到草稿的媒體", async () => {
    const { data, error } = await anon().from("portfolio_media").select("id,alt");

    expect(error).toBeNull();
    expect(data?.some((row) => row.alt?.includes("草稿"))).toBe(false);
  });

  it("匿名無法從關聯表反推未發布作品的存在", async () => {
    const { data: projects } = await anon().from("portfolio_projects").select("id");
    const visibleIds = new Set((projects ?? []).map((row) => row.id));

    const { data: links, error } = await anon()
      .from("portfolio_project_categories")
      .select("project_id");

    expect(error).toBeNull();
    expect((links ?? []).every((row) => visibleIds.has(row.project_id))).toBe(true);
  });

  it("匿名無法新增作品", async () => {
    const { error } = await anon()
      .from("portfolio_projects")
      .insert({ slug: "rls-probe", title: "應該被拒絕", project_type: "demo" });

    expect(error).not.toBeNull();
  });

  it("匿名無法修改已發布作品", async () => {
    const { data, error } = await anon()
      .from("portfolio_projects")
      .update({ title: "被竄改" })
      .eq("slug", PUBLISHED_SLUG)
      .select();

    // 沒有 update policy 時，RLS 讓它影響零列（而非報錯）
    expect(data ?? []).toEqual([]);
    if (error) expect(error).not.toBeNull();
  });

  it("匿名無法刪除作品", async () => {
    const { data } = await anon()
      .from("portfolio_projects")
      .delete()
      .eq("slug", PUBLISHED_SLUG)
      .select();

    expect(data ?? []).toEqual([]);

    const { data: still } = await anon()
      .from("portfolio_projects")
      .select("slug")
      .eq("slug", PUBLISHED_SLUG);
    expect(still).toHaveLength(1);
  });

  it("匿名讀不到 admin 名單", async () => {
    const { data } = await anon().from("admin_users").select("user_id");
    expect(data ?? []).toEqual([]);
  });

  it("分類公開可讀（篩選 UI 需要）", async () => {
    const { data, error } = await anon().from("portfolio_categories").select("slug");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(5);
  });
});
