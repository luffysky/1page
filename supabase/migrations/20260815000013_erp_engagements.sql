-- ============================================================================
-- ERP：專案、工時與帳務（CR-004 / Phase B BF + BG）
--
-- 規模誠實說：這是一間小工作室的「專案與帳務」，不是製造業 ERP。
-- 不做庫存、不做採購、不做多幣別成本分攤。
--
-- ⚠️ **這個專案沒有任何金流串接，這一段也不做。**
-- invoices 與 payments 是**記帳**，不是收錢：自己開發票、自己對帳，
-- 系統只把「誰欠多少、收了沒」記下來。
--
-- 做成看起來會自動收錢的樣子，比沒有更糟——那是 SMTP 那件事的同一個教訓
-- （做一顆按了會 422 的註冊按鈕，比沒有那顆按鈕更糟）。
-- ============================================================================

/*
 * ⚠️ 刻意不叫 `projects`。
 *
 * `portfolio_projects` 是**對外的作品集**，這張是**對內的接案專案**。
 * 兩者都叫 project 的話，半年後沒有人分得出哪個是哪個——
 * 參考專案兩次踩到「同一個字兩個意思」，兩次都得回頭寫警告解釋。
 */
create table engagements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  -- 從哪一筆報價來的。可為 null：有些案子沒有正式報價就開始了
  deal_id uuid references deals (id) on delete set null,

  title text not null,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'paused', 'delivered', 'closed')),

  started_on date,
  due_on date,
  delivered_on date,

  /*
   * 做完了變成作品。
   *
   * 這條關聯讓「接案 → 作品集」是一個明確的動作，而不是靠人記得
   * 回頭補一件作品。作品集是累積型資產（Spec §44），漏掉的那幾件
   * 事後很難補——當時的截圖與說明已經散了。
   */
  portfolio_project_id uuid references portfolio_projects (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index engagements_client_idx on engagements (client_id, updated_at desc);
create index engagements_status_idx on engagements (status, updated_at desc);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements (id) on delete cascade,

  title text not null,
  due_on date,
  done_on date,
  -- 這個節點對應多少比例的請款。可為 null：不是每個里程碑都綁付款
  payment_ratio numeric(5, 2) check (payment_ratio is null or (payment_ratio >= 0 and payment_ratio <= 100)),
  sort_order int not null default 0
);

create index milestones_engagement_idx on milestones (engagement_id, sort_order);

/*
 * 工時。
 *
 * ⚠️ 存**分鐘**，不是小時的小數。
 * 小時用小數會出現「0.30 到底是 18 分還是 30 分」的問題，
 * 而那個誤會在對帳時會變成真的錢。
 */
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements (id) on delete cascade,

  worked_on date not null,
  minutes int not null check (minutes > 0 and minutes <= 1440),
  note text,

  actor_id uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index time_entries_engagement_idx on time_entries (engagement_id, worked_on desc);

-- ── 帳務 ────────────────────────────────────────────────────────

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  engagement_id uuid references engagements (id) on delete set null,

  /*
   * 自己的請款單編號，唯一。
   *
   * 重複的請款單編號是會計上的事故，不是 UI 問題——所以由資料庫擋。
   */
  number text not null unique,

  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issued_on date,
  due_on date,

  /*
   * total 存下來，不是每次算。
   *
   * 稅率與折扣規則會變，而**已經開出去的請款單金額不能跟著變**。
   * 每次重算的話，改一次稅率就會讓去年的帳全部對不起來。
   */
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_client_idx on invoices (client_id, issued_on desc);
create index invoices_status_idx on invoices (status);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,

  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order int not null default 0
);

create index invoice_lines_invoice_idx on invoice_lines (invoice_id, sort_order);

/*
 * 收款。
 *
 * ⚠️ 分期收款用**多筆 payments**，不是改 invoice 的狀態。
 * 收了一半就把 invoice 改成 paid 的話，帳就對不起來了——
 * 而「還差多少」是這整張表存在的理由。
 */
create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,

  paid_on date not null,
  amount numeric(12, 2) not null check (amount > 0),
  method text,
  note text,

  created_at timestamptz not null default now()
);

create index payments_invoice_idx on payments (invoice_id, paid_on desc);

-- ── Trigger ─────────────────────────────────────────────────────

create trigger engagements_touch
  before update on engagements
  for each row execute function touch_updated_at_generic();

create trigger invoices_touch
  before update on invoices
  for each row execute function touch_updated_at_generic();

create or replace function log_engagement_activity()
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

    if new.status is distinct from old.status then
      changes := changes || jsonb_build_object('status', jsonb_build_array(old.status, new.status));
      action_kind := 'status_changed';
    end if;

    if changes = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into activities (subject_type, subject_id, kind, detail, actor_id)
  values ('engagement', new.id, action_kind, changes, auth.uid());

  return null;
end;
$$;

create trigger engagements_activity
  after insert or update on engagements
  for each row execute function log_engagement_activity();

-- ============================================================================
-- RLS：只給員工
--
-- 之後若開放客戶看自己的專案與請款單，那是另外加一條 policy 的事，
-- 而 `notes.internal` 就是那時候的那條線。現在先不開——
-- 開了之後要能保證每一個欄位都適合給客戶看，那是另一段工作。
-- ============================================================================

alter table engagements enable row level security;
alter table milestones enable row level security;
alter table time_entries enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;

create policy "engagements_staff_all" on engagements
  for all using (is_admin()) with check (is_admin());
create policy "milestones_staff_all" on milestones
  for all using (is_admin()) with check (is_admin());
create policy "time_entries_staff_all" on time_entries
  for all using (is_admin()) with check (is_admin());
create policy "invoices_staff_all" on invoices
  for all using (is_admin()) with check (is_admin());
create policy "invoice_lines_staff_all" on invoice_lines
  for all using (is_admin()) with check (is_admin());
create policy "payments_staff_all" on payments
  for all using (is_admin()) with check (is_admin());
