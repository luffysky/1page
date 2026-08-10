# 待辦狀態校正 0811

> 這份是 2026-08-11 收工時**對照實際程式與實測結果**校正過的權威狀態。
> Phase 進度以 `docs/gate-log.md` 的 Gate 紀錄為準，那份是逐段的驗收證據。
> 規格仍以 `docs/1page-v1-spec.md`（V1.2，FROZEN）為唯一來源。

---

## ✅ 已完成（都已 commit/push 上 main，且各段 Gate 通過）

### Phase 1 — Scaffold → 首頁（1A–1E）
Design Token 系統（八類）、Home Goal Context（URL 驅動）、八個 Layout Primitive、
首頁依 Spec §4 IA 組裝、八斷點 RWD + a11y 基線。
LCP 356ms / CLS 0（localhost，Phase 8 需以真實網路重測）。

### Phase M — MA 會員 Profile
`profiles` 表 + `on_auth_user_created` DB trigger + RLS。
權限維持兩層（`admin_users` 仍是獨立員工白名單），實測**既有 20 條 policy 原封不動**。
11 條 db 測試以真實會員 JWT 驗證。

### Phase 2 — Portfolio（2A–2F）
Schema + RLS（對 Zeabur 實測）、`/work` 列表 + Filter、`/work/[slug]` + SEO、
Repository 換 Supabase、後台權限 + CRUD、R2 媒體上傳。

### Phase 3 — Website Engine（3A–3D）
SiteConfig Schema + 驗證、Theme Engine（`--site-*` scoped）、
Section Registry（9 元件）、SiteRenderer。

### 額外完成（不在原計畫）
- `pnpm gen:slug` 密路徑產生器（多格式、熵值提示）
- `pnpm audit:wiring` 接線稽核（**八項**，第 8 項路由可達性見下）
- PWA（manifest + 動態圖示，刻意不做離線快取）
- ai_island_v3 的密路徑洩漏修正（已提交至該專案 main，`41819152`）
- **登出**（先前完全沒有：能登入、沒有任何地方能登出）
- **後台首次被測試真的渲染過**——先前所有後台測試都只驗「未登入時進不去」

**測試總數：174 unit + 119 e2e + 56 db = 349。**

---

## 🔴 真正還沒做（純程式、沒被外部卡）

### 分類清單沒有接上資料庫
`portfolio_categories` 表已建立且已灌入 11 筆種子，但 `/work` 的篩選 UI
讀的是 `config/portfolio-categories.ts` 的硬編清單。

`config/portfolio-categories.ts` 的註解寫著「2D 換上真實資料庫後改由 DB 供應」——
那件事沒有發生。目前後果有限（兩份清單內容一致），但**沒有任何機制保證它們維持一致**：
在後台新增分類不會出現在篩選器上。

同理未接線的欄位（`audit:wiring` 第 3 項，目前 7 個）：
`portfolio_categories.active`、`portfolio_tags` 的 join、`admin_users.note`、`created_at`、
以及 MA 新增的 `profiles.display_name` / `profiles.snowrealm_id`
（後兩者是預期中的：MB／ME 才會有讀取端，`snowrealm_id` 要等 SSO）。

### 「畫面上進不去」這類問題現在有守衛了，但只覆蓋連結

`audit:wiring【8】` 從 `/` 爬同源連結，跟磁碟路由對帳，
抓得到「頁面做完了但沒有入口」。**抓不到**的還有：

```text
按鈕存在但點了沒反應（onClick 沒接）
表單送出後沒有任何回饋
連結存在但被 CSS 蓋住／z-index 壓住
需要登入才看得到的入口（爬蟲是匿名的）
```

最後一項在 Phase M 會變重要：會員選單、我的詢問這些入口只有登入後才存在。
ME 收尾時要讓可達性檢查也帶一個已登入的 session 再爬一次。

### ~~後台頁面沒有納入 RWD 與 a11y 斷點檢查~~ ✅ 已補
`/login` 與後台總覽各 8 斷點，作品列表與新增表單測最窄/最寬兩端，
另加「登出後 session 真的失效」。見 `tests/e2e/authed-breakpoints.spec.ts`。

### 作品詳細頁的 Case Study 無法從後台編輯
`case_study_json` / `links_json` / `ai_disclosure_json` 已在 schema 與公開頁完整支援，
但後台編輯表單只有基本欄位。目前只能改資料庫。

### Tag 與 Service 篩選
Spec §8.7 列出「另可依 Project Type / Industry / Tag / Service 篩選」。
目前只做了 Category + Project Type。

---

## ⏳ 被外部卡住 / 需 Luffy 操作

