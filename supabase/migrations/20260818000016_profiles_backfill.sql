-- ============================================================================
-- 補上 trigger 之前就存在的帳號的 profile
--
-- ── 這是 0811 那份 migration 自己預言的那個失敗 ────────────────
--
-- `20260811000005_profiles.sql` 的註解寫著：
--
--   > 任何一處漏掉就產生沒有 profile 的孤兒帳號，而那不會有任何徵兆。
--   > 守在資料庫層才守得住。
--
-- 那個判斷完全正確，`on_auth_user_created` 也確實守住了**之後**建立的帳號。
-- 但它是 `after insert` ——對已經在 `auth.users` 裡的列不會觸發。
-- 所以那份 migration **上線的當下就已經有一個孤兒**：0810 建立的管理員帳號。
--
-- ── 症狀為什麼拖了一週才出現 ──────────────────────────────────
--
-- 九張表的外鍵指向 profiles：
--   crm_definitions.owner_id、crm_records.owner_id、saved_sites.owner_id、
--   cms_documents.updated_by、cms_revisions.saved_by、notes.author_id、
--   activities.actor_id、time_entries.actor_id、leads.profile_id
--
-- 也就是說，那個帳號**存不了任何東西**——存網站草稿、存 CMS 內容、
-- 存 CRM 設計，全部會撞外鍵。而應用層把錯誤吞成一句「存檔失敗。」。
--
-- e2e 一直是綠的，因為每一支測試都自己建新帳號（trigger 會補 profile）。
-- **測試涵蓋的是「新使用者」，而唯一的舊使用者沒有人測。**
--
-- ── 這份 migration 只做一件事 ─────────────────────────────────
--
-- 把 `auth.users` 裡沒有 profile 的列補上，欄位邏輯與 trigger 完全一致。
-- 之後由 `tests/db/profiles.test.ts` 的「沒有孤兒帳號」守著。
-- ============================================================================

insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  -- ⚠️ 與 handle_new_user() 一字不差。
  -- 兩邊分岔的話，回填出來的名字會與註冊時產生的不一樣，
  -- 而那種差異只有在同一個畫面上並排時才看得出來。
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
