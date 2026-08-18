# 待辦狀態校正 0815

> 這份是 2026-08-15 收工時**對照實際程式與實測結果**校正過的權威狀態。
> 前一版是 `todo_list_0813.md`（本檔即由它更名而來）。
> Phase 進度以 `docs/gate-log.md` 的 Gate 紀錄為準，那份是逐段的驗收證據。
> 規格以 `docs/1page-v1-spec.md`（**V1.4**，CR-001～003 已併入）為唯一來源。
>
> 劃掉的是 0811 之後已經完成的。

**測試總數：552 unit + 384 e2e/visual + 78 db = 1014。**（0815 收工時是 946）
> 逐項工作紀錄見 `docs/worklog/daily_works_0813.md`、`daily_works_0814.md`、
> `daily_works_0815.md` 與 `daily_works_0818.md`。
>
> ⚠️ e2e 目前有 **2 條紅的，而且是刻意的**：R2 bucket 沒有 CORS 設定，
> 瀏覽器上傳一律送不出去。那是基礎設施沒設好，不是程式壞了——
> 紅燈要留到它真的能用為止。修法見「需 Luffy 操作」那一節。

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

### ~~CR-003-4 — Widget 拖曳編輯器（全五段）~~ ✅

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

## ✅ 0814–0815 做掉的（原本列在「真正還沒做」）

### ~~草稿載回編輯器~~ ✅

存檔功能原本**只寫不讀**：`saved_sites` 存的是 `buildSiteConfig()` 算出來的
成品，而成品裡沒有「當初選的是哪一套模板」——那個資訊在算出成品的
那一刻就被丟掉了。存得進去、永遠打不開。

改成存輸入：資料庫與 sessionStorage 現在是同一份文件、同一個 schema
（`editor-state.ts`）。兩邊各存各的形狀正是這次載不回來的原因。
`/edit?draft=<id>`，入口在會員中心的「編輯」；再按存檔是更新那一份。

### ~~編輯器新增／刪除單一項目~~ ✅

模板給三個服務、使用者有四個，那第四個原本永遠加不上去。
刪到剩一項停手——不是為了留內容，是因為欄位形狀是從現在的值認出來的，
空陣列既是空字串清單也是空項目清單，分不出來。

順帶修掉這功能一加上去就會出現的 bug：各 section 元件一律用
`key={item.label}`，而新增出來的項目 label 是空字串。

### ~~編輯器圖片上傳~~ ✅（程式完成，卡在 R2 CORS）

做這件事的過程中發現**媒體上傳從來沒有在瀏覽器裡成功過**，三層都擋著：

```text
1. next.config 沒有 images.remotePatterns   已修
   r2.ts 的 publicHostnames() 註解寫著「供 next.config 取得」，零呼叫點
2. CSP 的 connect-src 沒有 R2 的 S3 端點     已修
   昨天加 CSP 那天擋掉的，而 21 項稽核沒有一項在問「加了 CSP 之後
   既有功能還能不能用」
3. R2 bucket 沒有 CORS 設定                  🔴 要在 Cloudflare 後台設
```

### ~~分類清單接上資料庫~~ ✅

`/work` 與 `/work/[slug]` 改讀 `portfolio_categories`；
`config/portfolio-categories.ts` 退成種子（seed.sql 的來源 + 無資料庫時的
fallback），`test:db` 有一條在比對兩者。

### ~~Tag 與 Service 篩選（Spec §8.7）~~ ✅

`portfolio_project_tags` 的 join 終於有讀取端。收在「更多篩選」裡。
Industry 沒做：目前只有兩個不同的值，一個兩選一的篩選器不值得一排 chips。

### ~~後台可編輯 Case Study~~ ✅

`case_study_json` / `links_json` / `ai_disclosure_json` 加上 industry、
year、services 全部進了後台表單。原本只能直接改資料庫——
公開頁面畫得出來、後台填不進去，是「有讀取端沒有寫入端」。

⚠️ 過程中踩到一個只有用真資料才問得出來的問題：連結欄位用了
`type="url"`，而 `interior-studio` 的 demo 連結是站內路徑
`/work/interior-studio`。**打開那件作品、什麼都不改、按儲存就會失敗**，
而且瀏覽器只給一個氣泡提示，畫面上沒有任何我們自己的錯誤訊息。