### 🔴 MB（註冊/登入 UI）上線前必須完成，**順序不能反**

1page 目前**一個 `GOTRUE_SMTP_*` 都沒有**。
`SnowRealmSpace` 是同一套自架 GoTrue，其 `.env.local` 有可直接照抄的完整組態
（`GOTRUE_SMTP_HOST` / `PORT` / `USER` / `PASS` / `ADMIN_EMAIL` / `SENDER_NAME`）。

```text
1. 先設好 SMTP
2. 再把 GOTRUE_DISABLE_SIGNUP 改成 false
3. 確認 GOTRUE_MAILER_AUTOCONFIRM 不是 true
```

**順序反了會出事**：先開註冊、後設 SMTP，中間那段時間任何人都能用
不存在的信箱建立**已確認**的帳號。而 CR-002 開放註冊的目的正是
「使用者能透過帳號跟我們聯繫」——信箱是假的，這件事就沒有意義。

第 3 項要確認是因為 `MAILER_AUTOCONFIRM=true` 會直接跳過信箱驗證，
那等於 SMTP 設了也沒用。

在 1 與 2 完成前，MB 可以寫完並以本機測試，但不能上線。

### 其他

- **`.env.local` 的 `ADMIN_PASSWORD` 與實際帳號密碼不符。** 實測對 GoTrue
  驗證回 `Invalid login credentials`。e2e 已改為自行開拋棄式帳號、不依賴這組值，
  但 `pnpm admin:create` 之類的腳本還會讀它。


- **ai_island_v3 密路徑 `Ak83QDhUOVqx` 必須更換。** 它曾出現在公開的 robots.txt
  與每位訪客都會載入的根版面 JS chunk 中。改完程式碼救不回來——那串已經公開過。
  可用本專案的 `pnpm gen:slug` 產生新的。
- **ai_island_v3 的修正已提交至該專案 main**（`41819152`）。✅
- **後台帳號密碼已更換**（原本 9 碼）。✅
- **Supabase 公開註冊已關閉**（`GOTRUE_DISABLE_SIGNUP=true`，實測 422）。✅
- **R2 已綁自訂網域** `1page-r2.snowrealm.pet`。✅
  ⚠️ 與站台同註冊網域。**目前無須任何調整**——瀏覽器預設發出的是 host-only
  cookie（不帶 `Domain` 屬性），只有 `1page.snowrealm.pet` 收得到，
  媒體網域看不見。已確認 `src/lib/supabase/` 與 `middleware.ts` 都沒有設 `domain`。

  真正要留意的是未來某一天：**若需要跨子網域共用登入狀態**
  （例如再開一個 `app.snowrealm.pet` 要共用 session），那時會有人加上
  `Domain=.snowrealm.pet`——那一加，R2 網域就同時收得到 auth cookie，
  SVG 不進白名單的決定必須重新評估，而且會變得更不能鬆綁。

---

## 📋 接下來的 Phase

```text
Phase M  會員系統               5 段   MA–ME   ← 下一步（新增，見下方）
Phase 4  Templates + Preview     4 段   4A–4D
Phase 5  Agent                   5 段   5A–5E
Phase 6  Agent Website Tools     4 段   6A–6D
Phase 7  Workshop / Builder      3 段   7A–7C
Phase 8  QA / Deploy             5 段   8A–8E
```

Phase 4–8 依 `docs/phase-2-8-plan.md`，編號不變。
Phase 4 會把 1C 立的 `TemplateExperienceShell` 從殼變成真的：
「禁止假互動」那組測試屆時要改為驗證**真的會動**。

### Phase M — 會員系統（Spec V1.3 CR-002）

Luffy 裁決：開放公開註冊，使用者透過站內帳號與我們聯繫。
詳細分段見 `docs/phase-m-member-plan.md`。

插在 Phase 4 之前，因為會員身分是地基不是附加功能——
Phase 5 的「對話綁定帳號」與 Phase 4 的「存下調過的樣板」都要外鍵指向 `profiles.id`。
排到後面，那兩個 Phase 會先長出一套匿名資料模型再全部改一次。

```text
MA  會員身分基礎（profiles + DB trigger + RLS）
MB  註冊 / 登入 / 登出 / 忘記密碼 + 速率限制
MC  帳號內聯繫（會員端）
MD  後台收件匣
ME  導覽整合 + 後台/會員頁納入八斷點檢查
```

**權限維持兩層，刻意不合併**：`admin_users` 仍是獨立員工白名單，
不改成 `profiles.role` 一個欄位（`ai_island_v3` 的做法）。
結果是這整個 Phase **不需要改動任何一條既有 RLS policy**，
而且 profile 相關的 bug 在結構上不可能升級成管理員權限。

