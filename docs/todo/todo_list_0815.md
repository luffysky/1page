# 待辦狀態校正 0815

> 這份是 2026-08-15 收工時**對照實際程式與實測結果**校正過的權威狀態。
> 前一版是 `todo_list_0813.md`（本檔即由它更名而來）。
> Phase 進度以 `docs/gate-log.md` 的 Gate 紀錄為準，那份是逐段的驗收證據。
> 規格以 `docs/1page-v1-spec.md`（**V1.4**，CR-001～003 已併入）為唯一來源。
>
> 劃掉的是 0811 之後已經完成的。

**測試總數：594 unit + 386 e2e + 56 visual + 80 db = 1116。**（0815 收工時是 946）
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

## ✅ 0818 傍晚：首頁重新編排與瘦身（CR-005 + CR-006）

依 `docs/gptsay.md` 對線上站的資訊架構評論。**規格升到 V1.6**，
兩份 CR 記在 §47。

### CR-005 — 順序

```text
Services 由第 8 位提到第 5 位      「我們能做什麼」是工作室官網的核心論證，
                                  卻排在 AI 哲學後面
Template Experience 降到第 6 位    它是首頁體積最大的一塊
Process 與 Pricing 對調            先講多少錢再講怎麼做，順序反了
```

### CR-006 — 體積

```text
/pricing 新路由      完整六級搬過去。首頁只留「免費 / 8,800 起」+ 一個連結
/playground 新路由   完整試穿搬過去（Theme / Accent / 裝置）。
                    首頁只留「挑一套 + 大張預覽 + 兩個出口」
services 改成四列    §3.1 本來就禁止全站卡片網格，這一改是往規格靠
導覽收成一份        六個公開頁各寫一份 NAV_LINKS，而且內容都不一樣
                    （/work 七條、/work/[slug] 五條、/edit 四條）。
                    收進 `config/nav.ts`，並補上這個專案缺的
                    「反過來問」守衛：磁碟上有沒有哪條公開路由沒有入口
```

⚠️ **§26.1 的原意沒有變**。原文的理由是「缺了承接點，升級路徑等同
從 990 直接跳 30,000」——那個顧慮是「階梯有缺口」，不是「階梯在哪一頁」。
所以 `/pricing` 必須完整，而首頁那段**必須把人帶過去**：
藏起來就等於缺了那幾級。有三條 e2e 盯著這件事。

### 四件過程中發現的事

```text
1. 起價寫死會讓兩個地方講不一樣的價錢
   PricingSummary 的每一個數字都從 tiers 算出來，連「完整 N 級」的 N 也是。
   兩個方向都故意改壞驗過會紅。

2. 導覽守衛第一次跑就抓到我自己漏的兩條
   例外清單原本逐一列 /_dev/primitives 與 /_dev/theme，
   而磁碟上還有 /_dev/templates 與 /_dev/tokens。改成前綴例外。

3. TemplatePicker 塞進窄欄會變成一個字一行
   它自己是 lg:grid-cols-4 的橫排，放進 22rem 的左欄後每張卡剩約 5rem。
   程式全綠、build 過、測試過——只有截圖看得出來。

4. ⚠️ 又一個我自己寫的假守衛（CR-005 那時）
   homepage.spec.ts 的「IA 順序與 Spec §4 一致」把預期順序從 HOME_BLOCKS
   算出來，而頁面也從 HOME_BLOCKS 渲染——兩邊一起動，永遠不會紅。
   拆成兩條：e2e 驗「首頁照著 HOME_BLOCKS 渲染」，
   新的單元測試驗「HOME_BLOCKS 與 Spec §4 一致」（兩個方向都驗過會紅）。
```

### 兩個分析事件現在帶 `from`

`pricing_viewed` 與 `template_viewed` 在首頁與新頁面都會發，
一個人從首頁點過去就會被算兩次。不另外開事件
（`ANALYTICS_EVENTS` 是「Spec §31 列出的，一個不多一個不少」，
加事件要動規格），改成帶 `{ from: "home" | "pricing-page" | "playground" }`。

⚠️ 順手修掉一個我自己弄出來的：「換個感覺」那個連結原本發
`template_to_agent_clicked`，而它去的是 `/playground` 不是 AI 顧問——
那會讓「去找顧問」的數字混進「去試穿頁」，而報表看起來完全正常。
拿掉了；那一頁進站時本來就會發 `template_viewed { from: "playground" }`。

### ⚠️ e2e 之間會透過 CMS 快取互相汙染