### ~~可達性檢查帶已登入 session（ME）~~ ✅

`audit:wiring`【8】的爬蟲是匿名的，看不到只給登入者的入口。
`authed-reachability.spec.ts` 帶真的 session 爬兩次（會員 / 員工），
後台每一頁都必須在後台自己的選單裡走得到。

順帶修掉 `audit:wiring`【3】：它掃的是**五個寫死的檔案**，
之後新增的 leads、profiles、saved_sites 全部不在清單上，
於是它們用到的欄位一律被報成「沒有任何程式碼取用」。
改成掃整個 src（173 個檔案），實際取用的欄位從 20 變成 37。
**audit:wiring 現在 0 失敗 0 警告。**

### ~~`_dev/theme` 過期的降級示範~~ ✅

註解說最後一塊是「尚未實作的 pricing」，而 CR-003-2 之後 pricing 有元件了。
同一個錯誤在兩條測試裡犯過，這是第三次也最安靜的一次——那不是測試，
沒有東西會紅。改成去 registry 算。

---

## ✅ 0815 做掉的（CR-004 Phase B 的 BE / BF / BI / BJ）

### ~~BE — 報價與成交（deals / deal_items）~~ ✅

後台「報價」：列表（進行中金額合計、依階段篩選）、詳細頁（明細、
備註、時間軸）、客戶詳細頁上的報價區。

未成交一定要寫原因，**兩層都擋**：資料庫的 check constraint 是真正的
邊界（任何寫入路徑都繞不過去），action 那一層是為了說人話——
拿掉它之後畫面上出現的是 `violates check constraint "deals_lost_needs_reason"`。

### ~~BF — 專案、里程碑與工時（engagements）~~ ✅

後台「專案」：逾期標示、里程碑打勾／退回、工時。
報價詳細頁加了「開成專案」，名稱與客戶一起帶過去。

工時存**分鐘**，輸入收「90」「1:30」「1.5h」。看不懂就說看不懂，
不猜——猜一個值的話，打錯的那一次會安靜留下一筆看起來很正常的錯資料。
顯示成「1 小時 30 分」而不是「1.5 小時」。

### ~~BI — 全站每一頁每個區塊都可以在後台改~~ ✅

內容管理從兩份長到十四份：首頁的每一段、作品頁與需求表單頁的頁首、
登入頁文案、頁尾、以及首頁版面。

編輯介面從 JSON 改成**表單**（照著內容的形狀長出來，加新 key 不必動
編輯器）。JSON 留在「進階」後面。

界線：**這裡改的是字，不是行為。** `home.goals` 只收 label 與
description；連結只收站內路徑；後台刪掉一個目標不會讓按鈕消失，
只是回到預設文案。

順手修掉登入頁「此頁供工作人員使用」——CR-002 之後就不成立了。

### ~~BJ-1 — 每一塊都可以換背景~~ ✅

純色／漸層／圖片／影片，加遮罩與模糊。參考 MaoTravelBlog 的
PropertyPanel，但三個地方刻意不一樣：

```text
遮罩預設不是 0        照片上壓文字幾乎一定對比不足，而那件事
                      在自己的螢幕上看不出來
reduced-motion 不用 CSS 藏  純 CSS 只能藏：影片仍然會下載、會播。
                      改成問過之後才決定要不要「放」video 元素
背景整層 aria-hidden  它是裝飾，不是內容
```

媒體上傳因此開始收影片——那個 action 原本的註解寫著「沒有任何地方會
播影片，收得進來卻沒有人讀」，現在真的有讀取端了。

### ~~BJ-2 — 首頁版面可以在後台排~~ ✅

拖曳排順序、開關每一塊、每一塊設背景。拖曳與鍵盤呼叫同一個純函式
（WCAG 2.1 §2.5.7），並有測試驗兩者結果相同。

⚠️ **界線寫在編輯器上方，不是只寫在註解裡**：首頁那些區塊不是文字
方塊。目標選擇器是整頁的 context controller、AI 顧問是一段真的會對話
的介面、模板體驗裡面是一整個預覽引擎——它們搬得動、關得掉，但沒辦法
再拖一個進來。做一個看起來什麼都能拖、實際上只有三種積木有用的畫布，
比誠實說明更糟。

