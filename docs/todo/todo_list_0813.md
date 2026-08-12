# 待辦狀態校正 0813

> 這份是 2026-08-13 收工時**對照實際程式與實測結果**校正過的權威狀態。
> 前一版是 `todo_list_0811.md`（本檔即由它更名而來）。
> Phase 進度以 `docs/gate-log.md` 的 Gate 紀錄為準，那份是逐段的驗收證據。
> 規格以 `docs/1page-v1-spec.md`（**V1.4**，CR-001～003 已併入）為唯一來源。
>
> 劃掉的是 0811 之後已經完成的。

**測試總數：386 unit + 246 e2e + 56 db = 688。**（0811 時是 349）

---

## ✅ 已完成

### 舊有（0811 之前，維持完成）

- **Phase 1 — Scaffold → 首頁（1A–1E）**
  Design Token（八類）、Home Goal Context、八個 Layout Primitive、首頁 IA、八斷點 RWD + a11y。
- **Phase M — MA 會員 Profile**
  `profiles` + `on_auth_user_created` trigger + RLS，既有 20 條 policy 原封不動。
- **Phase 2 — Portfolio（2A–2F）**
  Schema + RLS、`/work` 列表 + Filter、`/work/[slug]` + SEO、Repository、後台 CRUD、R2 上傳。
- **Phase 3 — Website Engine（3A–3D）**
  SiteConfig Schema、Theme Engine（`--site-*` scoped）、Section Registry、SiteRenderer。

### ~~Phase 4 — Templates + Preview（4A–4D）~~ ✅

3 套主題預設、4 套模板（Studio / Local Business / Personal / Product）、
`buildSiteConfig(draft)`、模板選擇器、裝置切換、跨頁保存。

抓到的兩個真問題：

- **Tailwind 字型類別從 3C 起就沒產出過任何東西。** `font-[var(--x)]` 在 Tailwind
  裡歧義（font-family 還是 font-weight），結果什麼都不產出，語法沒錯、建置不失敗、
  測試不紅——畫面只是繼承了官網字體。改成 `font-(family-name:--x)`。
  發現方式是去讀瀏覽器算出來的 `font-family`。
- **裝置切換原本是假的。** Section 用的是視窗斷點（`md:`），
  在 1440px 螢幕上切成「手機」裡面仍是三欄。全部改成 container query。

### ~~Phase 5 — Agent（5A–5E）~~ ✅

NDJSON 串流、12 種意圖 / 6 種處置、服務與價格寫進快取的系統提示、
Lead 蒐集與持久化、速率限制、11 種錯誤碼、真的對話 UI。

- **模型會自己編價格**（「幾萬元起」）→ 把真實六級價格放進系統提示，
  而不是藏在一個模型可能不呼叫的工具後面。
- **匿名 Lead 寫入看似被 RLS 擋下**，實際被擋的是**讀回**（`.select("id")` 需要 SELECT 權限）。
  改成 client 端產 id、不要求 RETURNING。

### ~~Phase 6 — Agent Website Tools（6A–6D）~~ ✅

Tool Registry（`z.toJSONSchema` 產生的 schema 就是驗證器本身）、
free / workshop 兩級工具、Section 操作純函式、人工交接。

### ~~Phase 7 — Workshop / Builder（7A–7C）~~ ✅

Workshop Gate（原生 `<dialog>`）、`/start` Project Builder、
Analytics 傳輸層（19 個事件、sendBeacon、無第三方 SDK）。

- **19 個事件裡有 5 個沒有任何呼叫點**——由新增的測試抓到，五個都補上了。

### ~~Phase 8 — QA / Deploy（8A–8E）~~ ✅

結構化資料、Security 稽核、全站 A11y（每條路由 × 斷點）、效能量測、DoD 核對表。

### ~~CR-003-1 — 模板內的 AI 客服體驗~~ ✅

訪客能真的跟「被預覽的那間店」講話。實測三種問法都對：
網站上有寫的照答、沒寫的說沒寫並轉留言、問一頁起家的價格則說只負責這間店。

Spec §47 的兩個硬性要求不是靠提示詞叮嚀，是結構上給不了：
**零工具**（`tools` 直接送空陣列）、**額度另計一份**。兩條都有測試且刻意改壞驗證過。

