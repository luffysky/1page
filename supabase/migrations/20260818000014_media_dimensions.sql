-- ============================================================================
-- 媒體尺寸（取代 thumbnail_url）
--
-- ── 為什麼是移除而不是接上 ──────────────────────────────────────
--
-- `thumbnail_url` 從 0810 建表起就**兩端都沒有**：沒有任何地方寫它，
-- 讀出來之後也沒有任何元件在畫它。待辦上原本寫「要接一條產生縮圖的路徑」，
-- 但真的去接的話會疊出第二套更差的機制——`next/image` 的最佳化器
-- 本來就依 `sizes` 產出對的尺寸，作品卡片已經在用了。
--
-- 它真正掩蓋掉的問題是：作品詳細頁的相簿用原生 `<img>`，
-- 沒有寬高、不經最佳化。沒有寬高的圖片會在載入時把下面的內容推開（CLS），
-- 而那是有一支效能稽核在盯的數字。
--
-- 所以存的是**原始尺寸**，不是另一份檔案。一組整數解決 CLS，
-- 尺寸變換交給既有的最佳化器。
--
-- ⚠️ 這張表目前是空的（0 筆），所以不需要回填。
-- 有幾千筆之後才做的話，這就不再是「加兩個欄位」而是一次資料遷移。
-- ============================================================================

alter table portfolio_media
  add column width  integer,
  add column height integer,
  drop column thumbnail_url;

-- 兩個都有或兩個都沒有。只知道一邊的話算不出長寬比，
-- 而 next/image 需要的正是長寬比——半套資料會讓它算出一個錯的框，
-- 那比沒有資料更糟（沒有資料時我們知道要走 fallback）。
alter table portfolio_media
  add constraint media_dimensions_paired
    check ((width is null) = (height is null));

alter table portfolio_media
  add constraint media_dimensions_positive
    check (coalesce(width, 1) > 0 and coalesce(height, 1) > 0);

comment on column portfolio_media.width is
  '原始像素寬。給 next/image 算長寬比用，避免 CLS。非圖片為 null';
comment on column portfolio_media.height is
  '原始像素高。與 width 成對，見 media_dimensions_paired';