---

### ~~BG — 請款與收款（invoices / invoice_lines / payments）~~ ✅

後台「請款」：列表（還沒收回來的金額、逾期標示、依狀態篩選）、
詳細頁（明細、收款、對不上時的提醒）。客戶頁與專案頁都有入口。

⚠️ **沒有金流，也不打算有。** 畫面上寫著「這裡只是記帳，不會真的去收錢」，
而且那句話有一條 e2e 盯著。

```text
明細改了就重算總額並存回去   兩份真相最典型的樣子：一份在 invoice_lines，
                             一份在 invoices.total。不同步的話，
                             客戶收到的金額與系統裡的不一樣
收款不會自動翻狀態           收了一半就標成已收款，「還差多少」就再也
                             算不出來——而那是這整張表存在的理由
重複編號由資料庫擋           會計事故，不是 UI 問題。應用層負責說人話
稅率不存欄位                 只存結果（subtotal/tax/total）。已開出去的單
                             不能因為之後改稅率而變。編輯時從比例反推
```

---

## ✅ 0818 做掉的

### ~~CR-003-5 — 前台的 CRM 設計器~~ ✅

`/crm`：分幾類、每一類記哪些東西，自己決定。六種欄位型別、拖曳與鍵盤
排順序、復原／重做、預覽。存下來之後在「我的 CRM」照著它填資料。

**定價與網站編輯器一致**：設計免費不用登入（狀態在 sessionStorage），
存檔才要帳號。匯出 JSON 也免費——那是使用者自己設計的東西。

```text
絕對不下 DDL              一張表配 jsonb，RLS 一條。使用者的定義去 create table
                          等於把 DDL 權限交給不可信輸入
記錄的 owner 由 trigger    不靠呼叫端記得帶。帶錯的話是一筆寫進別人 CRM 的資料
insert policy 問定義       ⚠️ 不是問 owner_id。實測過三種組合：只驗 owner_id
的擁有權                   而且沒有 trigger 的話，B 真的把記錄寫進 A 的 CRM。
                          現在兩層各自都擋得住，不是互相依賴
搬動的規則與網站編輯器      抽在 `lib/reorder` 的 `moveInOrder`。
共用同一份                  拖曳一步一步呼叫它走過去，所以三種輸入方式
                          在結構上不可能有不同的行為（WCAG 2.1 §2.5.7）
```

**e2e 抓到兩個單元測試沒抓到的東西**：SaveBar 的 `onSaved` 是 inline
箭頭函式，每次 render 都是新身分 → effect 每次都跑 → 無限重繪；
以及**必填的文字欄位收得下空字串**（`z.string()` 讓 `""` 過關，
所以「必填」在伺服器端等於不存在）。兩個都補了單元測試。

### ~~`portfolio_media.thumbnail_url`~~ ✅（移除，不是接上）

它從 0810 建表起就**兩端都沒有**：沒有人寫，讀出來之後也沒有元件在畫。
待辦原本寫「要接一條產生縮圖的路徑」，但真的接了會疊出第二套更差的
機制——`next/image` 的最佳化器本來就依 `sizes` 產出對的尺寸。

它掩蓋掉的真問題是相簿用原生 `<img>`、沒有寬高（CLS）。
所以改存 `width` / `height`，由瀏覽器在上傳後量出來，
成對與否由資料庫的 `media_dimensions_paired` 擋。

### ~~後台編不了作品的分類與標籤~~ ✅（其實 0814 就做完了）

⚠️ **這一條是待辦本身過期**，不是新做的。`a50670c` 已經做掉了
repository、action、勾選框與 e2e，而待辦上還寫著「還沒做」。
過期的待辦與過期的守衛是同一種毛病：它照樣看起來很正常。

---

## 🔴 真正還沒做（純程式、沒被外部卡）

### 時間軸不顯示「誰做的」

`activities.actor_id` 由 trigger 以 `auth.uid()` 寫入，但沒有任何地方讀它。
目前只有一位員工，顯示「誰做的」沒有資訊量——**多人之後要顯示**，
不然那一欄就白存了。已列在 `audit-wiring` 的具名例外裡並寫了理由。