### ~~CR-003-2 — 擴充區塊~~ ✅

新增 7 種：faq / process / stats / team / testimonials / pricing / form。
其中 pricing、testimonials、faq **本來就在型別清單裡但沒有元件**——
訪客選到會看到「這個區塊還在準備中」。

補了會自己發現下一次的守衛：`registry.test.ts` 反過來問
「enum 裡有沒有哪一個沒人實作」，沒做的必須列進 `DEFERRED` 並寫理由。

form 做成「表單的照片」：不是 `<form>`、欄位不可聚焦、另有 sr-only 說明。
原本用 `readOnly` input，畫面對但鍵盤不對（`readOnly` 仍吃 Tab，
使用者會停在三個打不了字的框上再找不到送出鈕）。axe 不報這件事。

### ~~CR-003-3 — 白名單嵌入（youtube / map）~~ ✅

收**提供者 + 識別碼**，網址由我們組。YouTube 只收 11 個 base64url 字元，
地圖整串 `encodeURIComponent`。沒列在白名單的提供者一律拒絕。

嵌入採 facade：**按下去之前不連任何第三方**。實測按前 0 個請求、按後只有
`www.google.com`。這件事單元測試證明不了，用 e2e 數請求並實際拿掉 facade 驗證過會紅。

enum 的 `map` 換成 `embed`；換完之後 `DEFERRED` 清單是空的。

### ~~CR-003-4 — Widget 拖曳編輯器（第一、二段）~~ ✅

新路由 `/edit`，導覽列「自己排版」。定價 **B**（免費編輯、存檔才付費），不需登入。

三種輸入方式、一條邏輯：滑鼠拖曳 / 鍵盤 Tab+Enter / 觸控點 ↑ ↓，
全部呼叫同一個 `moveSection`。**順序刻意反過來做**：第一段先做鍵盤，
第二段才疊拖曳——WCAG 2.1 §2.5.7 讓「之後再補」不是選項，而補做等於介面重寫。

新增區塊會插在選取那一塊後面（一律往後加會出現在頁尾下面）。
每個型別都有預設內容，否則加出來是一塊空白。

### ~~登入進不去（0813 現場修復）~~ ✅

`scripts/admin-create.mjs` 在使用者已存在時只印一行「使用者已存在」就跳過，
**從來不套用密碼**。改了 `.env.local` 的 `ADMIN_PASSWORD` 再跑一次，
畫面一路成功，資料庫裡還是建立當天那組。

證據：`encrypted_password.updated_at` 與 `created_at` 完全相同，
`last_sign_in_at` 是 `null`——那個帳號從來沒登入成功過。

順帶修掉讓它難查的那一半：登入表單原本**所有**失敗都寫「帳號或密碼不正確」，
包括連不上、被擋、限流、信箱未驗證。防帳號列舉要的是不分辨「這個 email 存不存在」，
不是不分辨「這是不是憑證問題」。

### ~~首頁沒有登入入口~~ ✅

登入頁、`profiles`、RLS、trigger 全做好了，**選單上沒有任何地方連得到登入頁**——
一般人只能自己把 `/login` 打進網址列。整個 Phase M 蓋好了房子沒有門。

現在首頁右上角有「登入」，登入後變「會員中心」。`/account` 提供 Email、
顯示名稱（可改）、登出。**兩個後台結構上分開**：`/account` 路徑公開、
`ADMIN_SEGMENT` 那條保密，有測試盯著後者不會洩漏。

### ~~專案完全沒有 CSP~~ ✅

Security 稽核 21 項全綠，而整個專案一行 CSP 都沒有——**沒有任何一項在問這件事**。

現在有 `frame-src`（只准 CR-003-3 那兩個嵌入來源）、`object-src 'none'`、
`base-uri`、`frame-ancestors`、`form-action`，加四個標準安全標頭。
稽核也補了對應檢查，驗的是「有沒有真的送出去」而不是「原始碼裡有沒有寫」。

**刻意不用 nonce**：Next 的 nonce 方案要求每頁動態渲染，靜態產生與 CDN 快取全失效。
更關鍵的是 `style-src` 不能用 nonce（nonce 對 `style=""` 屬性無效），
而 `SiteScope` 正是用 inline style 注入 `--site-*`——改了所有主題會直接失效。
所以這份 CSP 誠實說明它擋的是嵌入與注入管道，XSS 仍由 schema 與 React 逸出擋。