`admin-cms` 的收尾用 SQL 刪資料，而 CMS 讀取端有快取、快取只在 action
存檔時失效——所以它寫進去的測試值會留在快取裡最多一小時，
把後面每一支測試都汙染掉。

實際發生過：`homepage` 的「首頁呈現入口價」紅了，它在找「免費」，
而快取裡是 `admin-cms` 寫的「NT$ 111」。**症狀出現在一支無辜的測試上。**

已修（那一條測試改成走存檔路徑把值改回去）。但**同樣的形狀還在**：
`home.hero`、`home.process`、`login.intro` 幾份也是「改了 → SQL 刪」。
目前沒有造成問題，因為沒有別的測試在驗那幾段的內容。

真正的解法是一條「從外部讓內容立刻生效」的路徑（帶密鑰的 revalidate 端點），
那條同時也解掉「直接改資料庫前台不跟著變」那一項。

### `docs/gptsay.md` 還沒處理的兩項——都不是程式工作

```text
「太多東西在解釋自己」   philosophy / advisor / workshop 那幾段的文案。
                        全部是 CMS 可編輯的，屬於文字取捨，要 Luffy 定調
「作品轟炸」            現在只有三件，其中兩件是一頁起家自己的。
                        要更多作品進資料庫，誠實標 CONCEPT / DEMO /
                        INTERNAL。後台已經填得進去（分類與標籤也能編）
```

## ✅ 0818 深夜：編號算出來 + CRM Dashboard

### ~~CR-007 — CRM 可以從 Excel／CSV 匯入~~ ✅

兩條路：`/crm` 的設計器**從檔案建一類**（猜型別、逐欄可改），
`/account/crm/[id]` 的記錄頁**批次匯入資料**（對應欄位、逐列驗證）。
Spec 升到 V1.7，CR 記在 §47。

```text
不加依賴          .xlsx 用瀏覽器原生的 DecompressionStream 讀（ZIP + 兩份 XML），
                  CSV 自己寫 RFC 4180。最常見的那個 xlsx 套件在 npm 上
                  已標為 deprecated 且有過 CVE
檔案不上傳        在瀏覽器裡讀完，只送對應好的那幾列值。
                  少一條上傳路徑就少一整類問題
伺服器一定重驗    用與手動新增**同一份** recordSchemaFor 逐筆再驗一次。
                  瀏覽器那一次是為了先告訴人，不是為了省驗證
一次一個交易      整批 insert。分次的話第 180 筆撞上限會留下前面 179 筆，
                  而使用者不會知道要去刪
```

**三件不能安靜出錯的事**（每一件都有一條測試，也都故意改壞驗過會紅）：

```text
電話不能變數字    0912345678 存成 number 會掉開頭的 0，而 912345678
                  看起來完全正常。有前導零或超過 9 位的一律當文字
斜線日期要轉 ISO  2026/8/18 過不了 YYYY-MM-DD。不轉的話畫面說是日期、
                  每一列卻都匯入失敗——使用者什麼都沒做錯
壞掉的列要指名    匯入其餘的，逐列說出第幾列哪一欄不對，而且要在
                  **按下送出之前**就看得到。列號與 Excel 裡看到的一致
```

**自己抓到的五個假綠燈**（都是先寫測試、再故意改壞才發現的）：

```text
BOM 那條驗錯層次   驗的是 toSheet，而 U+FEFF 在 JS 裡算空白字元，
                   `.trim()` 本來就吃掉它。BOM 處理整段拿掉照樣全綠。
                   改釘 parseDelimited
「要有重複」是死的  select 的 distinct < filled 永遠成立（比例已經含蘊它）。
                   拿掉它測試不會紅——它從來沒擋過任何東西
兩條路徑沒被走到    xlsx 的 26 進位欄名（AA 之後）與 rich text
                   （一格裡有粗體會被切成好幾個 <t>），fixture 產不出來，
                   所以改壞了也不紅。補進 fixture 才驗得到
strip 幫忙擋掉了    「不匯入的欄位」用了一個定義裡根本沒有的欄位當例子，
                   recordSchemaFor 的 .strip() 順手清掉了
「不太確定」到處都是  六欄裡三欄掛著提醒＝沒有提醒。改成只標
                   **猜錯會有代價**的（0/1 猜成勾選、樣本太少的下拉）
```