### 直接改資料庫，前台不會跟著變

CMS 的讀取端有快取，而快取由 tag 失效，**tag 只在 action 存檔時被打掉**。
所以用 SQL 改 `cms_documents` 之後，首頁最長一小時內還是舊的。

這不是 bug，是設計的一面，但要有人知道。目前寫在
`tests/e2e/admin-layout.spec.ts` 的註解裡。之後若真的需要「從外部
讓內容立刻生效」，那是一條要另外設計的路徑（帶密鑰的 revalidate 端點）。

### CR-004 剩下的部分

Phase B 的 BA–BJ 都做完了，CR-003-5 也在 0818 收尾。
**CR-004 沒有剩下的程式工作了。**

### 「畫面上進不去」的守衛只覆蓋連結

`audit:wiring`【8】從 `/` 爬同源連結對帳磁碟路由。**抓不到**的還有：

```text
按鈕存在但點了沒反應（onClick 沒接）
表單送出後沒有任何回饋
連結存在但被 CSS 蓋住／z-index 壓住
```

需要登入才看得到的入口那一項已由 `authed-reachability.spec.ts` 補上。

0815 補了兩條相關的：

```text
audit:wiring【3】改成表級      from("table") 從來沒出現過 = migration 跑了
                               但功能沒做。原本是整份原始碼的子字串比對，
                               而 invoices.number 會被 typeof x === "number"
                               裡的 number 命中——三張孤兒表全部漏掉
authed-breakpoints 從磁碟列舉   後台的 RWD/a11y 清單原本寫死三條路由，
                               之後加的六個頁面一條都沒掃過
```

0818 又補了一條同型的：

```text
會員區也改成從磁碟列舉   0815 沒動它，因為它**剛好還是完整的**——
                        而「剛好還對」與「不會過期」是兩回事。
                        加了「我的 CRM」之後它就會開始漏
```

---

## 🏗 CMS / CRM / ERP 的設計（CR-004 Phase B）

> 這一節是**設計**，不是願望清單。每一段都要能直接開工。
> 上位文件是 `docs/cr-004-draft.md`（含五個待裁決的問題）。

### 貫穿三塊的四條規則

```text
1. 命名從第一天就分開
   engagements（接案專案）  ≠  portfolio_projects（對外作品）
   backoffice（我們的 CRM） ≠  crm-builder（訪客自己設計的）
   員工是 admin_users.role，會員沒有角色
   → 參考專案兩次踩到「同一個字兩個意思」，兩次都得回頭寫警告

2. 所有新表一律 RLS，而且只給員工
   alter table <t> enable row level security;
   create policy "<t>_staff_all" on <t> for all
     using (is_staff()) with check (is_staff());
   例外要寫理由（見各段）

3. 每一頁都要進 features/dashboard/nav.ts
   nav.test.ts 兩個方向都問：磁碟上有沒有哪頁不在導覽裡、
   導覽裡有沒有哪項連到不存在的頁。做好了進不去就是沒做

4. 每加一張表，audit:wiring【3】會立刻問「這些欄位有沒有人讀」
   建好表卻還沒接 UI 的那段時間稽核是紅的——那是對的，不要急著加例外
```

---

### 一、CMS（BH）

**它現在就在痛**：網站文案寫死在程式碼裡，改一句話要走一次 commit 與部署。

```text
src/config/faq.ts          待辦上「四個空缺」要改程式才補得上
src/config/pricing.ts      六級價格，而且同時餵給 Agent 的系統提示
src/config/home-copy.ts    首頁文案
```

#### 資料表

```sql
cms_documents (
  id uuid pk,
  key text unique not null,        -- 程式碼指定，例如 'faq.list'、'pricing.tiers'
  title text not null,             -- 給後台看的名字
  status text not null,            -- draft | published
  published_at timestamptz,
  updated_at timestamptz
)

cms_blocks (
  id uuid pk,
  document_id uuid not null references cms_documents on delete cascade,
  sort_order int not null,
  content jsonb not null           -- 形狀沿用 SiteSection，重用既有 schema
)

cms_revisions (
  id uuid pk,
  document_id uuid not null references cms_documents on delete cascade,
  blocks jsonb not null,           -- 發佈當下的整份快照
  published_by uuid references profiles,
  published_at timestamptz not null default now()
)
```

