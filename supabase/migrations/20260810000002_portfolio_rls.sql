-- ============================================================================
-- Portfolio RLS（Spec §41）
--
-- > 不要只靠前端隱藏按鈕。
--
-- 邊界設計：
--   匿名 / 一般登入者   只能讀 status = 'published' 的作品及其媒體
--   admin              完全存取
--
-- 未發布的草稿在資料庫層就讀不到，不是靠前端不去查。
-- 這代表即使有人直接拿 anon key 打 REST API，也拿不到草稿。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Admin allowlist
--
-- Spec §41 允許 admin role 或 allowlist。此處用 allowlist table：
-- 它可稽核（看得到誰是 admin、何時加入）、可撤銷，且不需要動 JWT claim。
-- ---------------------------------------------------------------------------
create table admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- admin 名單本身只有 admin 看得到，避免暴露誰是管理者
create policy admin_users_select_self_or_admin on admin_users
  for select using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- is_admin()
--
-- security definer 讓它能繞過 admin_users 自身的 RLS 做查詢，
-- 否則會遞迴。search_path 設空並全限定名稱，避免 search_path 注入。
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- portfolio_projects
-- ---------------------------------------------------------------------------
alter table portfolio_projects enable row level security;

create policy portfolio_projects_public_read on portfolio_projects
  for select using (status = 'published');

create policy portfolio_projects_admin_read on portfolio_projects
  for select using (is_admin());

create policy portfolio_projects_admin_write on portfolio_projects
  for insert with check (is_admin());

create policy portfolio_projects_admin_update on portfolio_projects
  for update using (is_admin()) with check (is_admin());

create policy portfolio_projects_admin_delete on portfolio_projects
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- portfolio_media
--
-- 媒體的可見性跟隨其作品：作品未發布，媒體也不該讀得到。
-- ---------------------------------------------------------------------------
alter table portfolio_media enable row level security;

create policy portfolio_media_public_read on portfolio_media
  for select using (
    exists (
      select 1 from portfolio_projects p
      where p.id = portfolio_media.project_id and p.status = 'published'
    )
  );

create policy portfolio_media_admin_read on portfolio_media
  for select using (is_admin());

create policy portfolio_media_admin_write on portfolio_media
  for insert with check (is_admin());

create policy portfolio_media_admin_update on portfolio_media
  for update using (is_admin()) with check (is_admin());

create policy portfolio_media_admin_delete on portfolio_media
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- 分類與標籤：公開可讀（篩選 UI 需要），僅 admin 可寫
-- ---------------------------------------------------------------------------
alter table portfolio_categories enable row level security;

create policy portfolio_categories_public_read on portfolio_categories
  for select using (active or is_admin());

create policy portfolio_categories_admin_write on portfolio_categories
  for all using (is_admin()) with check (is_admin());

alter table portfolio_tags enable row level security;

create policy portfolio_tags_public_read on portfolio_tags
  for select using (true);

create policy portfolio_tags_admin_write on portfolio_tags
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Join tables
--
-- 同樣跟隨作品的發布狀態——否則可從關聯表反推出未發布作品的存在與分類。
-- ---------------------------------------------------------------------------
alter table portfolio_project_categories enable row level security;

create policy portfolio_project_categories_public_read on portfolio_project_categories
  for select using (
    exists (
      select 1 from portfolio_projects p
      where p.id = portfolio_project_categories.project_id and p.status = 'published'
    )
  );

create policy portfolio_project_categories_admin_all on portfolio_project_categories
  for all using (is_admin()) with check (is_admin());

alter table portfolio_project_tags enable row level security;

create policy portfolio_project_tags_public_read on portfolio_project_tags
  for select using (
    exists (
      select 1 from portfolio_projects p
      where p.id = portfolio_project_tags.project_id and p.status = 'published'
    )
  );

create policy portfolio_project_tags_admin_all on portfolio_project_tags
  for all using (is_admin()) with check (is_admin());
