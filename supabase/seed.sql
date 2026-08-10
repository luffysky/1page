-- ============================================================================
-- 開發／展示種子資料
--
-- 與 in-memory 實作的內容一致，因此 2D 換上資料庫之後畫面應該完全不變——
-- 那就是 2D 的驗收方式。
--
-- 刻意保留兩種「不完整」的資料：
--   unpublished-draft    RLS 測試需要一筆草稿，否則驗不了「草稿讀不到」
--   詳盡程度不一的作品   Spec §8.10「不顯示空 Section」需要有缺資料的作品才驗得了
--
-- ⚠️ 全部標為 demo / concept / internal，沒有任何一筆 client。
-- Spec §8.2、§29：不得將 Demo / Concept 冒充真實客戶案例。
-- 現在還沒有客戶案，資料庫裡就不該長出客戶案。
-- ============================================================================

insert into portfolio_projects
  (slug, title, kicker, summary, project_type, status, featured, sort_order,
   industry, year, services, case_study_json, links_json, ai_disclosure_json, published_at)
values
  (
    'interior-studio',
    '山序設計 / Interior Studio',
    'Premium Brand Landing Page',
    '以乾淨的比例、材質與光線，讓每個空間都有自己的節奏。',
    'demo', 'published', true, 10,
    '室內設計', 2026,
    array['web','brand-design'],
    jsonb_build_object(
      'problem', '室內設計工作室的作品照片很好，但散落在 Instagram，潛在客戶看完不知道下一步該做什麼，也判斷不出這間工作室擅長哪一類空間。',
      'goal',    '把分散的作品收攏成一個能建立信任的入口，並讓「預約諮詢」成為自然的下一步，而不是頁面底部一個孤立的按鈕。',
      'thinking','高單價服務的網站不需要說服訪客「我們很專業」，而是要讓他們自己看出來。因此把版面留給作品本身，文字只負責串接與定位，並在瀏覽節奏的每個停頓點自然出現聯絡動線。',
      'solution','一頁式結構：以滿版作品開場，中段用 Editorial 排版說明取向與流程，尾段收束成單一明確的諮詢動線。全站僅一組強調色，其餘交給留白與材質感的中性色。',
      'result',  '這是概念示範，不是已上線的客戶案。用途是展示我們在高端服務業網站上的取向與結構判斷。'
    ),
    jsonb_build_object('demo', '/work/interior-studio'),
    jsonb_build_object('used', true, 'description', 'AI 協助文案草稿與版面探索，視覺方向與最終排版由人工決定與調整。'),
    now()
  ),
  (
    'yipage-identity',
    '一頁起家',
    'Identity / System',
    '自家品牌識別與設計系統。',
    'internal', 'published', true, 20,
    null, 2026,
    array['brand-design','web'],
    jsonb_build_object(
      'problem',  '自家品牌若每個頁面看起來像不同公司，就沒有資格跟客戶談品牌一致性。',
      'solution', '建立一套 Design Token 系統作為全站唯一數值來源，色彩、字級、間距、圓角、陰影、斷點與動態全部集中管理，並以自動化測試確保元件內不出現硬寫的色碼。'
    ),
    '{}'::jsonb,
    jsonb_build_object('used', true, 'description', 'AI 協助程式開發與文件整理，設計決策由人工判斷。'),
    now()
  ),
  (
    'ai-website-workshop',
    'AI Website Workshop',
    'Agent + Website Engine',
    'AI Agent 不生成網站程式碼，而是生成與修改結構化的 SiteConfig，再由 Website Engine 渲染成網站。',
    'demo', 'published', true, 30,
    null, 2026,
    array['ai-automation','web'],
    -- 刻意留空：驗證「不顯示空 Section」（Spec §8.10）
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    now()
  ),
  (
    'dessert-brand',
    '暮光甜室',
    'Brand Identity / Packaging',
    '手作甜點品牌的識別與包裝概念。',
    'concept', 'published', false, 40,
    '餐飲', 2026,
    array['brand-design'],
    jsonb_build_object('goal', '在不使用大量深色的前提下做出精品感，避免甜點品牌常見的「一做高級就變全黑」。'),
    '{}'::jsonb,
    '{}'::jsonb,
    now()
  ),
  (
    'cafe-social-kit',
    '小山咖啡 社群素材組',
    'Social / Advertising Creative',
    '社群貼文與廣告素材的版型組合。',
    'concept', 'published', false, 50,
    '餐飲', 2026,
    array['content-growth'],
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    now()
  ),
  (
    'ops-automation',
    '接案流程自動化',
    'Internal Workflow / Agent',
    '把重複的專案行政工作交給流程，人只處理需要判斷的部分。',
    'internal', 'published', false, 60,
    null, 2026,
    array['ai-automation'],
    jsonb_build_object(
      'problem',  '報價、合約、交付檢查表每次都重做一遍，錯誤都發生在最無聊的環節。',
      'solution', '把固定流程模板化並串起來，AI 只負責整理與草擬，決策點仍保留人工確認。'
    ),
    '{}'::jsonb,
    '{}'::jsonb,
    now()
  ),
  (
    'unpublished-draft',
    '尚未發布的草稿',
    'RLS 測試用',
    '匿名不得讀到這一筆。',
    'demo', 'draft', false, 70,
    null, 2026,
    array['web'],
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    null
  );