#### 三條不能省的規則

```text
key 由程式碼指定，不是使用者自己取
  → 每一個 key 都保證有讀取端。守衛反過來問兩件事：
    「資料庫裡有沒有 key 沒有任何程式在讀」
    「程式讀的 key 有沒有哪個資料庫裡沒有」

不做「任意頁面產生器」
  → CMS 管既有頁面的既有欄位，不長新路由。
    新路由沒有對應的元件就只是一個 404，而且會直接撞上 §40

發佈才生效，草稿只有後台看得到
  → 與作品集同一套心智模型。改到一半重新整理，前台不該跟著變
```

#### 快取

文案進資料庫，首頁就從靜態變成要查資料庫。用 `revalidateTag`：
發佈時打掉那個 key 的快取，平常仍是快取命中。**不做「每次請求都查」**——
首頁載入速度是這個網站的賣點之一，而且有一支效能稽核在盯。

#### ⚠️ 最容易漏的一條：Agent 的系統提示

`config/pricing.ts` 現在**同時**餵給 Agent 的系統提示。
（Phase 5「模型會自己編價格」那個 bug 的修法，就是把真實價格放進提示。）

價格改成從 CMS 讀之後，那條路徑要跟著改，否則會出現
**畫面上是新價格、AI 講的是舊價格**——而且沒有任何地方會報錯。

要有一條測試：Agent 系統提示裡的價格，必須與 CMS 讀出來的是同一份。

#### 分段

```text
BH-1  cms_documents / cms_blocks / cms_revisions + RLS + 後台列表
BH-2  區塊編輯（重用 CR-003-4 的 widget 編輯器）+ 發佈／回復版本
BH-3  接 FAQ 與價格兩處（含 Agent 系統提示那條線）
```

首頁全文案化留到之後——一次全部搬進 CMS 會讓 BH 變成三段以上的量。

---

### 二、CRM（BD / BE）

一頁起家是接案工作室，所以 CRM 的骨架是
**詢問 → 客戶 → 報價 → 成交**，不是通用的聯絡人管理。

#### 骨架

```text
leads（訪客說了什麼，不可變）
  └─ client_id ─→ clients（我們對這個客戶的理解，會一直改）
                    ├─ client_contacts（一個客戶可以有多個聯絡人）
                    └─ deals ─→ engagements ─→ invoices
```

⚠️ **`leads` 不動。** 它是訪客留下的原始記錄——那是**證據**，
不該被後續編輯覆蓋。只加一個 `leads.client_id`（可為 null）表示
「這筆詢問已經轉成某個客戶」。

把 lead 直接當客戶來編輯的話，「他當初說的」與「我們後來改的」就分不開了，
而談價格談到一半時那件事會很重要。

#### BD：客戶與聯絡記錄

```sql
clients (
  id uuid pk,
  name text not null,              -- 公司或個人
  kind text not null,              -- company | individual
  industry text,
  status text not null,            -- prospect | active | past
  source text,                     -- 從哪來（lead / 介紹 / 自己找上門）
  created_at, updated_at
)

client_contacts (
  id uuid pk,
  client_id uuid not null references clients on delete cascade,
  name text not null,
  email text, phone text, title text,
  is_primary boolean not null default false
)

notes (
  id uuid pk,
  -- 多型關聯：一則備註可以掛在 client / contact / deal / engagement 上
  subject_type text not null,      -- 用 check constraint 限定，不用 enum
  subject_id uuid not null,
  body text not null,
  internal boolean not null default true,   -- 內部備註永遠不給客戶看
  author_id uuid references profiles,
  created_at
)

activities (
  id uuid pk,
  subject_type text not null, subject_id uuid not null,
  kind text not null,              -- created | status_changed | note_added | ...
  detail jsonb not null default '{}',
  actor_id uuid references profiles,
  created_at
)
```

**`activities` 由 trigger 寫，不靠呼叫端記得寫。**
靠呼叫端的話，漏掉的那個操作就是時間軸上一段空白，而且沒有人會發現——
這與 `updated_at` 用 trigger 維護是同一個理由。

**lead → client 的轉換是一個明確的動作**（後台按「建立客戶」），不是自動的。
自動轉的話，一堆試填的假詢問會變成一堆假客戶。

