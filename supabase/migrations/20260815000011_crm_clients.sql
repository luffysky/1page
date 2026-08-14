-- ============================================================================
-- CRM：客戶與聯絡記錄（CR-004 / Phase B BD）
--
-- ── 骨架 ───────────────────────────────────────────────────────
--
--   leads（訪客說了什麼，不可變）
--     └─ client_id ─→ clients（我們對這個客戶的理解，會一直改）
--                       ├─ client_contacts（一個客戶可以有多個聯絡人）
--                       └─ deals ─→ engagements ─→ invoices
--
-- ⚠️ **leads 不動。** 它是訪客留下的原始記錄——那是證據，
-- 不該被後續編輯覆蓋。只加一個 `leads.client_id` 表示
-- 「這筆詢問已經轉成某個客戶」。
--
-- 把 lead 直接當客戶來編輯的話，「他當初說的」與「我們後來改的」
-- 就分不開了，而談價格談到一半時那件事會很重要。
-- ============================================================================

/*
 * 狀態一律 text + check，不用 enum。
 *
 * enum 加一個值要一次 migration，而「客戶狀態」「銷售階段」這種東西
 * 一定會被改。check constraint 同樣擋得住非法值，但改起來只是一行 alter。
 */
create table clients (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  -- 公司或個人。接案工作室兩種都會遇到，而寄信與稱呼的方式不一樣
  kind text not null default 'company' check (kind in ('company', 'individual')),
  industry text,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'past')),
  -- 從哪來：lead / 介紹 / 自己找上門。之後要看哪個管道有效
  source text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_status_idx on clients (status, updated_at desc);

create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  title text,
  is_primary boolean not null default false,

  created_at timestamptz not null default now()
);

create index client_contacts_client_idx on client_contacts (client_id);

/*
 * 一個客戶最多一位主要聯絡人。
 *
 * 兩位「主要」聯絡人的意思是沒有主要聯絡人——寄信的時候要挑一個，
 * 而挑錯的成本是寄給了不管事的那位。用部分唯一索引讓資料庫擋。
 */
create unique index client_contacts_one_primary
  on client_contacts (client_id) where is_primary;

/*
 * 備註與時間軸都用「多型關聯」：一則備註可以掛在 client / contact /
 * deal / engagement 上。
 *
 * 為每一種各做一張 notes 表的話，之後要看「這個客戶底下所有的備註」
 * 就得 union 四張表。多型的代價是沒有外鍵，換來的是查詢單純。
 *
 * subject_type 用 check 限定，避免打錯字長出一堆查不到東西的列。
 */
create table notes (
  id uuid primary key default gen_random_uuid(),

  subject_type text not null check (subject_type in ('client', 'contact', 'deal', 'engagement')),
  subject_id uuid not null,

  body text not null,
  -- 內部備註永遠不給客戶看。之後開放客戶檢視時，這個旗標就是那條線
  internal boolean not null default true,

  author_id uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notes_subject_idx on notes (subject_type, subject_id, created_at desc);

/*
 * 時間軸。
 *
 * ⚠️ 由 trigger 寫，不靠呼叫端記得寫。
 *
 * 靠呼叫端的話，漏掉的那個操作就是時間軸上一段空白——而且沒有人會發現，
 * 因為「沒有發生過」與「發生了但沒記」在畫面上長得一模一樣。
 * 這與 updated_at 用 trigger 維護是同一個理由。
 */
create table activities (
  id uuid primary key default gen_random_uuid(),

  subject_type text not null check (subject_type in ('client', 'contact', 'deal', 'engagement')),
  subject_id uuid not null,

  kind text not null,
  detail jsonb not null default '{}'::jsonb,

  actor_id uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_subject_idx on activities (subject_type, subject_id, created_at desc);

-- ── lead → client 的轉換 ────────────────────────────────────────
--
-- 可為 null：大多數 lead 不會變成客戶，那是正常的。
-- on delete set null：客戶刪掉了，那筆詢問仍然是一筆真實發生過的詢問。
alter table leads add column client_id uuid references clients (id) on delete set null;
create index leads_client_idx on leads (client_id);

-- ============================================================================
-- Trigger
-- ============================================================================

create or replace function touch_updated_at_generic()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_touch
  before update on clients
  for each row execute function touch_updated_at_generic();

/*
 * 記一筆時間軸。
 *
 * `auth.uid()` 在後台的請求裡是登入者；由腳本或 service role 寫入時
 * 會是 null，那時 actor_id 留空——「不知道是誰做的」比「猜一個」誠實。
 */
create or replace function log_client_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_kind text;
  changes jsonb := '{}'::jsonb;
begin
  if TG_OP = 'INSERT' then
    action_kind := 'created';
  else
    action_kind := 'updated';
    -- 只記真的變了的欄位。全部記下來的話，時間軸會被一堆沒變的欄位塞滿
    if new.status is distinct from old.status then
      changes := changes || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
      action_kind := 'status_changed';
    end if;
    if new.name is distinct from old.name then
      changes := changes || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
    end if;

    -- 什麼都沒變就不記。按了儲存但沒改東西不是一個事件
    if changes = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into activities (subject_type, subject_id, kind, detail, actor_id)
  values ('client', new.id, action_kind, changes, auth.uid());

  return null;
end;
$$;

create trigger clients_activity
  after insert or update on clients
  for each row execute function log_client_activity();

-- ============================================================================
-- RLS：全部只給員工
--
-- 這幾張表裝的是客戶的聯絡方式與我們對他們的內部判斷。
-- 與 saved_sites（客戶自己的草稿）相反，也與 cms_documents（公開文案）相反：
-- 都在 public schema 裡，不要因為「都是新表」就套同一套 policy。
--
-- 之後若開放客戶看自己的專案與請款單，那是另外加一條 policy 的事，
-- 而 notes.internal 就是那時候的那條線。
-- ============================================================================

alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table notes enable row level security;
alter table activities enable row level security;

create policy "clients_staff_all" on clients
  for all using (is_admin()) with check (is_admin());

create policy "client_contacts_staff_all" on client_contacts
  for all using (is_admin()) with check (is_admin());

create policy "notes_staff_all" on notes
  for all using (is_admin()) with check (is_admin());

create policy "activities_staff_all" on activities
  for all using (is_admin()) with check (is_admin());
