-- ============================================================================
-- 存下來的網站草稿（CR-003-4 / Spec §47 定價 B）
--
-- 定價 B：「免費編輯，存檔才付費」。
-- 免費的那一半靠 sessionStorage（見 preview-context），這張表是「存下來」。
--
-- ── 為什麼外鍵指向 profiles 而不是 auth.users ──────────────────
--
-- CR-002 後果三：將來換 SSO issuer 時，只需要重建 profiles 與 auth.users
-- 的對應，業務資料不動。直接指向 auth.users 的話，每一張業務表都要遷移。
-- ============================================================================

create table saved_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,

  -- 給人看的名字。使用者自己取，預設用品牌名
  name text not null,

  /*
   * 整份 SiteConfig。
   *
   * 為什麼存 jsonb 而不是拆成關聯表：SiteConfig 的形狀由 3A 的 zod schema
   * 定義，而那份 schema 是唯一的驗證點。拆成表就變成第二份結構定義，
   * 兩者遲早分歧——而分歧的表現是「存進去跟拿出來不一樣」。
   *
   * 讀出來一律再過一次 validateSiteConfig：資料庫欄位是 jsonb，
   * 它保證的只有「這是合法 JSON」，不保證「這是合法的 SiteConfig」。
   */
  config jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 一個人可以存很多份，但列表要照時間排
create index saved_sites_owner_updated_idx on saved_sites (owner_id, updated_at desc);

/*
 * 每人最多存幾份。
 *
 * 沒有上限的話，一支腳本可以用一個帳號寫爆整個資料庫——
 * 而這條路徑是登入使用者能直接觸發的。
 * 上限放在資料庫而不是只放在應用層：應用層擋得住 UI，
 * 擋不住有人直接打 PostgREST。
 */
create or replace function enforce_saved_sites_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from saved_sites where owner_id = new.owner_id) >= 20 then
    raise exception '每個帳號最多只能存 20 份網站';
  end if;
  return new;
end;
$$;

create trigger saved_sites_limit
  before insert on saved_sites
  for each row execute function enforce_saved_sites_limit();

-- updated_at 由 trigger 維護，不靠呼叫端記得帶。
-- （leads 那張表有一個同樣用途的函式，但它是綁那張表命名的，
--  這裡另外建一個而不是改動既有的。）
create or replace function touch_saved_sites_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger saved_sites_touch
  before update on saved_sites
  for each row execute function touch_saved_sites_updated_at();

-- ============================================================================
-- RLS
--
-- 這張表**只有本人**能碰。刻意不給後台人員讀：
-- 那是客戶還沒決定要不要給我們看的草稿，不是我們的資料。
-- 真的要給我們看時，他會按「送出詢問」（Phase M 的 MC）。
-- ============================================================================

alter table saved_sites enable row level security;

create policy "saved_sites_select_own"
  on saved_sites for select
  using (owner_id = auth.uid());

create policy "saved_sites_insert_own"
  on saved_sites for insert
  with check (owner_id = auth.uid());

create policy "saved_sites_update_own"
  on saved_sites for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "saved_sites_delete_own"
  on saved_sites for delete
  using (owner_id = auth.uid());