### ~~後台頁面沒有納入 RWD 與 a11y 斷點檢查~~ ✅（0811 已補）

---

## 🔴 真正還沒做（純程式、沒被外部卡）

### CR-003-4 第三段起 — 編輯器還缺的

```text
內容編輯      現在只能搬動與增刪，改不了區塊裡的文字
變體切換      setSectionVariant 的純函式在了，介面沒有
復原 / 重做   刪錯一塊只能「回到模板原樣」，等於全部重來
存檔 / 匯出   定價 B 的付費點。要接會員帳號（外鍵指向 profiles.id）
手機版編輯    目前只在桌面寬度驗過；觸控用按鈕可行，但版面沒為窄螢幕設計過
```

存檔那一項要等會員系統的 MB，因為「存下來」必須綁帳號。

### 分類清單沒有接上資料庫

`portfolio_categories` 表已建立且灌了 11 筆種子，但 `/work` 的篩選 UI
讀的是 `config/portfolio-categories.ts` 的硬編清單。
兩份內容目前一致，但**沒有任何機制保證它們維持一致**——
在後台新增分類不會出現在篩選器上。

同理未接線的欄位（`audit:wiring`【3】）：
`portfolio_categories.active`、`portfolio_tags` 的 join、`admin_users.note`、
`created_at`、`profiles.display_name`（MB／ME 才有讀取端）、`profiles.snowrealm_id`（等 SSO）。

> `profiles.display_name` 已在 0813 部分接線——`/account` 可以改它了，
> 但後台收件匣（MD）還沒有讀它的地方。

### 作品詳細頁的 Case Study 無法從後台編輯

`case_study_json` / `links_json` / `ai_disclosure_json` 在 schema 與公開頁完整支援，
後台編輯表單只有基本欄位。目前只能改資料庫。

### Tag 與 Service 篩選

Spec §8.7 列出「另可依 Project Type / Industry / Tag / Service 篩選」，
目前只做了 Category + Project Type。

### 「畫面上進不去」的守衛只覆蓋連結

`audit:wiring`【8】從 `/` 爬同源連結對帳磁碟路由。**抓不到**的還有：

```text
按鈕存在但點了沒反應（onClick 沒接）
表單送出後沒有任何回饋
連結存在但被 CSS 蓋住／z-index 壓住
需要登入才看得到的入口（爬蟲是匿名的）
```

最後一項在 0813 真的發生了一次——`/account` 的入口只給登入者看，
匿名爬蟲看不到，所以它被列進 `UNLINKED_BY_DESIGN`（理由與 `/admin` 不同，
已寫明）。**ME 收尾時要讓可達性檢查帶一個已登入 session 再爬一次。**

---

## ⏳ 被外部卡住 / 需 Luffy 操作

### 🔴 最高優先：SMTP，順序不能反

1page 目前**一個 `GOTRUE_SMTP_*` 都沒有**。
`SnowRealmSpace` 是同一套自架 GoTrue，`.env.local` 有可直接照抄的完整組態。

```text
1. 先設好 SMTP
2. 再把 GOTRUE_DISABLE_SIGNUP 改成 false
3. 確認 GOTRUE_MAILER_AUTOCONFIRM 不是 true
```

**順序反了會出事**：先開註冊、後設 SMTP，中間任何人都能用不存在的信箱
建立**已確認**的帳號。而 CR-002 開放註冊的目的正是「使用者透過帳號跟我們聯繫」，
信箱是假的這件事就沒有意義。第 3 項要確認是因為 `AUTOCONFIRM=true`
會直接跳過驗證，等於 SMTP 設了也沒用。

**這一項現在卡著三件事**（0813 實測 GoTrue 仍回 `signup_disabled` 422）：

```text
註冊功能        一般人現在根本註冊不了，只有你手動建的帳號能用
會員自助改 Email 需要驗證信
Phase M 的 MB   註冊/登入/忘記密碼 UI
```

會員中心刻意**沒有**放註冊與改 Email 的按鈕——做一顆按了會 422 的按鈕比沒有更糟。

### 其他

