-- ============================================================================
-- 訪客自己設計的 CRM（CR-003-5 / Spec §47）
--
-- ── ⚠️ 絕對不拿使用者的定義去下 DDL ──────────────────────────
--
-- 「他定義一張表，我們就 create table」等於把 DDL 權限交給不可信輸入：
-- 表名來自使用者輸入、改一個欄位就是一次線上 migration、
-- 幾百個使用者之後 schema 裡會有幾千張沒有人看得懂的表。
--
-- 一張表配 jsonb 就夠，RLS 也只要一條。
--
-- ── 與後台的 CRM 是兩件完全不同的東西 ────────────────────────
--
-- `clients` / `deals` / `engagements` 是**我們自己**的客戶管理，
-- 表是我們設計的、只有員工看得到。這裡是訪客的東西，只有本人看得到。
-- 不共用表也不共用命名——這個專案已經兩次踩到「同一個字兩個意思」。
-- ============================================================================

create table crm_definitions (
  id uuid primary key default gen_random_uuid(),

  -- 外鍵指向 profiles 而不是 auth.users：換 SSO issuer 時只要重建
  -- profiles 與 auth.users 的對應，業務資料不動（CR-002 後果三）
  owner_id uuid not null references profiles (id) on delete cascade,

  name text not null,

  /*
   * 整份定義。形狀由 `features/crm-builder/schema.ts` 的 zod 定義，
   * 而那份 schema 是唯一的驗證點。
   *
   * 拆成關聯表就變成第二份結構定義，兩者遲早分歧——
   * 而分歧的表現是「存進去跟拿出來不一樣」。
   *
   * 讀出來一律再過一次 validateCrmDefinition：jsonb 保證的只有
   * 「這是合法 JSON」，不保證「這是合法的 CrmDefinition」。
   */
  definition jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_definitions_owner_updated_idx
  on crm_definitions (owner_id, updated_at desc);

create table crm_records (
  id uuid primary key default gen_random_uuid(),

  /*
   * ⚠️ owner_id 是**冗餘**的（definition 上已經有一個），而且是刻意的。
   *
   * 沒有它的話 RLS 每一列都要 join 回 crm_definitions，那是每次查詢
   * 每一列都跑一次的子查詢。有它的話 policy 是一個索引查得到的等式。
   *
   * 冗餘的代價是「兩邊可能不一致」，所以它**不接受呼叫端指定**——
   * 由下面的 trigger 從 definition 抄過來。
   */
  owner_id uuid not null references profiles (id) on delete cascade,

  definition_id uuid not null references crm_definitions (id) on delete cascade,

  -- 這筆記錄屬於定義裡的哪一類。對應 CrmEntity.id
  entity text not null,

  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_records_definition_idx
  on crm_records (definition_id, entity, created_at desc);

-- ---------------------------------------------------------------------------
-- 擁有者由 trigger 決定，不靠呼叫端記得帶
--
-- 靠呼叫端的話，任何一條忘了帶 owner_id 的寫入路徑就是一筆別人看不到、
-- 自己也看不到的孤兒記錄；而帶錯的話更糟——那是一筆寫進別人 CRM 的資料。
-- 這與 activities 用 trigger 寫時間軸是同一個理由。
-- ---------------------------------------------------------------------------
create or replace function crm_records_inherit_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  definition_owner uuid;
begin
  select owner_id into definition_owner
  from crm_definitions
  where id = new.definition_id;

  if definition_owner is null then
    raise exception '找不到這份 CRM 定義';
  end if;

  new.owner_id := definition_owner;
  return new;
end;
$$;

create trigger crm_records_owner
  before insert or update on crm_records
  for each row execute function crm_records_inherit_owner();

-- ---------------------------------------------------------------------------
-- 上限。放在資料庫而不是只放在應用層：
-- 應用層擋得住 UI，擋不住有人直接打 PostgREST。
-- ---------------------------------------------------------------------------
create or replace function enforce_crm_definitions_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from crm_definitions where owner_id = new.owner_id) >= 10 then
    raise exception '每個帳號最多只能存 10 份 CRM 設計';
  end if;
  return new;
end;
$$;

create trigger crm_definitions_limit
  before insert on crm_definitions
  for each row execute function enforce_crm_definitions_limit();

create or replace function enforce_crm_records_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from crm_records where definition_id = new.definition_id) >= 500 then
    raise exception '一份 CRM 最多只能存 500 筆記錄';
  end if;
  return new;
end;
$$;

create trigger crm_records_limit
  before insert on crm_records
  for each row execute function enforce_crm_records_limit();

-- updated_at
create or replace function touch_crm_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger crm_definitions_touch
  before update on crm_definitions
  for each row execute function touch_crm_updated_at();

create trigger crm_records_touch
  before update on crm_records
  for each row execute function touch_crm_updated_at();

-- ============================================================================
-- RLS
--
-- 這兩張表**只有本人**能碰。刻意不給員工讀：
-- 那是使用者自己的資料，不是我們的。想給我們看的話他會另外送出詢問。
-- ============================================================================

alter table crm_definitions enable row level security;
alter table crm_records enable row level security;

create policy "crm_definitions_select_own"
  on crm_definitions for select using (owner_id = auth.uid());
create policy "crm_definitions_insert_own"
  on crm_definitions for insert with check (owner_id = auth.uid());
create policy "crm_definitions_update_own"
  on crm_definitions for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "crm_definitions_delete_own"
  on crm_definitions for delete using (owner_id = auth.uid());

/*
 * ⚠️ records 的 insert policy 問的是 definition_id，不是 owner_id。
 *
 * 「你有沒有這份定義的擁有權」才是真正要問的問題。
 * 「你有沒有把自己的 id 填對」不是——那個值是呼叫端送來的。
 *
 * ── 實測過的三種組合（tests/db/crm-builder.test.ts）─────────────
 *
 *   policy 只驗 owner_id ＋ 有 trigger   擋得住，但**是 trigger 擋的**：
 *                                        trigger 先把 owner_id 蓋成 A，
 *                                        with check 再拿它跟 auth.uid()（B）比
 *   policy 只驗 owner_id ＋ 沒 trigger   ❌ B 真的把記錄寫進 A 的 CRM
 *   這一版（exists）  ＋ 沒 trigger      擋得住
 *
 * 也就是說：兩層各自都擋得住，而不是互相依賴。
 * 只留 owner_id 那一版的話，整個邊界會**押在一個 trigger 上**——
 * 而 trigger 是為了資料一致性寫的，不是為了擋人。
 * 哪天有人為了效能把它換成應用層填值，安全性就跟著沒了，
 * 而且不會有任何東西報錯。
 */
create policy "crm_records_select_own"
  on crm_records for select using (owner_id = auth.uid());

create policy "crm_records_insert_own"
  on crm_records for insert
  with check (
    exists (
      select 1 from crm_definitions
      where crm_definitions.id = crm_records.definition_id
        and crm_definitions.owner_id = auth.uid()
    )
  );

create policy "crm_records_update_own"
  on crm_records for update
  using (owner_id = auth.uid())
  with check (
    exists (
      select 1 from crm_definitions
      where crm_definitions.id = crm_records.definition_id
        and crm_definitions.owner_id = auth.uid()
    )
  );

create policy "crm_records_delete_own"
  on crm_records for delete using (owner_id = auth.uid());