#### BE：報價與成交

```sql
deals (
  id uuid pk,
  client_id uuid not null references clients,
  title text not null,
  stage text not null,             -- inquiry | quoted | negotiating | won | lost
  amount numeric(12,2),            -- 報價金額
  currency text not null default 'TWD',
  expected_close date,
  lost_reason text,                -- 輸了要寫原因，那是最有用的資料
  created_at, updated_at
)

deal_items (
  id uuid pk,
  deal_id uuid not null references deals on delete cascade,
  service_id text,                 -- 對應 config/services.ts
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  sort_order int not null
)
```

```text
階段用 text + check constraint，不用 enum
  → enum 加一個值要 migration，而銷售流程的階段一定會被改

金額用 numeric，不是 float
  → 錢不能用二進位浮點數。這條沒有例外

輸掉要寫原因
  → 沒有 lost_reason 的 CRM 只是一份聯絡簿
```

檢視方式做兩種：清單（可排序、可篩階段）與看板（依階段分欄）。
看板的拖曳沿用 CR-003-4 那一組——**含鍵盤替代路徑**，
WCAG 2.1 §2.5.7 對後台一樣成立。

---

### 三、ERP（BF / BG）

規模誠實說：這是一間小工作室的「專案與帳務」，不是製造業 ERP。
不做庫存、不做採購、不做多幣別成本分攤。

#### BF：專案與工時

```sql
engagements (                      -- 刻意不叫 projects
  id uuid pk,
  client_id uuid not null references clients,
  deal_id uuid references deals,   -- 從哪一筆報價來的
  title text not null,
  status text not null,            -- planning | active | paused | delivered | closed
  started_on date, due_on date, delivered_on date,
  portfolio_project_id uuid references portfolio_projects,  -- 做完了變成作品
  created_at, updated_at
)

milestones (
  id uuid pk,
  engagement_id uuid not null references engagements on delete cascade,
  title text not null,
  due_on date,
  done_on date,
  payment_ratio numeric(5,2)       -- 這個節點對應多少比例的請款
)

time_entries (
  id uuid pk,
  engagement_id uuid not null references engagements on delete cascade,
  worked_on date not null,
  minutes int not null,            -- 存分鐘，不是小時的小數
  note text,
  actor_id uuid references profiles,
  created_at
)
```

```text
engagements ≠ portfolio_projects，但接得起來
  → portfolio_project_id 讓「做完的案子變成作品」是一個明確的動作

工時存分鐘
  → 小時用小數會出現 0.30 到底是 18 分還是 30 分的問題

先只做手動填，不做計時器
  → 計時器要處理「忘了停」「跨日」「多裝置同時開」，那是獨立的小專案
```

#### BG：帳務

⚠️ **這個專案沒有任何金流串接，這一段也不做。**
`invoices` 與 `payments` 是**記帳**，不是收錢：自己開發票、自己對帳，
系統只把「誰欠多少、收了沒」記下來。

做成看起來會自動收錢的樣子，比沒有更糟——那是 SMTP 那件事的同一個教訓
（做一顆按了會 422 的註冊按鈕，比沒有那顆按鈕更糟）。

```sql
invoices (
  id uuid pk,
  client_id uuid not null references clients,
  engagement_id uuid references engagements,
  number text unique not null,     -- 自己的請款單編號
  status text not null,            -- draft | sent | paid | void
  issued_on date, due_on date,
  subtotal numeric(12,2) not null,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  created_at, updated_at
)

invoice_lines (
  id uuid pk,
  invoice_id uuid not null references invoices on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  sort_order int not null
)

payments (
  id uuid pk,
  invoice_id uuid not null references invoices on delete cascade,
  paid_on date not null,
  amount numeric(12,2) not null,
  method text,                     -- 匯款 / 現金 / 其他
  note text
)
```

```text
total 存下來，不是每次算
  → 稅率與折扣規則會變，而已開出去的請款單金額不能跟著變

分期收款用多筆 payments，不是改 invoice
  → 收了一半就把 invoice 改成 paid 的話，帳就對不起來了

編號 unique
  → 重複的請款單編號是會計上的事故，不是 UI 問題。資料庫擋
```