- ~~`.env.local` 的 `ADMIN_PASSWORD` 與實際帳號密碼不符~~ ✅ 0813 已修，
  且 `admin:create` 現在會真的更新既有帳號的密碼並印出來說它做了。
- **ai_island_v3 密路徑 `Ak83QDhUOVqx` 必須更換。**（仍未處理）
  它曾出現在公開的 robots.txt 與每位訪客都載入的根版面 JS chunk 中。
  改程式碼救不回來——那串已經公開過。可用 `pnpm gen:slug` 產新的。
- **`NEXT_PUBLIC_ANALYTICS_ENDPOINT` 尚未設定。** 沒設的話 19 個分析事件
  全部靜靜地不送出（這是刻意的 fallback，不是 bug）。
- **FAQ 仍有四個空缺**：工期、修改次數、付款方式、維護。
  `config/faq.ts` 只放已經在網站上出現過的事實，這四項要你給答案。
- **部署後要跑 `pnpm audit:perf --url <線上網址>`。** 目前的 LCP／CLS 數字
  都來自 localhost，不能當數。
- ~~ai_island_v3 的修正已提交至該專案 main（`41819152`）~~ ✅
- ~~後台帳號密碼已更換~~ ✅
- ~~R2 已綁自訂網域 `1page-r2.snowrealm.pet`~~ ✅
  ⚠️ 與站台同註冊網域。**目前無須調整**——瀏覽器發出的是 host-only cookie，
  媒體網域收不到。真正要留意的是未來若需跨子網域共用登入狀態（見下方 SSO）。

---

## 📋 接下來的 Phase

```text
Phase 1  ✅   Phase 5  ✅
Phase 2  ✅   Phase 6  ✅
Phase 3  ✅   Phase 7  ✅
Phase 4  ✅   Phase 8  ✅
Phase M  MA ✅ ／ MB–ME 卡在 SMTP
CR-003   1 ✅ 2 ✅ 3 ✅ 4 第一二段 ✅，第三段起見上方
```

### Phase M — 會員系統（Spec V1.3 CR-002）

```text
MA  會員身分基礎（profiles + DB trigger + RLS）        ✅
MB  註冊 / 登入 / 登出 / 忘記密碼 + 速率限制           🔴 卡 SMTP
MC  帳號內聯繫（會員端）                               ⬜
MD  後台收件匣                                         ⬜
ME  導覽整合 + 後台/會員頁納入八斷點檢查               🟡 導覽已做，斷點檢查未做
```

登入、登出、會員中心、導覽入口在 0813 已經做掉了（原本歸在 MB／ME），
MB 真正剩下的是**註冊與忘記密碼**，兩個都要信件。

**權限維持兩層，刻意不合併**：`admin_users` 仍是獨立員工白名單，
不改成 `profiles.role` 一個欄位。結果是整個 Phase 不需要改動任何一條既有 RLS policy，
而 profile 相關的 bug 在結構上不可能升級成管理員權限。

---

## 🧭 SnowRealm SSO（未來，先記著別擋路）

SnowRealm 要做跨子網域統一登入，**issuer 尚未拍板**。
1page 現在自己做登入，將來要遷移。**現在做、成本近乎為零**的三件事：

1. 認證邏輯收在 `src/features/{account,admin}/auth.ts`，頁面不直接呼叫 Supabase auth。
2. `profiles` 預留 `snowrealm_id`（可為 null）。
3. 業務資料表外鍵指向 `profiles.id` 而非 `auth.users.id`。

### ⚠️ SSO 會踩到 R2 媒體網域——這件事現在要決定

SSO 必然需要 `Domain=.snowrealm.pet` 的 cookie。那一刻起
`1page-r2.snowrealm.pet` **也會收到 auth cookie**，而媒體網域上的內容
**是使用者上傳的**。

```text
A. 什麼都不做，靠 SVG 不進白名單 + Content-Type 鎖死
   → 把安全性押在一個未來的決定上
B. SSO cookie 改用更窄的 Domain
   → 可行但 GoTrue 這側要客製，每加一個產品都要改
C. 媒體換到 SSO cookie 範圍外的網域
   → 一次解決。趁媒體記錄還很少的現在做，成本最低
```

