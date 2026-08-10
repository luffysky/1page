-- ============================================================================
-- 會員 Profile（Spec V1.3 §47 CR-002 / Phase MA）
--
-- CR-002 開放公開註冊。會員的定義是：
--   有 auth.users 列、但不在 admin_users 名單上的人。
--
-- 因此這份 migration **不修改任何一條既有 policy**。
-- admin_users 維持為獨立的員工白名單，不併成 profiles.role 一個欄位
-- （ai_island_v3 的做法）。合併後「處理會員資料」與「決定誰是管理員」
-- 會碰到同一列，profile 相關的 bug 就有機會升級成管理權限。
-- 分開之後那條路徑在結構上不存在。
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- email 在此為**冗餘副本**。auth.users.email 才是真相，
  -- 但那張表在 auth schema，一般查詢 join 不到（PostgREST 不暴露 auth schema）。
  -- 後台收件匣要顯示「誰寄來的」，不能為此開放 auth schema。
  -- 由 trigger 維護，見下方 handle_new_user()。
  email text,

  display_name text,

  -- 未來 SnowRealm SSO 的對接欄位（CR-002 後果三）。
  -- 現在一定是 null，沒有任何程式碼讀它。
  --
  -- 這違反 Guardrail 2（YAGNI）嗎？不算——它不是一段沒人呼叫的邏輯，
  -- 是一個可為 null 的欄位。而它要解決的問題（換 issuer 時如何對應舊帳號）
  -- 事後補的成本是資料遷移，現在補的成本是這一行。
  -- 前例：SnowRealmSpace/supabase/migrations/0051_snowrealm_id_link.sql
  snowrealm_id text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is '會員 profile。會員 = 有 auth.users 列但不在 admin_users 名單上的人';
comment on column profiles.email is 'auth.users.email 的冗餘副本，由 trigger 維護；真相仍是 auth.users';
comment on column profiles.snowrealm_id is '未來 SnowRealm SSO 對接用，目前恆為 null';

create index profiles_email_idx on profiles (email);

-- ---------------------------------------------------------------------------
-- 建立 profile：用 DB trigger，不用應用層的 ensure-profile 端點
--
-- auth.users 的寫入**不經過我們的程式碼**——OAuth callback、GoTrue 的
-- 註冊端點、後台手動建帳號、將來的 SSO，都是直接寫進去的。
-- ai_island_v3 的 POST /api/auth/ensure-profile 從三個 client 端呼叫，
-- 任何一處漏掉就產生沒有 profile 的孤兒帳號，而那不會有任何徵兆。
--
-- 守在資料庫層才守得住。前例：SnowRealmSpace 0006_auth_hooks.sql。
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- 沒有提供顯示名稱時用信箱的 local part。
    -- 不用完整信箱，那等於把每個人的信箱印在畫面上。
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 信箱變更要同步過來，否則後台看到的是舊信箱，回覆會寄錯人。
create or replace function handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email, updated_at = now()
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function handle_user_email_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select_self on profiles
  for select using (id = (select auth.uid()));

-- 後台要顯示「詢問是誰寄來的」。
create policy profiles_select_staff on profiles
  for select using (is_admin());

-- 只能改自己的，而且 **只有 display_name 可改**。
-- id / email / snowrealm_id 由 trigger 與 SSO 維護，不接受使用者輸入：
--   改 email 會讓 profiles 與 auth.users 分歧，寄信寄到使用者自己指定的地方；
--   改 snowrealm_id 等於宣稱自己是別的平台帳號。
create policy profiles_update_self on profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function lock_profile_identity_columns()
returns trigger
language plpgsql
as $$
begin
  -- 後台與 trigger 走 security definer / service role，不經過這裡。
  -- 這條只擋一般會員的直接更新。
  if (select auth.uid()) = new.id and not public.is_admin() then
    new.email := old.email;
    new.snowrealm_id := old.snowrealm_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_lock_identity
  before update on profiles
  for each row execute function lock_profile_identity_columns();

-- 刻意沒有 insert 與 delete policy：
--   insert 只該由 on_auth_user_created 發生（security definer 不受 RLS 限制）；
--   delete 走 auth.users 的 cascade。允許會員直接 delete profile 只會產生
--   有帳號卻沒 profile 的狀態，那比刪不掉更難處理。
