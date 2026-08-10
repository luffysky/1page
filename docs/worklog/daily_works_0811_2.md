# Daily Works — 2026-08-11（第二班）

Luffy。Claude 值班。
主題：**補上登出 → CR-002 開放會員制 → MA 會員 profile → 接線總體檢**。

前半天的紀錄在 `daily_works_0811.md`。

---

## ✨ 新做的

### 1. 登出（先前完全沒有）

可以登入卻沒有任何地方能登出。共用電腦上登入後就下不來。

用 Server Action 而非瀏覽器端 `supabase.auth.signOut()`：session cookie 是 httpOnly，
由 server 寫入就該由 server 清除，否則會留下 server 那側還認得的殘影
（表現是「按了登出、重新整理又登入了」）。用 `<form>` 而非連結，因為登出會改變狀態，不該被 prefetch。

`scope: "local"` 只登出這台裝置——一般人按登出的意思是「離開這台電腦」，不是「把手機也踢掉」。

### 2. CR-002：開放公開註冊 + 帳號內聯繫（Spec V1.2 → V1.3）

Luffy 裁決：「一樣開放給使用者註冊，這樣他們有問題透過這網站帳號跟我們聯繫。」

這改到封版規格，走 CR 流程：

```text
§37  新增「已登入會員」層級。匿名仍是預設——
     不得變成要註冊才能用 Agent 或送 Lead，那會打壞 §0 的 funnel
§40  移除 ❌ Client Portal，但只解禁到「帳號 + 帳號內聯繫」為止
§47  記錄裁決、界線、三項後果
```

**界線**：進度追蹤、檔案交付、報價審批、簽核流程、付款仍是非目標。
那些一旦開始做，V1 就從接案網站變成專案管理系統，而 §40 存在的目的正是擋這個。

新增 `docs/phase-m-member-plan.md`（MA–ME，插在 Phase 3 與 Phase 4 之間）。
插在這裡是因為會員身分是地基不是附加功能：Phase 5 的「對話綁定帳號」與
Phase 4 的「存下調過的樣板」都要外鍵指向 `profiles.id`。排到後面，
那兩個 Phase 會先長出一套匿名資料模型再全部改一次。

### 3. 調查三個參考專案的會員系統，逐項取捨

不是照抄最近的那個，是每一項分別挑。

| 議題 | 採用 | 避開，以及原因 |
|---|---|---|
| profile 建立 | Space 的 **DB trigger** | ai_island 的 `ensure-profile` 從 3 個 client 端呼叫，漏一處就是孤兒帳號，而且不會有徵兆 |
| 詢問/訊息表 | ai_island 的 tickets **含 RLS** | insight-engine 三張表都沒 `ENABLE ROW LEVEL SECURITY`，隔離只靠應用層 |
| 速率限制 | ai_island 的 IP + 信箱雙軌 | insight-engine 只有 60 秒 DB cooldown，擋不住一個 IP 灌一萬個信箱 |
| 忘記密碼 | Space 的 `forgot` + `reset-password` | ai_island **完全沒有這條路徑**，忘記密碼等於帳號沒了 |
| 帳號列舉 | Space：信箱存在與否回覆完全相同 | insight-engine 對已註冊信箱回 409 |

另記：ai_island 的 `/api/tickets` 其餘端點都有速率限制，唯獨對外聯繫這條漏掉（只截斷長度）。

### 4. MA — 會員 Profile

`profiles` 表 + `on_auth_user_created` trigger + RLS。

**權限刻意分兩層不合併**：`admin_users` 維持獨立員工白名單，
不改成 `profiles.role` 一個欄位（ai_island 的做法）。
合併後「處理會員資料」與「決定誰是管理員」碰同一列，profile 的 bug 就有機會升級成管理權限。

> 會員 = 有 `auth.users` 列、但不在 `admin_users` 裡的人。

結果實測：**既有 20 條 policy 原封不動**，只新增 3 條。