**e2e 抓到一個單元測試抓不到的**：換一個類別的時候，已經讀進來的
對應表原封不動留著——而兩類都是匯入建的話欄位 id 都是 `col-1`、`col-2`，
於是電話會填進金額欄，畫面上完全看不出來。
現在讀進來的表**綁著它是為哪一類讀的**，換類別就當作沒選過檔案。

### ~~首頁區塊的編號由版面位置算出來~~ ✅

`SECTION_COPY` 的 kicker 只留名字，編號由 `blockNumbers(blocks)` 依
**實際渲染順序**算出來。`numberedKicker` 會先把既有的 `NN / ` 拔掉——
kicker 是 CMS 可編輯的欄位，有人照著舊樣子打了編號也不會變成兩層。

```text
關掉一塊，後面的編號遞補上來    不然畫面上會出現 01、02、04
首屏／作品／最後那一段不編號    前後兩塊是開頭與結尾，不是「其中一段」；
                              作品那段的 kicker 是證據，不是流程的一步
```

三個方向都故意改壞驗過會紅：不遞補、不拔既有號碼、改用固定位置而非渲染順序。

### ~~CRM Dashboard~~ ✅

`/account/crm/[id]` 上方新增概況；`/account/crm` 的清單顯示筆數。

⚠️ **統計全部從使用者自己的定義算出來**，與記錄表單同一招。
寫死「客戶數與成交率」的話，一個拿它記食材庫存的人會看到兩個永遠是 0 的數字。

```text
select      各選項各幾筆，**含 0 筆的選項**——「沒有人選過這個」
            往往正是最有用的資訊，藏起來等於沒說
checkbox    是 / 否。不算填寫率：沒勾也是一個答案
number      總計與平均。一筆都沒填時不給平均，而不是給 0
date        最早與最晚
text        只有填寫率。硬要分組會得到一堆各 1 筆的「分類」
```

三件在做的時候抓到的事：

```text
1. 分母是 0 時 CSS 會拿到 NaN%，瀏覽器忽略整條寬度宣告
   → 每一條都變成滿版，看起來像「全部都是 100%」
2. 沒有資料時不畫一整排 0——那看起來像壞掉，而它只是還沒開始
3. ⚠️ 日期欄位被說成「文字欄位不做分組」
   條件式寫成「沒有分布、沒有數字、沒有範圍」，而一個還沒有人填的
   日期欄位也滿足它。不是壞掉，是說錯話——而說錯話的圖表比沒有更糟
```

11 條單元測試（純函式）＋ 2 條 e2e（數字真的接上畫面）。
兩層都故意改壞驗過。

---

## 🐛 0818 現場修復：管理員帳號存不了任何東西

**症狀**：按「存到我的帳號」→「存檔失敗。」，而且確實已登入。

**原因**：`crm_definitions.owner_id` 外鍵指向 `profiles`，
而那個帳號建立於 `2026-08-10`——比 `profiles` 與
`on_auth_user_created` trigger（`20260811000005`）早一天。

trigger 是 `after insert`，對**已經在** `auth.users` 裡的列不會觸發。
所以那份 migration **上線的當下就已經有一個孤兒帳號**。

⚠️ **九張表外鍵指向 profiles**，所以那個帳號存不了任何東西：

```text
crm_definitions.owner_id / crm_records.owner_id   CRM 設計與記錄
saved_sites.owner_id                              網站草稿
cms_documents.updated_by / cms_revisions.saved_by 後台編任何內容
notes.author_id / activities.actor_id
time_entries.actor_id / leads.profile_id
```

### 為什麼一週都沒發現

```text
e2e 全綠              每一支測試都自己建新帳號，trigger 會補 profile。
                      測試涵蓋的永遠是「新使用者」，而唯一的舊使用者沒有人測
應用層吞掉錯誤         資料庫回的是
                      `violates foreign key constraint … is not present in
                      table "profiles"`——講得一清二楚。
                      而應用層回的是四個字「存檔失敗。」，
                      伺服器紀錄裡什麼都沒有
```

### 修了三件

```text
1. 回填  20260818000016_profiles_backfill.sql
         欄位邏輯與 handle_new_user() 一字不差——分岔的話，
         回填出來的名字會與註冊產生的不一樣
2. 守衛  tests/db/profiles.test.ts「沒有孤兒帳號」
         反過來問：有沒有哪個 auth.users 沒有 profile。
         ⚠️ 這件事只有在真資料庫問得出來——單元測試沒有 auth.users，
         e2e 只涵蓋新帳號
3. 診斷  src/lib/supabase/save-error.ts
         原始錯誤一定記進伺服器紀錄，給使用者的那句不含
         資料表名／欄位名／約束名。已接上 CRM 與網站草稿兩條存檔路徑
```

