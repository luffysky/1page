-- ============================================================================
-- 後台角色（Spec §41）
--
-- 2A 建立的 admin_users 只是一份 allowlist：在名單上 = 有權限。
-- 現在要區分 owner 與 admin，故加上 role。
--
-- V1 只有兩個角色，這是刻意的：
--   owner  最高權限，不可被其他人移除
--   admin  一般管理員
--
-- 參考專案有 support / marketing / finance / content 等 scoped 角色，
-- 那是在「有多個部門的人要進後台」之後才需要的。目前只有一個人在用，
-- 先做四個角色只會產生四份沒人走過的權限路徑（Guardrail 2）。
-- 需要時再加，角色模型本來就是為了擴充而集中在一處。
-- ============================================================================

create type admin_role as enum ('owner', 'admin');

alter table admin_users
  add column role admin_role not null default 'admin';

comment on column admin_users.role is 'owner 為最高權限且不可被移除；admin 為一般管理員';

-- ---------------------------------------------------------------------------
-- 至多一位 owner
--
-- 兩位 owner 會讓「誰不能被移除」變得模糊。需要多人時應該給 admin，
-- 而不是複製 owner。
-- ---------------------------------------------------------------------------
create unique index admin_users_single_owner_idx
  on admin_users ((true)) where role = 'owner';

-- ---------------------------------------------------------------------------
-- is_admin() 已存在（2A），語意不變：在名單上就是後台人員。
-- 另加 is_owner() 供「只有 owner 能做」的操作使用。
-- ---------------------------------------------------------------------------
create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- admin 可以看到完整名單（後台要顯示成員清單）；
-- 只有 owner 能異動名單——否則任何 admin 都能把自己升成 owner 或把 owner 踢掉。
-- ---------------------------------------------------------------------------
drop policy if exists admin_users_select_self_or_admin on admin_users;

create policy admin_users_select_staff on admin_users
  for select using (user_id = (select auth.uid()) or is_admin());

create policy admin_users_owner_write on admin_users
  for all using (is_owner()) with check (is_owner());