其他決定：
- `email` 是 `auth.users` 的冗餘副本，由 trigger 維護。PostgREST 不暴露 auth schema，
  後台收件匣要顯示寄件者又不該為此開放整個 auth schema。
- 身分欄位（`email` / `snowrealm_id` / `created_at`）由 before-update trigger 鎖住。
  `update` policy 允許會員更新自己那列，光靠 policy 擋不住他改哪個欄位。
- `snowrealm_id` 預留給未來 SSO，現在恆為 null。

11 條 db 測試**用真實會員 JWT**驗證——用 service role 測 RLS 根本不會生效，全部都會過。

### 5. 稽核【8】路由可達性

既有的 `no-dead-links` 查的是「連結指向的目標存在嗎」。
反方向的「這個目標有連結指向它嗎」**沒有任何東西在看**——
所以 `/login` 從 2E 就能用卻沒有任何入口，一路沒被發現。

做法：從 `/` 爬同源連結，與磁碟上的路由清單對帳。沒被連到的要嘛是漏接，
要嘛必須列進 `UNLINKED_BY_DESIGN` 並寫明理由（理由寫不出來就是漏接）。

**已實測這條守衛有效**：拿掉頁尾登入連結 → 這條變紅；還原 → 恢復綠。

### 6. 後台首次被真的渲染過

新增 21 條測試：`/login` 與後台總覽各 8 斷點、作品列表與新增表單的最窄/最寬、
登出後 session 真的失效（判準是「重新造訪密路徑會被導向登入」，不是「跳回首頁了」）。

---

## 🐛 修好的

### 文件裡的一句話讓每一頁在 dev 都回 500

`docs/worklog/daily_works_0811.md` 有一句說明文字：
「用 Tailwind 任意值 `bg-[var(--site-*)]` 而非 inline style」。

Tailwind v4 的自動來源偵測掃到 `docs/`，把那串當成真的 class，
產出 `background-color: var(--site-*)`——不是合法的 CSS 值。
整份 stylesheet 解析失敗，`/` `/work` `/login` 全部 500。

**那份文件已經提交好幾個小時，期間 gate 全綠。**
`pnpm build` 沒失敗，typecheck、lint、測試都沒意見。是後來為了別的事開 dev server 才撞到。

改為 `@import "tailwindcss" source(none)` + `@source "../"`，只掃 `src/`。
寫文件不該有能力弄壞網站。加了單元測試守住這個範圍。

### `.env.local` 的 ADMIN_PASSWORD 已過期

新寫的後台測試 13 條全紅，原因是 Luffy 換過後台密碼、`.env.local` 沒跟著更新。

但真正的問題不是那組值過期，是**測試不該依賴一個人的個人密碼**：
那個值隨時可能改，改了就整組測試變紅，而紅的原因與程式碼無關。
改為由測試自行開一個拋棄式後台帳號，跑完刪掉。

### 我對登入流程的預期是錯的

第一版測試寫 `goto("/login")` 然後等網址出現 `/admin`。
實際上沒有 `next` 參數時，登入後會回首頁（`sanitizeNextPath` 的 fallback 是 `/`）。
13 條測試卡在一個根本不存在的行為上。

改為走真實路徑：造訪密路徑 → middleware 導向 `/login?next=…` → 登入後回原處。

### `playwright test` 裸跑會炸

`testDir: "./tests"` 而預設 `testMatch` 也吃 `*.test.ts`，
於是 Playwright 會去載 vitest 的單元測試然後失敗。加上 `testMatch: "**/*.spec.ts"`。

### `db:types` 產完必定卡 prettier

每次跑完 `pnpm db:types`，接下來第一次 gate 一定停在 `prettier --check`，
而那是純噪音的失敗——它不代表任何東西壞掉。改為產生後直接用 prettier 的 Node API 格式化。

---

## 🔍 審查（Luffy 要求：API / DB / UI / RWD 都要確定接好）

以 `pnpm audit:wiring` 對執行中的站台實測，非閱讀程式碼。