---

### 四、前台的 CRM 設計器（CR-003-5）

Luffy：「前台也加上一個可以自己設計 CRM 的模組，一樣套 widget 排版」

**與後台的 CRM 是兩件完全不同的東西**，不共用資料表也不共用命名。

```text
crm_definitions   使用者設計的結構（zod 驗過的 JSON）
crm_records       owner_id + definition_id + entity + data jsonb
```

⚠️ **絕對不拿使用者的定義去下 DDL。** 「他定義一張表，我們就 create table」
等於把 DDL 權限交給不可信輸入：每個使用者一組表、改欄位＝線上 migration、
表名來自使用者輸入。一張表配 jsonb，RLS 一條就夠（`owner_id = auth.uid()`）。

重用 CR-003-4 的拖曳、鍵盤上下移、復原／重做、選取狀態、存檔——
**不是重寫一個編輯器，是換一組 widget**。

定價與網站編輯器一致（免費設計、存檔要帳號），筆數上限用 DB trigger 擋。

---


---

## 🌐 跨專案：upgrade.md 與 SnowRealm-Platform（Luffy 0815 交辦，尚未開工）

> 這一節是**還沒做**的事，寫在這裡是為了不要靠記憶。
> 交辦原文見 0815 的對話：「其他專案的整個專案，如果有想到可以升級
> 優化的地方，放到他們各自的 docs 資料夾，取名 upgrade.md」。

### 為什麼還沒開工

Luffy 明確排過順序：「等現在這個 1page 專案你可以做的待辦都做完，
再做我剛剛提到的」。1page 這邊的 CR-004 Phase B 到 BJ 為止已經收尾，
所以這一節現在是**下一個可以開工的東西**。

### 一、各專案的 `docs/upgrade.md`

八個專案，每一個都要**先讀懂它在做什麼再出手**——
不讀就寫的升級建議會變成一份通用的最佳實踐清單，那種東西沒有人會看。

```text
D:\SnowRealmRebirth\GLACERA
D:\SnowRealmRebirth\AI\ai_island_v3
D:\SnowRealmRebirth\md2deck
D:\SnowRealmRebirth\snowrealm-insight-engine\insight-engine
D:\SnowRealmRebirth\snowrealm-pet\MaoTravelBlog
D:\SnowRealmRebirth\SnowRealmSpace
D:\SnowRealmRebirth\SnowRealmYukiBoard
D:\SnowRealmRebirth\tammon_crawler_project
```

每一份 `upgrade.md` 至少要能回答：

```text
1. 這個專案在做什麼、現在到哪裡      不是複述 README，是讀完程式碼之後的判斷
2. 最該先修的三件事，附理由          「最該先」要說得出為什麼是它而不是別的
3. 可以從 1page 搬過去的東西         已經驗證過的做法，不是想法
4. 不建議做的事                      同樣重要。省下的時間才是最實在的升級
```

**已經知道可以搬過去的（1page 這邊實際驗證過的）**：

```text
presign 直傳 + XHR 進度          ai_island 的 /api/upload 讓檔案經過自己的
                                 伺服器，大檔會佔滿 serverless 的記憶體與時間
「反過來問」型的守衛             不要列「faq 要有元件」，要問「清單裡有沒有
                                 哪一個沒人實作」。前者每次新增都要記得補
故意改壞驗守衛                   每加一個守衛就把程式改壞一次。這次又抓到
                                 兩個我自己寫的假守衛
稽核腳本要先去掉註解             同一個原因造成過一次假通過、一次假失敗
表級的接線稽核                   `from("table")` 從來沒出現過 = migration 跑了
                                 但功能沒做。1page 靠它抓到三張孤兒表
```

**特別要處理的兩件事**：

- `ai_island_v3` 的後台密路徑 `Ak83QDhUOVqx` 曾經出現在對話裡，要換掉。
  這件事寫進它的 `upgrade.md`，但**換的動作要 Luffy 自己做**。
- `MaoTravelBlog` 沒有 GitHub remote，只有本地的 `gitsafe-backup`。
  其餘七個都有 remote，寫完各自 commit + push。

### 二、`SnowRealm-Platform/docs` 的總體想法

