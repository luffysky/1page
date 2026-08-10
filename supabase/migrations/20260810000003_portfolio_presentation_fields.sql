-- ============================================================================
-- 補上 2A 遺漏的兩個欄位
--
-- 2B/2C 把 UI 做出來之後才發現 schema 少了東西——這正是「先由 UI 定義
-- repository 需要什麼，再對真實資料庫實作」這個順序的用處：
-- 缺口在接線時就浮現，而不是等 Admin 介面做完才發現存不了。
--
-- kicker    標題上方的小標（例如「Premium Brand Landing Page」）。
--           2A 漏了。summary 是段落敘述，兩者用途不同，不能互相取代。
-- services  Spec §8.4 明列 `services: string[]`，§8.13 靠它做
--           「Service Detail 自動顯示 Related Work」。
--           用 text[] 而非 join table：服務是 config 中的固定四條產品線，
--           不是使用者可新增的實體，Spec §39 的表列也沒有這張 join table。
-- ============================================================================

alter table portfolio_projects
  add column kicker text,
  add column services text[] not null default '{}';

comment on column portfolio_projects.kicker is '標題上方小標，例如 Premium Brand Landing Page';
comment on column portfolio_projects.services is '對應 config/services.ts 的產品線 id';