```text
【1】DB 欄位 ↔ 產生型別      52 個欄位全部同步            ✅
【2】程式碼 select ↔ DB      無未知欄位                   ✅
【3】未接線欄位              7 個（見待辦）                ⚠️
【4】公開路由                7 條全部符合預期狀態碼        ✅
【5】後台保護                裸 /admin 404、密路徑 307、首頁 HTML 不含密路徑  ✅
【6】草稿隔離                列表不含、詳細頁 404          ✅
【7】媒體網域                目前無媒體記錄                ✅
【8】路由可達性              爬到 13 頁 / 磁碟 12 條路由，無孤兒、無死連結  ✅
```

**RWD + a11y**：
公開路由 `/`、`/work`、`/work/[slug]` × 8 斷點（既有）
＋ **新增** `/login`、`/admin`、`/admin/portfolio`、`/admin/portfolio/new`。
每個斷點各跑 axe 掃描 + 橫向捲動檢查，全數通過。

**測試總數**：174 unit + 119 e2e + 56 db = **349**（早上是 310）。

---

## ⏳ 需 Luffy 操作

### MB（註冊/登入 UI）上線前必須完成，**順序不能反**

1page 目前**一個 `GOTRUE_SMTP_*` 都沒有**。
`SnowRealmSpace` 是同一套自架 GoTrue，其 `.env.local` 有可直接照抄的完整組態。

```text
1. 先設好 SMTP
2. 再把 GOTRUE_DISABLE_SIGNUP 改成 false
3. 確認 GOTRUE_MAILER_AUTOCONFIRM 不是 true
```

順序反了的話，中間那段時間任何人都能用不存在的信箱建立**已確認**的帳號。

### 其他

- `.env.local` 的 `ADMIN_PASSWORD` 與實際帳號密碼不符，請更新（測試已不依賴它，
  但 `pnpm admin:create` 之類的腳本還會用到）。
- **ai_island_v3 的密路徑 `Ak83QDhUOVqx` 仍未更換**（跨了兩天的唯一未完項）。
  它曾出現在公開 robots.txt 與每位訪客的根版面 JS chunk。可用 `pnpm gen:slug` 產生新的。
- SnowRealm SSO 動工前要先決定 R2 媒體網域的處置（見待辦）。

---

## 📌 記錄的坑

### 「gate 全綠」與「網站正常」是兩件事（今日最重要的一則）

Tailwind 掃到 docs 那件事，`pnpm build` **成功**，
typecheck、lint、172 條單元測試全過。同時每一頁在 dev 都是 500。

gate 檢查的是「程式碼有沒有問題」，沒有任何一項檢查「打開網站看得到東西嗎」。
這正是 Luffy 說的那類錯。今天補的【8】與後台斷點測試都是往這個方向補。

### 守衛只驗一個方向就只有一半的效力

`no-dead-links` 驗「連結 → 目標存在」，很紮實。
但「目標 ← 有連結」完全沒人驗，於是 `/login` 做完之後躺了兩個 Phase 沒人進得去。
寫守衛時要問：**這條規則的反方向也成立嗎？**

### 測試不該依賴人的密碼

任何「換個人設定就會紅」的測試，紅的時候都不代表程式壞了。
測試要自己準備自己需要的狀態，然後收乾淨。

### 我對自己寫的流程也會記錯

登入後導向哪裡——我寫過 `sanitizeNextPath`，仍然把行為記成「導向後台」。
測試預期要照著**跑一次真實路徑**得到，不是照著記憶寫。

---

## 今日 commit（第二班）

```text
924d7c8  feat: 補上登出，以及頁尾的登入入口
e476a18  docs: CR-002 開放公開註冊 + 帳號內聯繫（Spec V1.2 → V1.3）
797966f  feat(MA): 會員 profile — DB trigger + RLS
3a0c7eb  fix: 文件裡的一句話讓每一頁在 dev 都回 500；補上「路由進得去嗎」的稽核
（本篇隨後提交）
```