> 「我們是叫 SnowRealm 的品牌，公司名稱叫斯諾瑞姆企業社，
> SnowRealm-Platform 是我們企業社所有產品入口」

要先讀完 `SnowRealm-Platform` 現有的那幾份文件再寫，不然會變成
一份與既有規劃打架的第二套方案。

要寫的東西：

```text
1. SnowRealm 是什麼          一個品牌下的多個產品，還是一個平台上的多個模組？
                             這個答案決定後面每一件事，包含要不要抽 SDK
2. 每個專案的定位與關係       哪些是產品、哪些是內部工具、哪些該收掉
3. 共用入口                  SSO 是第一個，因為它決定「同一個人」怎麼定義。
                             1page 的 profiles 已經預留 snowrealm_id 欄位
                             （目前恆為 null，audit 有具名例外）
4. 該抽成 SDK 的東西          ⚠️ 抽 SDK 的判準是「已經在兩個以上專案裡
                             各寫過一次、而且寫法一樣」。只寫過一次的東西
                             抽出來只會變成一個沒有人敢改的套件
5. 各專案的升級路線與順序     哪些互相依賴、哪些可以並行
```

**已經看得出來的共用候選**（都在兩個以上專案出現過）：

```text
自架 GoTrue 的接法            1page 與 SnowRealmSpace 是同一套
presign 直傳 R2 + 進度        1page / SnowRealmSpace / ai_island 各寫過一次
設計 token 與 no-hardcoded 守衛  1page 的 tokens.css + 三條測試
「反過來問」的接線稽核         目前只有 1page 有，但每個專案都需要
```

⚠️ **SSO 的 cookie 範圍有一個已知的限制**：R2 自訂網域
（`1page-r2.snowrealm.pet`）與站台（`1page.snowrealm.pet`）同註冊網域。
若把 auth cookie 設在 `.snowrealm.pet` 範圍，一個惡意 SVG 被直接開啟時
就讀得到它。目前 Supabase 的 cookie 是 host-only 所以還安全——
**做 SSO 時這件事會第一個撞上來**，不是之後再說。
（見 `src/config/media.ts` 的 `SVG_INTENTIONALLY_EXCLUDED` 說明。）

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
- 🔴 **R2 bucket 要加 CORS 設定。** 沒有它，瀏覽器上傳一律送不出去
  （後台的作品上傳與編輯器的圖片上傳都是）。設定內容見
  `scripts/r2-cors.mjs`——在 Cloudflare 後台照著填，或給一組有
  Admin Read & Write 權限的 R2 token 讓 `node scripts/r2-cors.mjs --apply` 跑。
  目前的 token 讀 bucket CORS 回 AccessDenied。
  `tests/e2e/site-images.spec.ts` 有兩條紅著，設好就會綠。
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
CR-003   1 ✅ 2 ✅ 3 ✅ 4 全五段 ✅ 5 ✅（0818）
         + 草稿載回／項目增刪／圖片上傳 ✅
CR-004   Phase B BA–BJ 全部 ✅。沒有剩下的程式工作
```

### Phase M — 會員系統（Spec V1.3 CR-002）

```text
MA  會員身分基礎（profiles + DB trigger + RLS）        ✅
MB  註冊 / 登入 / 登出 / 忘記密碼 + 速率限制           🔴 卡 SMTP
MC  帳號內聯繫（會員端）                               🔴 卡 SMTP
MD  後台收件匣                                         ✅ BB 做掉了（/admin/inbox）
ME  導覽整合 + 後台/會員頁納入八斷點檢查               ✅ 0815 補完
```

登入、登出、會員中心、導覽入口在 0813 已經做掉了（原本歸在 MB／ME），
MB 真正剩下的是**註冊與忘記密碼**，兩個都要信件。

MD 在 CR-004 的 BB 一併做掉了（後台「收件匣」），
ME 的斷點檢查在 0815 從磁碟列舉之後才算真的做完——
原本那份清單寫死三條路由，之後加的六個後台頁一條都沒被掃過。

MC 卡在同一件事上：`/account/inquiries` 現在只顯示「你留了什麼」，
不顯示我們的回覆。沒有 SMTP 就沒有回覆管道，
而做一個看起來能對話、實際上沒有人會回的介面，比沒有那個介面更糟。

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