---

## ✅ 0818 深夜（二）：CRM Dashboard 的介面優化

Luffy 看完實際畫面後交辦。**卡片網格保留**，橫列變成第二種選擇。

```text
① 資料太少不畫圖表   門檻 3 筆
② 表格整行寬          表單收進原生 <details>，而且移到表格**下面**
③ 兩種排版            `?layout=cards|rows`，存在網址裡
④ 頂部三個數字        總共 / 最近七天 / 最多的 X
⑤ 深色數字帶          沿用既有 token，不引進新顏色
```

**表格捲動**（Luffy 特別交代）：外框不動 + 第一欄 `sticky left-0` 釘住。

### 抓到四個東西，三個是我自己弄出來的

```text
1. 存完第一筆表單自己收起來，「記下來了」跟著消失
2. <summary> 的可及名稱把兩個標籤串成一句
3. ⚠️ 「外框不動」那條是套套邏輯——選擇器跟著捲軸搬家
4. 判準用錯：documentElement.scrollWidth 在有捲動容器的頁面會被灌水，
   而 window 其實推不動
```

---

## ✅ 0818 收尾稽核：API / DB / UI / RWD / PWA 全面清查

Luffy 交辦「準備收尾，檢查所有 API DB UI RWD PWA 該接的該建的
是不是都有接好建好」。清查方式是**逐項去問，不是憑印象**——
而且每一個新加的守衛都故意改壞驗過會紅。

### 抓到六件事，其中兩件是真的壞的

```text
① adminListUrl              🔴 一個從 2E 就存在的 Server Action：
                            **沒有呼叫點、沒有驗身分**，而它回傳的是
                            後台的密路徑。Server Action 是公開端點，
                            「沒人叫」不代表「叫不到」。已刪除
② 記錄頁整頁會橫向捲 39px    🔴 表格的溢出寬度會傳到 documentElement
                            （html.scrollWidth 429、body 390）。
                            改成 overflow-x: hidden 也擋不住，
                            只有 contain: paint 擋得住。已修
③ sitemap 少了四條          /pricing、/playground、/crm、/edit
                            全都不在 sitemap 裡——CR-006 把首頁最大的
                            兩塊搬出去，Google 卻找不到那兩頁
④ 沒有 apple-touch-icon     layout 宣告了 appleWebApp.capable，
                            而 iOS **不讀 manifest 的 icons**。
                            使用者「加到主畫面」拿到的是一張網頁截圖
⑤ 20 張表的 RLS 沒被驗過     27 張表開了 RLS，db 測試只碰過 7 張
⑥ 六條公開路由沒有斷點檢查   八斷點的橫向溢出只涵蓋 /、/work、
                            /work/[slug] 與後台。/pricing、/playground、
                            /crm、/edit、/start、/login 一個都沒驗過
```

### ⚠️ 兩個假綠燈，其中一個是我自己剛寫的

```text
scroll-behavior: smooth   `window.scrollTo(9999, 0)` 之後立刻讀 scrollX
把捲動檢查全部變成假的    永遠是 0——因為捲動是動畫的，還沒捲完。
                          故意在 /pricing 塞一個 1600px 寬的東西，
                          八個斷點全綠。改成 behavior: "instant"
                          之後紅了七個（1920px 那個本來就不該紅）。
                          CRM 記錄頁那條「整頁不得橫向捲」也是這樣寫的，
                          於是它從來沒有擋過任何東西——而它要擋的那件事
                          **當時就已經在發生了**（那 39px）

429 這個數字是真的         之前把 documentElement.scrollWidth = 429
                          當成「捲動容器灌水」而略過。灌水是真的，
                          但那一頁**同時**真的溢出 39px。
                          兩個原因湊在一起，剛好互相掩護
```

### 新增五個守衛，問法一律是反過來的

