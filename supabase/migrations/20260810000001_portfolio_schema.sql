-- ============================================================================
-- Portfolio Schema（Spec §8.4 / §8.5 / §39）
--
-- 設計原則：
--   1. 分類與標籤用 join table 實作 many-to-many（Spec §39），不塞陣列欄位
--   2. Case Study / Links / AI Disclosure 存 jsonb——它們是整包讀寫的敘事區塊，
--      不需要被查詢，拆成欄位只會製造大量 NULL
--   3. 作品來源類型（client / concept / demo / internal）用 enum 而非 text，
--      因為 Spec §29 明文禁止 Demo 冒充客戶案例，型別層先擋一道
-- ============================================================================

create type portfolio_project_type as enum ('client', 'concept', 'demo', 'internal');
create type portfolio_status as enum ('draft', 'published', 'archived');
create type portfolio_media_type as enum ('image', 'video', 'pdf', 'embed', 'external');
create type portfolio_media_role as enum (
  'cover', 'gallery', 'mobile', 'desktop', 'before', 'after', 'document'
);

-- ---------------------------------------------------------------------------
-- portfolio_projects
-- ---------------------------------------------------------------------------
create table portfolio_projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text,
  description  text,

  project_type portfolio_project_type not null,
  status       portfolio_status not null default 'draft',

  industry     text,
  year         smallint,

  featured     boolean not null default false,
  sort_order   integer not null default 0,

  case_study_json    jsonb not null default '{}'::jsonb,
  links_json         jsonb not null default '{}'::jsonb,
  ai_disclosure_json jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,

  -- 已發布必須有發布時間；未發布不得有。避免出現「published 但沒人知道何時發的」
  constraint published_has_timestamp
    check ((status = 'published') = (published_at is not null)),

  constraint slug_is_url_safe
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- 公開列表最常見的查詢：已發布 + 精選 + 排序
create index portfolio_projects_published_idx
  on portfolio_projects (status, featured desc, sort_order, published_at desc);

create index portfolio_projects_industry_idx
  on portfolio_projects (industry) where industry is not null;

-- ---------------------------------------------------------------------------
-- portfolio_media（Spec §8.5）
-- ---------------------------------------------------------------------------
create table portfolio_media (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references portfolio_projects (id) on delete cascade,

  type          portfolio_media_type not null,
  url           text not null,
  thumbnail_url text,

  alt           text,
  caption       text,
  role          portfolio_media_role not null default 'gallery',

  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),

  -- Spec §35：圖片必須有替代文字。
  -- 1C 已在 TypeScript 型別層讓「有圖但沒 alt」不可能成立，這裡在資料層再擋一次——
  -- 型別只約束我們自己的程式碼，資料庫約束的是所有寫入路徑。
  constraint image_requires_alt
    check (type <> 'image' or (alt is not null and length(btrim(alt)) > 0))
);

create index portfolio_media_project_idx
  on portfolio_media (project_id, sort_order);

-- 一件作品至多一張封面
create unique index portfolio_media_single_cover_idx
  on portfolio_media (project_id) where role = 'cover';

-- ---------------------------------------------------------------------------
-- 分類與標籤（Spec §8.6：Category + Tags，不建深層樹）
-- ---------------------------------------------------------------------------
create table portfolio_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  sort_order integer not null default 0,
  active     boolean not null default true
);

create table portfolio_tags (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table portfolio_project_categories (
  project_id  uuid not null references portfolio_projects (id) on delete cascade,
  category_id uuid not null references portfolio_categories (id) on delete cascade,
  primary key (project_id, category_id)
);

create table portfolio_project_tags (
  project_id uuid not null references portfolio_projects (id) on delete cascade,
  tag_id     uuid not null references portfolio_tags (id) on delete cascade,
  primary key (project_id, tag_id)
);

create index portfolio_project_categories_category_idx
  on portfolio_project_categories (category_id);

create index portfolio_project_tags_tag_idx
  on portfolio_project_tags (tag_id);

-- ---------------------------------------------------------------------------
-- updated_at 自動維護
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger portfolio_projects_set_updated_at
  before update on portfolio_projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- V1 預設分類（Spec §8.6）
-- ---------------------------------------------------------------------------
insert into portfolio_categories (slug, name, sort_order) values
  ('web',              'Web',              10),
  ('ui-ux',            'UI / UX',          20),
  ('brand',            'Brand',            30),
  ('graphic',          'Graphic',          40),
  ('content',          'Content',          50),
  ('social',           'Social',           60),
  ('advertising',      'Advertising',      70),
  ('video',            'Video',            80),
  ('ai',               'AI',               90),
  ('automation',       'Automation',      100),
  ('internal-product', 'Internal Product', 110);