**SSO 動工前必須先決定。** 拖到有幾千筆媒體記錄之後，
選項 C 就不再是「換個網域」而是資料遷移。

---

## 🔒 不得回頭破壞的約束

這些是各 Phase 立下、且有自動化測試守著的邊界。
新功能若與它們衝突，是新功能要調整，不是把測試改綠。

```text
tokens.css 是設計數值唯一來源       no-hardcoded-design-values（含具名例外清單）
--site-* 絕不出現在 :root           theme.test.ts + theme-scope.spec.ts
Demo/Concept 不得冒充客戶案例        portfolio-layout.test.ts + repository 測試
草稿在資料庫層就讀不到              rls.test.ts（繞過所有前端程式碼）
presigned URL 鎖死 type/length/key  r2-upload.test.ts（對真實 R2）
後台密路徑不進瀏覽器 bundle         admin-security.spec.ts + account-entry.spec.ts
站內連結不得指向不存在的目標        no-dead-links.spec.ts
每條路由都要有畫面上的入口          audit:wiring【8】（例外須寫明理由）
Tailwind 只掃 src/                  tailwind-source-scope.test.ts
SiteConfig 是不可信輸入             schema.test.ts
未知 section 不使整頁崩潰           site-renderer.test.tsx
每個 section type 都要有元件         registry.test.ts（DEFERRED 須寫理由）
每個可新增的型別都要有預設內容       section-presets.test.ts
客服 demo 零工具、額度分開           demo-assistant-isolation.test.ts
嵌入按下去之前不連第三方            embed-blocks.spec.ts
拖曳一定要有鍵盤替代路徑            section-editor.spec.ts（用 Tab 走，不是 .focus()）
限流在請求驗證之前                  audit:security（比位置，不是比寫法）
CSP 真的有送出且限制 frame-src      audit:security
```

---

## 🧭 已知取捨（不是待辦，是刻意的決定）

- **presigned 上傳不檢查 magic bytes**：檔案不經過我們的伺服器，
  換來的是不必讓 100MB 影片流經 Node 行程。MIME × 副檔名雙重比對是替代方案。
- **SVG 不在上傳白名單**：需先接伺服器端 sanitizer。
- **首頁為動態渲染**：讀 `searchParams` 所致。
- **分類篩選在記憶體完成**：PostgREST 巢狀條件需 inner join，會讓卡片少顯示分類。
- **PWA 不做離線快取**：內容會變動的行銷網站做離線快取只會讓訪客看到過期作品。
- **CSP 用 `'unsafe-inline'` 而非 nonce**：見上方「專案完全沒有 CSP」那段。
- **編輯器的還原有一瞬間的預設畫面**：還原在掛載後的 effect 做
  （放進初始值會 hydration mismatch）。回訪時會先看到 server 那版一幀。
- **觸控不做拖曳**：手機上拖曳與捲動會打架，半殘的觸控拖曳會讓人連捲都捲不動。
  觸控使用者用工具列按鈕，那本來就好點。

---

## 🪤 這個專案反覆踩到的同一種毛病

記在這裡是因為它已經出現**六次**，而且每次都不會報錯、測試照樣綠：

> **宣告了一個東西，卻沒有任何地方用到它。**

```text
1. spacingScale 注入了 --site-spacing，沒有任何 CSS 讀它
2. 路由做好了，畫面上沒有入口                    → audit:wiring【8】
3. 19 個分析事件裡 5 個沒有呼叫點                → analytics-call-sites.test.ts
4. pricing/testimonials/faq 在 enum 裡但沒有元件  → registry.test.ts
5. 登入系統做完了，選單上沒有登入按鈕            → account-entry.spec.ts
6. Security 稽核 21 項全綠，而專案沒有 CSP        → audit:security 新增檢查
```

孿生的一條：**守衛通過不等於守衛有效。** 0813 抓到三個名不副實的綠燈——
`audit:security` 的限流檢查比對的是呼叫寫法而不是位置；
兩條測試拿「還沒實作的 type」當例子，實作之後一條紅、一條照樣綠但驗錯東西；
編輯器的鍵盤測試用 `.focus()`，連 `tabIndex={-1}` 都能過。

**每加一個守衛，就故意把程式改壞一次，確認它真的會紅、而且訊息說得出問題在哪。**
