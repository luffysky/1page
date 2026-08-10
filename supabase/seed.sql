-- ============================================================================
-- 本機開發種子資料
--
-- 刻意同時放入 published 與 draft 各一：
-- RLS 測試需要驗證「草稿在資料庫層就讀不到」，沒有草稿就驗不了那條邊界。
--
-- ⚠️ 全部標為 demo / internal。Spec §8.2、§29 禁止 Demo 冒充客戶案例，
-- 種子資料同樣受這條約束——現在還沒有客戶案，資料庫裡就不該長出客戶案。
-- ============================================================================

insert into portfolio_projects
  (id, slug, title, summary, project_type, status, featured, sort_order, published_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'interior-studio',
    '山序設計 / Interior Studio',
    '以乾淨的比例、材質與光線，讓每個空間都有自己的節奏。',
    'demo', 'published', true, 10, now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'yipage-identity',
    '一頁起家',
    '品牌識別與設計系統。',
    'internal', 'published', true, 20, now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'ai-website-workshop',
    'AI Website Workshop',
    'Agent 操作 SiteConfig 的互動示範。',
    'demo', 'published', true, 30, now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'unpublished-draft',
    '尚未發布的草稿',
    'RLS 測試用：匿名不得讀到這一筆。',
    'demo', 'draft', false, 40, null
  );

insert into portfolio_media (project_id, type, url, alt, role, sort_order)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'image',
    'https://example.invalid/interior-cover.webp',
    '山序設計網站首頁的桌機版畫面',
    'cover',
    0
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'image',
    'https://example.invalid/draft-cover.webp',
    '草稿作品的封面，匿名不得讀到',
    'cover',
    0
  );

insert into portfolio_project_categories (project_id, category_id)
select p.id, c.id
from (values
  ('interior-studio',     'web'),
  ('yipage-identity',     'brand'),
  ('yipage-identity',     'web'),
  ('ai-website-workshop', 'ai'),
  ('ai-website-workshop', 'automation'),
  ('unpublished-draft',   'web')
) as v (slug, category)
join portfolio_projects p on p.slug = v.slug
join portfolio_categories c on c.slug = v.category;
