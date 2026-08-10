import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PortfolioProjectType, PortfolioStatus } from "@/types/database";

/**
 * 後台的作品資料存取。
 *
 * 與公開端 `features/portfolio/supabase-repository.ts` 分開，因為兩者的
 * 資料需求本來就不同：公開端只看得到已發布、且不需要 status / 排序等欄位；
 * 後台要看全部、要能寫入。
 *
 * ⚠️ 一樣使用帶 cookie 的 anon client，**不是** service role。
 * 後台之所以能讀到草稿、能寫入，是因為登入者的 uid 在 `admin_users` 名單上，
 * RLS 因此放行——不是因為換了一把繞過所有規則的鑰匙。
 *
 * 這代表：即使這裡的程式碼有漏洞，非後台人員也拿不到草稿。
 * 用 service role 就沒有這層保障了。
 */

export interface AdminProjectRow {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  summary: string | null;
  project_type: PortfolioProjectType;
  status: PortfolioStatus;
  featured: boolean;
  sort_order: number;
  updated_at: string;
  published_at: string | null;
}

export async function listAllProjects(): Promise<AdminProjectRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(
      "id, slug, title, kicker, summary, project_type, status, featured, sort_order, updated_at, published_at",
    )
    .order("sort_order", { ascending: true })
    .returns<AdminProjectRow[]>();

  if (error) throw new Error(`後台作品列表讀取失敗：${error.message}`);
  return data ?? [];
}

export async function getProjectById(id: string): Promise<AdminProjectRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(
      "id, slug, title, kicker, summary, project_type, status, featured, sort_order, updated_at, published_at",
    )
    .eq("id", id)
    .maybeSingle<AdminProjectRow>();

  if (error) throw new Error(`後台作品讀取失敗：${error.message}`);
  return data;
}

/** 統計卡片用。刻意只算數量，不把整份資料撈回來 */
export async function getProjectCounts() {
  const supabase = await createSupabaseServerClient();

  const [all, published, draft, featured] = await Promise.all([
    supabase.from("portfolio_projects").select("id", { count: "exact", head: true }),
    supabase
      .from("portfolio_projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("portfolio_projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase
      .from("portfolio_projects")
      .select("id", { count: "exact", head: true })
      .eq("featured", true),
  ]);

  return {
    all: all.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    featured: featured.count ?? 0,
  };
}

export interface AdminMediaRow {
  id: string;
  type: "image" | "video" | "pdf" | "embed" | "external";
  url: string;
  alt: string | null;
  role: string;
  sort_order: number;
}

export async function listProjectMedia(projectId: string): Promise<AdminMediaRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("portfolio_media")
    .select("id, type, url, alt, role, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<AdminMediaRow[]>();

  if (error) throw new Error(`媒體讀取失敗：${error.message}`);
  return data ?? [];
}