```text
server-action-wiring       每個 action 都有呼叫點、都驗身分。
（unit）                   例外要具名並寫明「為什麼公開呼叫是安全的」。
                           順手抓到 addCrmRecordAction 與
                           importCrmRecordsAction 只在下一層驗身分——
                           而那個檔案開頭就寫著「身分要在這裡驗」

rls-coverage               去 pg_tables 問有哪些表開了 RLS，逐一敲。
（db）                     ⚠️ 兩層：匿名讀不讀得到（會被空表騙過），
                           以及**政策本身有沒有無條件的 true**（不看資料）。
                           後者是真的守衛——實測在 invoices 上加一條
                           `using (true)` 會紅

sitemap-coverage           公開路由清單裡有沒有哪一條不在 sitemap，
（unit）                   以及 sitemap 有沒有收錄 _dev／後台

public-breakpoints         九條公開路由 × 八斷點 = 72 條，
（e2e）                    判準是「推得動嗎」而不是那個減法

pwa                        manifest 的每一個圖示都真的拿得到、
（e2e）                    maskable 在、apple-touch-icon 在、
                           theme-color 與 manifest 一致
```

### 順手做的兩件整理

```text
公開路由清單合併成一份     a11y 掃描有清單也有守衛，八斷點截圖另有一份
                          **沒有守衛的**清單——於是 CR-006 的兩條新路由
                          進了前者沒進後者，人工視覺 review 從來沒看過。
                          現在兩邊讀 tests/support/public-routes.ts

後台的溢出判準也換掉       authed-breakpoints 原本用那個減法。
                          換成同一個「推得動嗎」之後 58 條仍然全過
```

### 沒有問題的部分（也記下來，免得下次重問）

```text
migration        16 個檔案，16 個都套用了
資料庫欄位        166 個，沒有任何一個是程式碼裡從沒出現過的
API 端點          只有 /api/agent，audit:wiring【9】驗過有呼叫點
Server Action     42 個，扣掉刪掉的那個之後全部有呼叫點且驗身分
Service Worker    刻意沒有。作品集與銷售頁不需要離線，
                  為會變動的行銷網站做離線快取只會讓訪客看到過期內容
```

---

## 🔴 真正還沒做（純程式、沒被外部卡）

### ⚖️ 要 Luffy 裁決：匯入的資料要不要跨頁留著

現在 `/crm` 設計器的匯入**只建結構**，資料要等這份設計存起來、
有了 id 之後，到記錄頁用**同一個檔案再選一次**。

```text
現在這樣的代價    同一個檔案要選兩次
做成一次的代價    設計器與記錄頁之間要保住那份已解析的資料。
                  存 sessionStorage 的話：一份 500 列的 CSV 解析完
                  是幾百 KB 的 JSON，而 sessionStorage 的上限大約 5MB，
                  且它要活過「存檔 → 導頁 → 新的 id」這一整段。
                  中間任何一步失敗，畫面上會是「資料好像匯進去了」
                  而其實沒有——那比多選一次檔案糟
```

**沒有自己決定，因為兩邊都說得通。** 要做的話再說一聲。

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

## ✅ 0818 做掉的：跨專案 upgrade.md 與 SnowRealm-Platform

八份 `docs/upgrade.md` 全部寫完並各自 commit + push；
`D:\SnowRealmRebirth\SnowRealm-Platform` 建起來了（本地 git，**remote 待 Luffy 開**）。

```text
GLACERA                零測試，而金流與庫存的 RPC 就壓在上面
                       （付款回調本身寫得好：驗簽、for update、冪等、金額比對）
ai_island_v3           224 個 SQL 沒編號沒 ledger，資料庫重建不出來
md2deck                「檔案不上傳」這句話目前由 cdnjs 決定成不成立
                       （6 支 CDN 腳本、0 個 SRI、CSP 被註解掉、DOMPurify 也是 CDN 來的）
insight-engine         58 張表零 RLS，而 anon key 是 NEXT_PUBLIC_，
                       且那把 anon client 整個 src 裡零呼叫點
MaoTravelBlog          RLS「權威檔」涵蓋 185 張表中的 5 張，套用腳本已被刪。
                       ⚠️ 沒有 GitHub remote，只能提交在本地
SnowRealmSpace         全專案 0 行 CSP（其餘工程基礎是八個裡最好的）
SnowRealmYukiBoard     遠端鍵盤全程明文——而他們自己記過，然後那筆記被埋在 179 份文件裡
tammon_crawler_project 機密都有開發用預設值，忘了設不會有任何症狀
```

**平台那邊最重要的一個發現**：既有的六份規劃（2026-07 實地調查版）
列的是**七個**產品，而 `GLACERA` 與 `1page` 在六份裡各出現 **0 次**。
影響不只是補兩列——Z 幣「4 套合一」漏算了 GLACERA 的訂單金流、
AI Router「5 套」漏算了 1page 的第 6 套。

以及 SSO 的 R2 網域／cookie 範圍限制，既有規劃還沒寫到，
而它會在動工時第一個撞上來。

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