-- ---------------------------------------------------------------------------
-- 媒體
--
-- 草稿也放一筆：驗證「作品未發布時，其媒體也讀不到」。
-- ---------------------------------------------------------------------------
insert into portfolio_media (project_id, type, url, alt, role, sort_order)
select p.id, 'image', v.url, v.alt, 'cover'::portfolio_media_role, 0
from (values
  ('interior-studio',   'https://example.invalid/interior-cover.webp', '山序設計網站首頁的桌機版畫面'),
  ('unpublished-draft', 'https://example.invalid/draft-cover.webp',    '草稿作品的封面，匿名不得讀到')
) as v (slug, url, alt)
join portfolio_projects p on p.slug = v.slug;

-- ---------------------------------------------------------------------------
-- 分類
-- ---------------------------------------------------------------------------
insert into portfolio_project_categories (project_id, category_id)
select p.id, c.id
from (values
  ('interior-studio',     'web'),
  ('interior-studio',     'ui-ux'),
  ('yipage-identity',     'brand'),
  ('yipage-identity',     'web'),
  ('yipage-identity',     'internal-product'),
  ('ai-website-workshop', 'ai'),
  ('ai-website-workshop', 'automation'),
  ('ai-website-workshop', 'internal-product'),
  ('dessert-brand',       'brand'),
  ('dessert-brand',       'graphic'),
  ('cafe-social-kit',     'social'),
  ('cafe-social-kit',     'advertising'),
  ('cafe-social-kit',     'content'),
  ('ops-automation',      'automation'),
  ('ops-automation',      'ai'),
  ('ops-automation',      'internal-product'),
  ('unpublished-draft',   'web')
) as v (slug, category)
join portfolio_projects p on p.slug = v.slug
join portfolio_categories c on c.slug = v.category;

-- ---------------------------------------------------------------------------
-- 標籤（Spec §8.6 第二層）
-- ---------------------------------------------------------------------------
insert into portfolio_tags (slug, name) values
  ('landing-page',  'Landing Page'),
  ('luxury',        'Luxury'),
  ('minimal',       'Minimal'),
  ('design-system', 'Design System'),
  ('editorial',     'Editorial'),
  ('agent',         'Agent'),
  ('siteconfig',    'SiteConfig'),
  ('logo',          'Logo'),
  ('packaging',     'Packaging'),
  ('instagram',     'Instagram'),
  ('campaign',      'Campaign'),
  ('workflow',      'Workflow')
on conflict (slug) do nothing;

insert into portfolio_project_tags (project_id, tag_id)
select p.id, t.id
from (values
  ('interior-studio',     'landing-page'),
  ('interior-studio',     'luxury'),
  ('interior-studio',     'minimal'),
  ('yipage-identity',     'design-system'),
  ('yipage-identity',     'editorial'),
  ('ai-website-workshop', 'agent'),
  ('ai-website-workshop', 'siteconfig'),
  ('dessert-brand',       'logo'),
  ('dessert-brand',       'packaging'),
  ('cafe-social-kit',     'instagram'),
  ('cafe-social-kit',     'campaign'),
  ('ops-automation',      'workflow'),
  ('ops-automation',      'agent')
) as v (slug, tag)
join portfolio_projects p on p.slug = v.slug
join portfolio_tags t on t.slug = v.tag;
