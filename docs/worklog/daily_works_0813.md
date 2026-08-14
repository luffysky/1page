# 2026-08-13 工作紀錄

> 這一天做的事、以及每一件事**是怎麼被驗證的**。
> 權威待辦狀態見 `todo_list_0813.md`；規格見 `docs/1page-v1-spec.md`（V1.4）。

**測試：386 unit + 252 e2e + 56 db = 694**（前一天 349 → 688 → 694）
**稽核：security 0 失敗 0 警告 ／ wiring 0 失敗 1 警告**

---

## 一、CR-003 全部做完

### CR-003-1 模板內的 AI 客服體驗

訪客能真的跟「被預覽的那間店」講話。實測三種問法：

```text
問網站上有寫的（營業時間、座位數）  → 照著模板內容回答
問網站上沒寫的（有沒有停車位）      → 說沒寫、幫你留言給店家，沒有編
問一頁起家的價格                    → 說只負責這間店的事
```

Spec §47 的兩個硬性要求不是靠提示詞叮嚀，是**結構上給不了**：
零工具（`tools` 直接送空陣列）、額度另計一份。兩條都刻意改壞驗證過會紅。

### CR-003-2 擴充區塊

新增 7 種：faq / process / stats / team / testimonials / pricing / form。
其中 **pricing、testimonials、faq 本來就在型別清單裡但沒有元件**——
訪客選到會看到「這個區塊還在準備中」。

form 做成「表單的照片」：不是 `<form>`、欄位不可聚焦、另有 sr-only 說明。
原本用 `readOnly` input，畫面對但鍵盤不對——`readOnly` 仍然吃 Tab，
使用者會停在三個打不了字的框上再找不到送出鈕，而 axe 不報這件事。

### CR-003-3 白名單嵌入

收**提供者 + 識別碼**，網址由我們組。YouTube 只收 11 個 base64url 字元，
地圖整串 `encodeURIComponent`。沒列在白名單的一律拒絕。

採 facade：**按下去之前不連任何第三方**。實測按前 0 個請求、按後只有
`www.google.com`。刻意拿掉 facade 驗證過會紅。

### CR-003-4 Widget 編輯器（五段）

新路由 `/edit`，導覽列「自己排版」。定價 **B**：免費編輯、存檔才要帳號。

```text
第一段  widget 外框、選取、鍵盤排序
第二段  拖曳、新增區塊
第三段  內容編輯、變體切換
第四段  復原 / 重做
第五段  存檔（saved_sites 表）、匯出 JSON、窄螢幕版面
```

**順序刻意反過來**：先鍵盤、後拖曳。WCAG 2.1 §2.5.7 要求拖曳一定要有
替代方式，而補做等於整個介面重寫。三種輸入（滑鼠拖曳 / 鍵盤 Tab+Enter /
觸控點按鈕）最後都呼叫**同一個 `moveSection`**，所以它們在結構上
不可能有不同的行為。觸控刻意不做拖曳——手機上拖曳與捲動會打架。

---

## 二、現場修掉的問題

### 登入進不去（你回報的）

不是密碼錯。`scripts/admin-create.mjs` 在使用者已存在時只印一行
「使用者已存在」就跳過，**從來不套用密碼**——但畫面上一路印著
「已授予權限」「下一步：以此帳號登入」，看起來完全成功。

證據兩個，都很硬：

```text
encrypted_password.updated_at == created_at   密碼從建立起沒被動過
last_sign_in_at == null                       這個帳號從沒登入成功過
```

修好腳本並重跑後，用 `.env.local` 的 `ADMIN_PASSWORD` 直接打 GoTrue → 200。
（沒有把你的密碼打進瀏覽器表單，驗證是對 auth 端點做的。）

順帶修掉讓它難查的那一半：登入表單原本**所有**失敗都寫「帳號或密碼不正確」，
包括連不上、被擋、限流、信箱未驗證。防帳號列舉要的是不分辨
「這個 email 存不存在」，不是不分辨「這是不是憑證問題」。

