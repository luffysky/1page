-- ============================================================================
-- CRM：報價與成交流程（CR-004 / Phase B BE）
--
-- 一頁起家是接案工作室，所以「pipeline」的形狀是
-- **詢問 → 報價 → 談 → 成交／流失**，不是通用的機會管理。
-- ============================================================================

create table deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,

  title text not null,

  /*
   * 階段用 text + check，不用 enum。
   *
   * enum 加一個值要一次 migration，而銷售流程的階段一定會被改
   * （現在沒有「等對方決定」這一段，之後大概會需要）。
   */
  stage text not null default 'inquiry'
    check (stage in ('inquiry', 'quoted', 'negotiating', 'won', 'lost')),

  /*
   * 金額用 numeric，不是 float。
   *
   * 錢不能用二進位浮點數——0.1 + 0.2 不等於 0.3 這件事在報價單上
   * 會變成「加總對不起來」。這條沒有例外。
   */
  amount numeric(12, 2),
  currency text not null default 'TWD',

  expected_close date,

  /*
   * 輸了要寫原因。
   *
   * 沒有 lost_reason 的 CRM 只是一份聯絡簿——「為什麼沒成」是這張表
   * 唯一能回答、而且真的會影響下一次報價的問題。
   */
  lost_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_client_idx on deals (client_id, updated_at desc);
create index deals_stage_idx on deals (stage, updated_at desc);

/*
 * 報價明細。
 *
 * 單價存下來，不是每次去查服務的定價：已經寄出去的報價金額
 * 不能因為之後調價而跟著變。這與 invoices 存 total 是同一個理由。
 */
create table deal_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,

  -- 對應 config/services.ts 的 id。可為 null：有些項目不屬於任何一條服務線
  service_id text,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order int not null default 0
);

create index deal_items_deal_idx on deal_items (deal_id, sort_order);

create trigger deals_touch
  before update on deals
  for each row execute function touch_updated_at_generic();

/*
 * 時間軸。與 clients 同一套，但記的是階段變化——
 * 那是這張表上唯一真正重要的事件。
 */
create or replace function log_deal_activity()
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

    if new.stage is distinct from old.stage then
      changes := changes || jsonb_build_object('stage', jsonb_build_array(old.stage, new.stage));
      action_kind := 'stage_changed';
    end if;
    if new.amount is distinct from old.amount then
      changes := changes || jsonb_build_object('amount', jsonb_build_array(old.amount, new.amount));
    end if;

    -- 什麼都沒變就不記
    if changes = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into activities (subject_type, subject_id, kind, detail, actor_id)
  values ('deal', new.id, action_kind, changes, auth.uid());

  return null;
end;
$$;

create trigger deals_activity
  after insert or update on deals
  for each row execute function log_deal_activity();

/*
 * 輸掉一定要寫原因，由資料庫擋。
 *
 * 只在應用層擋的話，之後任何一條寫入路徑（腳本、匯入、下一個人加的 action）
 * 都可能繞過去，而繞過去的那些資料事後補不回來——當時為什麼沒成，
 * 過三個月就沒有人記得了。
 */
alter table deals add constraint deals_lost_needs_reason
  check (stage <> 'lost' or (lost_reason is not null and length(trim(lost_reason)) > 0));

-- ============================================================================
-- RLS：只給員工。理由與 clients 相同
-- ============================================================================

alter table deals enable row level security;
alter table deal_items enable row level security;

create policy "deals_staff_all" on deals
  for all using (is_admin()) with check (is_admin());

create policy "deal_items_staff_all" on deal_items
  for all using (is_admin()) with check (is_admin());
