# Phase M — 會員系統實作計畫（MA–ME）

> 依據：Spec V1.3 §47 CR-002。
> 位置：插在 Phase 3 與 Phase 4 之間。Phase 4–8 編號不變。
> 每段一樣要過 Gate：`typecheck → lint → test → build → visual review`。

---

## 為什麼插在這裡而不是排到最後

會員身分是**其他東西的地基**，不是附加功能。

Phase 5 的 Agent 要「對話綁定帳號、回頭看得到歷史」，Phase 4 的 Preview
要「存下我調過的樣板」——這兩件事都需要先有 `profiles.id` 可以外鍵指過去。
排在 Phase 4 之後，那兩個 Phase 會先長出一套匿名資料模型，再全部改一次。

---

## 已調查的前例（不重造，取最好的那個）

| 議題 | 採用來源 | 不採用的那個，以及原因 |
|---|---|---|
| profile 建立時機 | `SnowRealmSpace` `0006_auth_hooks.sql` 的 **DB trigger** | `ai_island_v3` 的 `POST /api/auth/ensure-profile`——它從三個 client 端呼叫，任何一處漏掉就產生沒有 profile 的孤兒帳號。`auth.users` 的寫入不經過我們的程式碼，守在資料庫層才守得住 |
| 詢問／訊息資料表 | `ai_island_v3` `commerce_migration.sql` 的 `tickets` + `ticket_messages`，**含 RLS** | `insight-engine` 的 `support_tickets`——三張表都沒有 `ENABLE ROW LEVEL SECURITY`，租戶隔離只靠應用層 |
| 速率限制 | `ai_island_v3` `src/lib/rate-limit.ts`（IP + 每信箱雙軌） | `insight-engine` 的 60 秒 DB cooldown——只擋得住同一個信箱重送，擋不住一個 IP 灌一萬個信箱 |
| 忘記密碼 | `SnowRealmSpace` `(auth)/forgot` + `reset-password` | `ai_island_v3` **完全沒有這條路徑**，帳號忘記密碼就等於沒了 |
| 帳號列舉防護 | `SnowRealmSpace` `actions.ts`：信箱存在與否回覆完全相同 | `insight-engine` 對已註冊信箱回 409 |

`ai_island_v3` 的 `/api/tickets` **沒有速率限制**（只截斷長度）。
它其餘端點都有，唯獨對外聯繫這條漏掉——本專案不重複。

---

## MA — 會員身分基礎

- `profiles` 表：`id`（FK → `auth.users`，`on delete cascade`）、`display_name`、
  `email`、`snowrealm_id`（預留，見 CR-002 後果三）、`created_at`、`updated_at`。
- DB trigger `on_auth_user_created` → `handle_new_user()`（`security definer`）。
- RLS：自己讀寫自己那列；`admin_users` 全讀。
  **不新增也不修改任何既有 policy**——CR-002 的分層設計就是為了這件事。
- `pnpm db:types` 重跑 + parity test。

**驗收**：`tests/db/` 對 Zeabur 實測——
新建使用者自動產生 profile；A 讀不到 B 的 profile；member 改不動 `admin_users`。

## MB — 註冊 / 登入 / 登出 / 忘記密碼

- 路由：`/signup`、`/login`（已存在，改為會員通用）、`/forgot`、`/reset-password`、
  `/auth/callback`、`/auth/confirm`。
- 全部收在 `src/features/auth/`，頁面不直接呼叫 Supabase auth（見 CR-002 後果三之 1）。
- 速率限制：註冊、寄信、登入三條路徑，IP + 信箱雙軌。
- 回應訊息不區分「信箱不存在」與「密碼錯誤」。
- 密碼強度提示（參考 `SnowRealmSpace/apps/web/app/(auth)/PasswordStrengthMeter.tsx`）。

**驗收**：e2e 走完註冊→驗證→登入→登出→忘記密碼→重設。
速率限制要有測試**證明會擋**，不是證明放行。

## MC — 帳號內聯繫（會員端）

- `inquiries` + `inquiry_messages`，RLS 從第一版就開（不是之後補）。
- `is_internal_note` 的內部註記，RLS 層就要讓會員讀不到——
  不是在查詢裡 filter 掉。查詢會被改，policy 不會。
- 會員端 `/me/inquiries`：列表 + 詳細 + 回覆。
- 送出詢問要速率限制（`ai_island_v3` 漏的那一項）。

**驗收**：RLS 測試繞過所有前端程式碼，直接證明 A 讀不到 B 的詢問、
讀不到 `is_internal_note = true` 的訊息。

## MD — 後台收件匣

- `/admin/inquiries` 列表（狀態 / 指派 / 未讀）+ 詳細頁回覆。
- Server Action 各自驗證身分（後台版面的守衛不涵蓋它們）。
- 狀態機：`open → in_progress → waiting_user → resolved → closed`。

## ME — 導覽整合 + 收尾

- 導覽列：未登入顯示「登入」；已登入顯示帳號選單（我的詢問 / 登出）；
  有 `admin_users` 資格才額外顯示「後台」（既有 `getAdminEntry()` 行為不變）。
- 頁尾的「工作人員登入」改回一般「登入」——CR-002 之後它不再是員工專屬入口。
- 把 `/login`、`/signup`、`/me/*`、`/admin/*` 納入八斷點 RWD + a11y 檢查
  （後台未納入是既有待辦，這段一併補）。
- `audit:wiring` 增加會員相關檢查項。

---

## 需要 Luffy 操作（MB 之前必須完成，否則註冊寄不出信）

1. **Zeabur GoTrue 設定 SMTP。** 目前 1page 的環境變數裡**一個 `GOTRUE_SMTP_*` 都沒有**。
   `SnowRealmSpace` 是同樣的自架 GoTrue，其 `.env.local` 有可直接參照的完整組態。
2. **`GOTRUE_DISABLE_SIGNUP` 改為 `false`。** 這是 Phase 2 特意設為 `true` 的。
   ⚠️ 順序很重要：**SMTP 要先設好**。先開註冊再設 SMTP，
   中間這段時間任何人都能用不存在的信箱建立已確認的帳號。
3. 確認 `GOTRUE_MAILER_AUTOCONFIRM` **不是** `true`（那會跳過信箱驗證）。

在 1 與 2 完成前，MB 可以寫完並以本機測試，但不能上線。
