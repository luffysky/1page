-- ============================================================================
-- CMS：把寫死在程式碼裡的文案搬進資料庫（CR-004 / Phase B BH）
--
-- ── 它現在就在痛 ───────────────────────────────────────────────
--
-- 網站上的文案寫死在 `src/config/*.ts` 裡，也就是**改一句話要走一次
-- commit 與部署**。待辦上「FAQ 四個空缺」之所以一直沒補，
-- 正是因為補一句話要開一次編輯器、跑一次 gate、推一次版。
--
-- ── 為什麼是「具名的 key」而不是任意頁面 ──────────────────────
--
-- key 由**程式碼**指定（`faq.list`、`pricing.tiers`），不是使用者自己取。
-- 這保證每一個 key 都有讀取端——而「宣告了一個東西卻沒有人在讀」
-- 正是這個專案犯過七次的毛病。
--
-- 反過來也成立：程式碼裡讀的 key 若資料庫沒有，讀取端會退回程式碼裡的
-- 那份預設值，網站照常運作。兩個方向都有測試盯著。
--
-- 不做「任意頁面產生器」：那會直接撞上 Spec §40 的「完整 CMS 平台」，
-- 而且新路由沒有對應的元件就只是一個 404。
--
-- ── 為什麼沒有 draft / published 兩態 ─────────────────────────
--
-- 目前的內容是 FAQ 與價格——各幾十行，一個人維護。
-- 為它們做一整套草稿工作流是儀式，不是保護。
--
-- 真正要防的是「改壞了回不去」，而那件事由 `cms_revisions` 解決：
-- 每次存檔留一版，隨時可以還原。等到有人需要「排程發佈」或
-- 「改好但先不上」時再加 status，那時它會是一個有真實需求的欄位。
-- ============================================================================

create table cms_documents (

  /*
   * 程式碼指定的識別字，例如 'faq.list'。
   *
   * 用 text 而非 enum：加一個 key 是加一份程式碼的讀取端，
   * 不該同時需要一次 migration。合法值由 TypeScript 那側的
   * CMS_DOCUMENTS registry 決定，而 registry 有測試盯著兩個方向。
   */
  key text primary key,

  /*
   * 內容。形狀由 registry 裡那個 key 的 zod schema 決定。
   *
   * jsonb 而不是拆表：每一個 key 的形狀都不一樣（FAQ 是問答清單、
   * 價格是六級階梯），拆表等於為每一種內容各做一張表。
   * 讀出來一律再過一次 schema——jsonb 保證的只有「這是合法 JSON」。
   */
  content jsonb not null,

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

-- 每次存檔留一版。改壞了要回得去
create table cms_revisions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null references cms_documents (key) on delete cascade,
  content jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references profiles (id) on delete set null
);

create index cms_revisions_document_idx on cms_revisions (document_key, saved_at desc);

/*
 * 版本數量有上限。
 *
 * 沒有上限的話，一個下午反覆微調文案就會留下幾百版，
 * 而那份清單本身會變得沒有人想看。留最近 20 版足夠回到「昨天那個版本」。
 */
create or replace function trim_cms_revisions()
returns trigger
language plpgsql
as $$
begin
  delete from cms_revisions
   where document_key = new.document_key
     and id not in (
       select id from cms_revisions
        where document_key = new.document_key
        order by saved_at desc
        limit 20
     );
  return null;
end;
$$;

create trigger cms_revisions_trim
  after insert on cms_revisions
  for each row execute function trim_cms_revisions();

create or replace function touch_cms_documents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cms_documents_touch
  before update on cms_documents
  for each row execute function touch_cms_documents_updated_at();

-- ============================================================================
-- RLS
--
-- 文案是**公開內容**——它就印在首頁上。所以任何人都讀得到，
-- 但只有員工改得動。
--
-- ⚠️ 這與 saved_sites 相反（那是客戶的草稿，只有本人看得到）。
-- 兩者都在 public schema 裡，不要因為「都是 jsonb」就套同一套 policy。
--
-- cms_revisions 則**不公開**：舊版本可能是還沒定案的價格。
-- ============================================================================

alter table cms_documents enable row level security;
alter table cms_revisions enable row level security;

create policy "cms_documents_public_read"
  on cms_documents for select
  using (true);

create policy "cms_documents_staff_write"
  on cms_documents for all
  using (is_admin())
  with check (is_admin());

create policy "cms_revisions_staff_all"
  on cms_revisions for all
  using (is_admin())
  with check (is_admin());