### 首頁沒有登入按鈕（你回報的）

登入頁、`profiles`、RLS、trigger 全做好了，**選單上沒有任何地方連得到**。
整個 Phase M 蓋好了房子沒有門。

現在首頁右上角有「登入」，登入後變「會員中心」。`/account` 有 Email、
顯示名稱、存下來的網站、登出。**兩個後台結構上分開**：

```text
/account          我的帳號    路徑公開，任何登入者
ADMIN_SEGMENT     網站管理    路徑保密，非員工 404
```

有測試盯著後者不會在未登入的 HTML 裡洩漏。

### 專案完全沒有 CSP

Security 稽核 21 項全綠，而整個專案**一行 CSP 都沒有**——沒有任何一項在問。

現在有 `frame-src`（只准那兩個嵌入來源）、`object-src 'none'`、`base-uri`、
`frame-ancestors`、`form-action`，加四個標準安全標頭。實測五條路由 +
嵌入載入後 0 violation。

**刻意不用 nonce**：Next 的 nonce 要求每頁動態渲染，靜態產生與 CDN 快取全失效。
更關鍵的是 `style-src` 不能用 nonce（nonce 對 `style=""` 屬性無效），
而 `SiteScope` 正是用 inline style 注入 `--site-*`——改了**所有主題會直接失效**。

### `_migrations` 匿名讀得到（今天的檢查抓到的）

實測匿名帶 anon key 打 `/rest/v1/_migrations` 回 200，內容是每一個 migration
的檔名：`admin_roles`、`leads`、`saved_sites`…等於把整個資料庫的演進史、
有哪些表、做了什麼功能一次交出去。

原因：PostgREST 把 public schema 的**每一張表**都變成端點，
而這張表是遷移工具自己建的，從來沒有人想過要不要開 RLS。
已開 RLS 且不加 policy，實測改完回空陣列。

---

## 三、今天抓到的「名不副實的綠燈」

這一項單獨列出來，因為它比任何一個功能都重要。

```text
audit:security 的「限流在請求驗證之前生效」
  比對的是 checkRateLimit(...) 這串字而不是位置。限流搬到驗證後面
  照樣綠；只是多加一個參數卻會紅。兩個方向都錯。

section-ops 與 site-renderer 各一條測試
  拿 "pricing" 當「還沒實作的 type」的例子。pricing 實作之後
  一條紅、一條照樣綠但驗的已不是名字說的事。
  測試釘住了「哪一個還沒做」這種一定會過期的事實。

編輯器的鍵盤測試用 await button.focus()
  程式直接指定焦點，連 tabIndex={-1} 都能成功。
  它從來沒在驗「鍵盤到得了」，只在驗「按了會動」。
  改成真的按 Tab 走過去，同樣的破壞就紅了。

a11y 全站掃描漏了 /edit
  而【8】路由可達性是綠的，因為 /edit 確實有入口。
  掃描漏掉一條路由跟那條路由壞掉一樣嚴重，只是更安靜。
```

四條都已修正，而且**每一條都刻意把程式改壞一次確認會紅**。

新增的守衛一律反過來問「有沒有漏」而不是逐一列舉：

```text
registry.test.ts          enum 裡有沒有哪個 type 沒元件
section-presets.test.ts   有沒有哪個可新增的型別加出來是空白
audit:wiring【6.5】       有沒有哪張表沒開 RLS
a11y-all-routes           有沒有哪條公開路由沒被掃到
```

---

## 四、全面檢查結果（API / DB / UI / RWD）

### 資料庫

```text
11 張表，全部啟用 RLS，共 31 條 policy
saved_sites  新建，4 條 policy，實測匿名讀取回空陣列
             每人 20 份上限用 DB trigger 擋（應用層擋不住直接打 PostgREST）
             外鍵指向 profiles 而非 auth.users（換 SSO issuer 時不必遷移業務資料）
_migrations  今天補上 RLS
型別         pnpm db:types 已同步（建表當下漏跑，被 audit:wiring【1】指名抓到）
```