---

## 🧭 SnowRealm SSO（未來，先記著別擋路）

依 `SnowRealmSpace/docs/SnowRealm-Platform-Planning.md`：
SnowRealm 要做跨子網域統一登入，**issuer 尚未拍板**
（候選：Insight `tenant_users` / AI 島 Supabase / 新開專用）。
現況是五個產品各自發證，沒有任何一個是跨子網域發證方。

1page 現在自己做登入，將來要遷移。**現在做、成本近乎為零**的三件事：

1. 認證邏輯全部收在 `src/features/auth/`，頁面不直接呼叫 Supabase auth。
   換 issuer 時改一個目錄。
2. `profiles` 預留 `snowrealm_id`（可為 null）。
   前例：`SnowRealmSpace/supabase/migrations/0051_snowrealm_id_link.sql`。
3. 業務資料表外鍵指向 `profiles.id` 而非 `auth.users.id`。
   換 issuer 時只需重建 `profiles ↔ auth.users` 的對應，業務資料不動。

### ⚠️ SSO 會踩到 R2 媒體網域——這件事現在要決定

SSO 必然需要 `Domain=.snowrealm.pet` 的 cookie（不然子網域之間共用不了 session）。
那一刻起 `1page-r2.snowrealm.pet` **也會收到 auth cookie**——
它是同一個註冊網域下的子網域，瀏覽器不會區分「這台只是放圖片的」。

httpOnly 擋得住 JS 讀取，但擋不住：從媒體網域發出的請求會自動帶上 auth cookie，
`SameSite` 判定上它與站台同源站點，CSRF 的假設因此改變。
而媒體網域上的內容**是使用者上傳的**。

三個選項，愈往下愈該選：

```text
A. 什麼都不做，靠 SVG 不進白名單 + Content-Type 鎖死
   → 防線變成「上傳白名單永遠不能鬆綁」，那是把安全性押在一個未來的決定上
B. SSO cookie 改用更窄的 Domain（例如 auth.snowrealm.pet + 明確的 allow list）
   → 可行但 GoTrue 這側要客製，且每加一個產品都要改
C. 媒體換到 SSO cookie 範圍外的網域
   → 一次解決。趁媒體記錄還很少的現在做，成本最低
```

Phase M 不處理這件事（SSO 還沒開始），但 **SSO 動工前必須先決定**。
拖到有幾千筆媒體記錄之後，選項 C 就不再是「換個網域」而是資料遷移。

---

## 🔒 不得回頭破壞的約束

這些是各 Phase 立下、且有自動化測試守著的邊界。
新功能若與它們衝突，是新功能要調整，不是把測試改綠。

```text
tokens.css 是設計數值唯一來源      no-hardcoded-design-values（含具名例外清單）
--site-* 絕不出現在 :root          theme.test.ts + theme-scope.spec.ts
Demo/Concept 不得冒充客戶案例       portfolio-layout.test.ts + repository 測試
草稿在資料庫層就讀不到             rls.test.ts（繞過所有前端程式碼驗證）
presigned URL 鎖死 type/length/key r2-upload.test.ts（對真實 R2）
後台密路徑不進瀏覽器 bundle        admin-security.spec.ts
站內連結不得指向不存在的目標       no-dead-links.spec.ts
每條路由都要有畫面上的入口         audit:wiring【8】（例外須寫明理由）
Tailwind 只掃 src/，docs 弄不壞站  tailwind-source-scope.test.ts
SiteConfig 是不可信輸入            schema.test.ts（44 條，多數在驗惡意輸入）
未知 section 不使整頁崩潰          site-renderer.test.ts
```

---

## 🧭 已知取捨（不是待辦，是刻意的決定）

- **presigned 上傳不檢查 magic bytes**：檔案不經過我們的伺服器，換來的是
  不必讓 100MB 影片流經 Node 行程。MIME × 副檔名雙重比對是替代方案。
- **SVG 不在上傳白名單**：需先接伺服器端 sanitizer。R2 已改自訂網域且與站台
  同註冊網域，此決定比先前更該維持。
- **首頁為動態渲染**：讀 `searchParams` 所致。Phase 2 無快取需求，
  Phase 8 效能重測時再評估。
- **分類篩選在記憶體完成**：PostgREST 巢狀條件需 inner join，
  那會讓回傳的關聯只剩符合條件的分類，卡片就少顯示分類。
- **PWA 不做離線快取**：內容會變動的行銷網站做離線快取，
  只會讓訪客看到過期的作品集。
