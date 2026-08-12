-- Leads（Spec §19 / §38）
--
-- Agent 在對話中蒐集到的需求。這張表存的是**真人的聯絡方式與商業資訊**，
-- 因此讀取權限比作品集嚴格得多：任何人都可以留下 lead，
-- 但只有員工（與該 lead 的本人）讀得到。
--
-- ── 為什麼是欄位 + JSONB 混合 ────────────────────────────────
--
-- 後台收件匣要能依信箱、產業、時間排序與搜尋，那些做成欄位；
-- 其餘依 Spec §19 的巢狀結構原樣存 JSONB。
-- 全部拆成欄位的話，§19 之後多一個欄位就要一次 migration；
-- 全部塞進一個 JSONB 的話，連「照信箱找」都要全表掃描。

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),

  -- CR-002：會員留的 lead 綁帳號，之後可以在自己的頁面看到。
  -- 匿名訪客留的則為 null——不因為沒登入就不能留下需求（Spec §37）。
  profile_id uuid references profiles (id) on delete set null,

  -- Spec §19 contact
  contact_name text,
  contact_email text,
  contact_phone text,

  -- Spec §19 business
  business_name text,
  business_industry text,
  business_description text,

  -- Spec §19 的其餘巢狀結構。預設空物件而非 null：
  -- 讀取端就不必每個欄位都先判斷 null。
  requirement jsonb not null default '{}'::jsonb,
  assets jsonb not null default '{}'::jsonb,
  website jsonb not null default '{}'::jsonb,
  qualification jsonb not null default '{}'::jsonb,

  -- 來源。目前只有 agent，但先留著——
  -- 之後表單來的 lead 與對話來的 lead 要分得出來。
  source text not null default 'agent',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_contact_email_idx on leads (contact_email);
create index if not exists leads_profile_id_idx on leads (profile_id);

-- updated_at 由 trigger 維護，不靠呼叫端記得帶。
-- 忘了帶的表現是「這筆 lead 看起來三天沒動」，而其實剛剛才更新過。
create or replace function touch_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on leads;
create trigger leads_touch_updated_at
  before update on leads
  for each row execute function touch_leads_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table leads enable row level security;

-- 任何人都能留下需求，包含未登入的訪客（Spec §37：匿名是預設）。
-- 濫用防護不放在這裡——RLS 擋不住「同一個人送一萬次」，
-- 那是速率限制的工作（5E）。這裡只決定「誰可以寫」。
drop policy if exists leads_insert_anyone on leads;
create policy leads_insert_anyone on leads
  for insert with check (true);

-- 讀取：員工全部可讀。
drop policy if exists leads_select_staff on leads;
create policy leads_select_staff on leads
  for select using (is_admin());

-- 會員可讀自己留的那幾筆。匿名留的 profile_id 是 null，
-- 而 null = null 在 SQL 裡不成立，所以匿名之間互相讀不到——
-- 這是刻意依賴 null 的三值邏輯，不是疏漏。
drop policy if exists leads_select_own on leads;
create policy leads_select_own on leads
  for select using (profile_id = (select auth.uid()));

-- 更新：只有員工。
-- 讓留下 lead 的人事後改自己那筆，聽起來合理，實際上打開了一條
-- 「不斷改寫已經被讀過的內容」的路——業務已經照舊版聯絡了。
drop policy if exists leads_update_staff on leads;
create policy leads_update_staff on leads
  for update using (is_admin()) with check (is_admin());

-- 刻意沒有 delete policy。lead 是聯絡紀錄，不該被誰順手刪掉。