### API

```text
/api/agent   唯一的端點；有程式碼呼叫（【9】）
             壞請求回 400 而不是 500，且 Cache-Control: no-store
             限流在 schema 驗證**之前**（實測調換順序會紅）
```

### UI 路由

```text
/  /work  /work/[slug]  /login  /start  /edit  /account
/robots.txt  /sitemap.xml            全部 HTTP 200
每條路由都有畫面上的入口（例外須寫理由）
```

### RWD

**8 斷點 × 6 路由，橫向溢出全部為 0。**
（375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920）

編輯器窄螢幕改成上下堆疊：預覽在上、正在改的欄位在下。

### a11y

全站掃描 0 critical / serious，含編輯器選取狀態與嵌入載入後。

---

## 五、還沒做 / 卡住的

### 🔴 最高優先：SMTP（你的操作，順序不能反）

```text
1. 先設好 SMTP
2. 再把 GOTRUE_DISABLE_SIGNUP 改成 false
3. 確認 GOTRUE_MAILER_AUTOCONFIRM 不是 true
```

今天實測 GoTrue 仍回 `signup_disabled` 422。**它現在卡著三件事**：

```text
註冊              一般人根本註冊不了，只有你手動建的帳號能用
會員自助改 Email  需要驗證信
Phase M 的 MB     註冊 / 忘記密碼
```

會員中心與編輯器都刻意**沒有**放註冊按鈕——做一顆按了會 422 的按鈕比沒有更糟。

### ⚠️ 一個要你決定的：存檔的門檻目前是「登入」，不是「付費」

定價 B 是「免費編輯、存檔才付費」，但這個專案**還沒有任何金流**。
所以現在的實作是：編輯免費、匯出 JSON 免費、**存到帳號要登入**。

真的要收費時，擋的位置是 `saveCurrentSite` 這個 server action，
不是畫面上的按鈕（按鈕擋不住直接打端點的人）。要接金流再說一聲。

匯出 JSON 刻意免費也不需登入：那是訪客自己做的東西，扣住當人質
不會讓人更想付錢。

### 其他還沒做的

```text
編輯器      新增/刪除單一項目（現在只能改既有項目的文字）
            圖片上傳（gallery 目前是色塊佔位）
分類清單    portfolio_categories 表有 11 筆，/work 的篩選讀的是硬編清單
Case Study  後台編輯表單只有基本欄位，case_study_json 只能改資料庫
Tag/Service 篩選（Spec §8.7 列了，只做了 Category + Project Type）
Phase M     MC 帳號內聯繫、MD 後台收件匣、ME 已登入 session 的可達性檢查
```

### 需要你操作的其他項目

```text
ai_island_v3 密路徑 Ak83QDhUOVqx 必須更換（曾出現在公開 robots.txt）
NEXT_PUBLIC_ANALYTICS_ENDPOINT 尚未設定（19 個事件目前靜靜不送）
FAQ 四個空缺：工期、修改次數、付款方式、維護
部署後跑 pnpm audit:perf --url <線上網址>（目前數字都來自 localhost）
```

---

## 六、今天的 commit

```text
09fc2f7  feat(CR-003-1)  模板內的 AI 客服體驗
0c16c0d  feat(CR-003-2)  擴充區塊
ba73c5d  feat(CR-003-3)  白名單嵌入 youtube / map
1833469  docs            補回被 shell 吃掉的反引號
b6765f7  fix             登入永遠說密碼錯誤 + 補上 CSP
bc8bb9a  feat(M)         首頁補上登入入口 + 會員中心
2a6c45a  feat(CR-003-4)  第一段 widget 外框、選取、鍵盤排序
f8cf931  feat(CR-003-4)  第二段 拖曳、新增區塊
97c86ec  docs            待辦狀態校正 0813
b5ea9b9  feat(CR-003-4)  三～五段 內容編輯、變體、復原、存檔匯出
9f73935  fix             _migrations 匿名讀得到 + RLS/a11y 覆蓋率稽核
```
