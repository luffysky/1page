# CR-004 草案 — 兩個 Dashboard、CRM、ERP

**狀態：** 草案，等 Luffy 裁決後才寫進 Spec 並升版 V1.4 → V1.5。

**來源：** Luffy 2026-08-14：
「個人後台跟網站管理後台做成 dashboard 網站管理後台加上 CRM ERP系統
可參考 ai_island_v3 / insight-engine / SnowRealmSpace」

**範圍裁決（已確認）：** 四個模組全做——
CRM 客戶與聯絡記錄、CRM 報價與成交流程、ERP 專案與工時、ERP 帳務。

**追加（同日）：**
- 管理後台加 CMS
- 前台加一個「訪客自己設計 CRM」的模組，一樣用 widget 排版

---

## 一、這份 CR 要動到的封版條文

```text
§40  ❌ 完整 CMS 平台            已在 CR-003 部分解禁；這次再擴一次（後台側）
§40  ❌ 內部營運系統             原本不在範圍內 → 解禁
§47  CR-002 的兩個後台結構        維持分開，但兩邊的**外殼**改成共用
§8   後台頁面清單                 大幅擴充
§34  RWD 八斷點                   後台側的斷點檢查要涵蓋新頁面
```

**不動的：** RLS 的既有 20+ 條 policy、`admin_users` 與 `profiles` 的兩層權限結構、
密路徑機制、Spec §36 的 SiteConfig 安全邊界。

---

## 二、先講三件會決定整個結構的事

### 1. 兩個後台共用外殼，但**不共用授權**

```text
/account            會員的。路徑公開，任何登入者都進得來
ADMIN_SEGMENT/admin 員工的。路徑保密，非員工 404
```

CR-002 明確決定這兩個要分開，這次不改。改的只有**長相**：
兩邊都變成「左側分組導覽 + 內容區」的 dashboard，共用一個 `DashboardShell`。

⚠️ **共用外殼很容易變成共用權限判斷，而那正是 CR-002 拒絕的東西。**
所以 `DashboardShell` 只收「導覽資料 + 內容」，它自己**不做任何權限判斷**——
判斷留在各自的 `layout.tsx`（`requireMember()` / `requireAdmin()`）。
外殼不知道使用者是誰，就不可能把兩邊的權限搞混。

參考專案在這裡踩過：ai_island_v3 的 CLAUDE.md 特地寫了一段警告，
說 `/admin` 的角色與 Creator-Island 工作區的角色**沒有關係**，
因為兩套用了同樣的字。SnowRealmSpace 又重複了一次（`site_role` vs `space_members.role`）。
所以這次從第一天就用不同的字：員工是 `admin_users.role`，會員沒有角色。

### 2. 導覽是一份資料，不是散在各頁的連結

```ts
// src/features/dashboard/nav.ts
export const MEMBER_NAV: NavGroup[] = [...]
export const ADMIN_NAV: NavGroup[] = [...]
```

ai_island_v3 的 `nav-items.ts` 是三個參考專案裡最值得抄的一件事：
側邊欄與 Cmd-K 命令列讀同一份，加一頁只改一個地方。

⚠️ 更重要的是它讓 **`audit:wiring`【8】的路由可達性檢查真的有意義**：
後台頁面數量會從 4 個長到 30+ 個，靠人記得加連結一定會漏，
而漏掉的表現是「功能做完了，但畫面上進不去」——這個專案已經犯了六次。

導覽資料要有一條測試：**每一個 `src/app/admin/**` 底下的頁面，
不是出現在 `ADMIN_NAV` 裡，就是列在具名的例外清單裡並寫下理由。**
反過來問，不逐一列舉。

### 3. 現在**不加**新的角色

參考專案都有 `owner|admin|support|marketing|finance|content` 之類的分工。
1page 目前的員工只有 Luffy 一個人。

加一個沒有第二個人會用到的角色欄位，就是「宣告了一個東西卻沒有任何地方用到它」
的第八次。`admin_users.role` 維持 `owner|admin` 不動。

**但路徑→區段的對應表現在就做**（`sectionForPath()`），因為那是導覽資料的一部分。
之後真的要分工時，只要在那張表上加權限判斷，不必動任何頁面。

---

## 三、資料模型

### 命名：從第一天就不要用同一個字指兩件事

```text
portfolio_projects   對外的作品集（已存在，公開可讀）
engagements          對內的接案專案（新，只有員工讀得到）
```

參考專案兩次踩到「同一個字兩個意思」。叫 `projects` 的話，
半年後沒有人分得出 `projects` 與 `portfolio_projects` 誰是誰。

### CRM

```text
clients              客戶（公司或個人）
client_contacts      聯絡人（一個客戶可以有多個）
deals                報價與成交流程（pipeline）
deal_items           報價明細
notes                備註（可掛在 client / contact / deal / engagement 上）
activities           時間軸（誰在什麼時候對哪一筆做了什麼）
```

**`leads` 不動。** 它是訪客留下的原始記錄——那是**證據**，不該被後續編輯覆蓋。
新增 `leads.client_id`（可為 null）表示「這筆詢問已經轉成某個客戶」。

```text
leads（訪客說了什麼，不可變）
  └─ client_id ─→ clients（我們對這個客戶的理解，會一直改）
                    └─ deals ─→ engagements ─→ invoices
```

⚠️ 這條線是整個 CRM 的骨架，也是最容易做錯的地方：
把 lead 直接當成客戶來編輯的話，「他當初說的」與「我們後來改的」就分不開了，
而談價格談到一半時那件事會很重要。

### ERP

```text
engagements          接案專案（狀態、期間、對應的 client 與 deal）
milestones           里程碑（可對應付款節點）
time_entries         工時
invoices             請款單
invoice_lines        請款明細
payments             收款記錄
```

⚠️ **這個專案沒有任何金流串接，這次也不做。**
`invoices` 與 `payments` 是**記帳**，不是收錢：Luffy 自己開發票、自己對帳，
系統只是把「誰欠多少、收了沒」記下來。

做成看起來會自動收錢的樣子，比沒有更糟——那是 SMTP 那件事的同一個教訓
（做一顆按了會 422 的註冊按鈕比沒有那顆按鈕更糟）。

### RLS

全部新表一律：

```sql
alter table <t> enable row level security;
-- 只給員工，不給 anon 與 authenticated
create policy "<t>_staff_all" on <t> for all using (is_staff()) with check (is_staff());
```

例外只有兩個，而且要寫理由：
- `engagements` 與 `invoices` 之後可能要讓客戶看到自己的那幾筆（Phase B 之後再說）
- `notes` 有一個 `internal` 旗標，內部備註永遠不給客戶看

參考 SnowRealmSpace 的 `0003_rls_helpers.sql`：
`security definer` + `set search_path` 的 helper 函式，
避免 policy 遞迴查自己那張表。1page 已經有 `is_staff()` 的等價物，沿用。

---

---

## 三之二、CMS（管理後台）

### 它要解決的是一個現在就在痛的問題

網站上的文案現在寫死在程式碼裡：

```text
src/config/faq.ts              常見問題（待辦上「四個空缺」要改程式才補得上）
src/config/home-goals.ts       首頁的目標選項
src/config/pricing.ts          六級價格（同時也餵給 Agent 的系統提示）
各 page.tsx 裡的標題與說明文字
```

也就是說**改一句文案要走一次 commit 與部署**。這不是「以後會方便一點」，
是現在每次改字都在付的成本。

### 資料模型

```text
cms_documents        一份可編輯的內容（key、標題、狀態、發佈時間）
cms_blocks           內容的區塊（沿用 SiteSection 的形狀）
cms_revisions        每次發佈留一版（改壞了要回得去）
```

⚠️ **不做「任意頁面產生器」。** CMS 管的是**既有頁面上的既有欄位**，
不是讓人憑空長出一條新路由——那條路會直接撞上 §40 的「完整 CMS 平台」，
而且新路由沒有對應的元件就只是一個 404。

`key` 是程式碼裡指定的（`home.hero`、`faq.list`、`pricing.tiers`），
所以**每一個 key 都保證有讀取端**。守衛照舊反過來問：
「`cms_documents` 裡有沒有哪個 key 沒有任何程式在讀」，以及
「程式裡讀的 key 有沒有哪一個資料庫裡沒有」。

### 讀取端的兩難：快取

文案進了資料庫，首頁就從靜態變成要查資料庫。
處理方式是 `revalidateTag`：發佈時打掉那個 key 的快取，
平常仍然是快取命中。**不做「每次請求都查」**——
首頁的載入速度是這個網站的賣點之一，而且有一支效能稽核在盯。

### 與 Agent 的關係（容易漏掉的一條）

`src/config/pricing.ts` 現在同時餵給 **Agent 的系統提示**（Phase 5：
「模型會自己編價格」那個 bug 的修法就是把真實價格放進提示）。
價格改成從 CMS 讀之後，那條路徑要跟著改，否則會出現
**畫面上是新價格、AI 講的是舊價格**——而且沒有任何地方會報錯。

這一條要有測試：Agent 的系統提示裡的價格，必須與 CMS 讀出來的是同一份。

---

## 三之三、前台的「自己設計 CRM」模組

Luffy：「前台也加上一個可以自己設計 CRM 的模組 你自己寫出來 一樣套 widget 排版」

### 這件事其實與現有的網站編輯器是同一個形狀

現有引擎的骨架是：

```text
使用者操作 → 一份被 zod 驗過的結構化設定 → Renderer → 畫面
```

CRM 設計器是同一條線，只是設定的內容從「區塊」變成「欄位與檢視」：

```text
CrmDefinition  這個 CRM 有哪些實體、每個實體有哪些欄位
CrmView        每個實體的清單／表單怎麼排（← 這裡就是 widget 排版）
CrmRecord      實際的資料
```

所以 CR-003-4 做的東西幾乎全部可以重用：拖曳、鍵盤上下移、復原／重做、
選取狀態、內容面板、存檔。**不是重寫一個編輯器，是換一組 widget。**

### ⚠️ 絕對不能做的那件事：拿使用者的定義去下 DDL

「使用者自己設計 CRM」最直覺的做法是「他定義一張表，我們就 `create table`」。
**不行。** 那等於把 DDL 權限交給不可信輸入，而且：

- 每個使用者一組表，RLS policy 數量隨使用者成長
- 改欄位＝線上 migration，改錯就是資料遺失
- 表名來自使用者輸入，SQL 注入的面積直接拉滿

做法是**一張表配 jsonb**：

```text
crm_definitions   使用者設計的結構（zod 驗過的 JSON，形狀與 SiteConfig 同層級）
crm_records       owner_id + definition_id + entity + data jsonb
```

RLS 一條就夠：`owner_id = auth.uid()`。使用者加一個欄位不會產生任何 DDL。
代價是查詢要走 jsonb 路徑運算子與 GIN 索引——這個規模完全吃得下。

### 邊界要現在畫清楚

```text
✅ 自訂實體與欄位（文字/數字/日期/單選/多選/關聯）
✅ 清單與表單的 widget 排版
✅ 自己的資料只有自己看得到
❌ 公式欄位、自動化規則、權限分享、匯入匯出大量資料
❌ 給別人用的多人協作 CRM（那是另一個產品）
```

⚠️ 這個模組與 Phase B 的「我們自己的 CRM」是**兩件不同的東西**，
不要共用資料表也不要共用元件命名：

```text
clients / deals / …     我們自己在用的，後台，只有員工讀得到
crm_definitions / crm_records   訪客自己設計的，前台，只有他自己讀得到
```

參考專案兩次踩到「同一個字兩個意思」。這裡的風險更高——
兩邊都叫 CRM。所以程式碼裡一律用 `backoffice`（我們的）與
`crm-builder`（他們的）兩個字，`CRM` 這個字不單獨當識別字用。

### 定價

與網站編輯器一致（定價 B）：**免費設計、存檔要帳號**。
資料筆數要有上限，理由與 `saved_sites` 的 20 份一樣：
一支腳本可以用一個帳號寫爆資料庫，而這條路徑是登入者能直接觸發的。
上限放在資料庫 trigger，不是只放在應用層。

---

## 四、分段計畫（Phase B — Backoffice）

每一段照既有的 5 項 gate（typecheck / lint / test / build / visual review）。

```text
BA  Dashboard 外殼            共用 shell、導覽資料、路徑→區段對應、
                              「每頁都在導覽裡」的守衛。兩邊都換上去
BB  會員 dashboard            /account 現有內容搬進外殼 + 「我的詢問」
                              （leads 的 profile_id 終於有讀取端）
BC  網站管理 dashboard 首頁   統計卡片 + 收件匣（MD）。現有作品集頁搬進去
BD  CRM 一：客戶與聯絡記錄    clients / client_contacts / notes / activities
                              lead → client 的轉換
BE  CRM 二：報價與成交        deals / deal_items，看板與清單兩種檢視
BF  ERP 一：專案與工時        engagements / milestones / time_entries
                              與 portfolio_projects 的關聯（做完的案子變作品）
BG  ERP 二：帳務              invoices / invoice_lines / payments
BH  CMS                       cms_documents / cms_blocks / cms_revisions
                              先接 FAQ 與價格（價格同時要接 Agent 的系統提示）
```

前台的 CRM 設計器不在 Phase B 裡——它是**訪客用的功能**，不是後台。
另立一段接在 CR-003-4 後面：

```text
CR-003-5  CRM 設計器（前台）  crm_definitions / crm_records
                              重用 CR-003-4 的拖曳、鍵盤、復原、存檔
```

⚠️ 這一段排在 **BA 之後、BD 之前**做比較好：BD 是我們自己的 CRM，
兩件事同時在做的話，命名一定會混。先把訪客那套做完、名字定下來，
再做後台那套。

**BA 一定要第一個做完。** 外殼定下來之後，後面每一段都是「加一個區段」，
而不是「再想一次版面怎麼排」。反過來做的話，BD 做完再回頭套外殼，
等於每一頁都要重寫。這與 CR-003-4 先做鍵盤再做拖曳是同一個理由。

**規模誠實說：** 這是七段，比 CR-003 的四段大。
BD～BG 每一段都有自己的資料表、RLS、後台 CRUD、清單與詳細頁。
不要期待一天做完。

---

## 五、從參考專案抄什麼、不抄什麼

### 抄

```text
nav-items.ts 的「導覽是一份資料」        ai_island_v3
sectionForPath() 的路徑→區段對應          ai_island_v3
AdminShell 的桌機固定側欄 + 手機抽屜      SnowRealmSpace
後台首頁把導覽做成有說明的卡片            SnowRealmSpace
StatCard / ChartBlock 的元件介面          insight-engine
URL searchParams 當篩選條件（免 client state）ai_island_v3
RLS helper 函式（security definer）        SnowRealmSpace
```

### 不抄

```text
raw pg Pool + 手寫 WHERE tenant_id        insight-engine
  → 沒有 RLS 安全網，漏一個條件就外洩。1page 一律走 RLS

110 個平鋪的後台頁面                       ai_island_v3
  → 他們得為了逛自己的後台做一個 Cmd-K。分組導覽 + 每頁都在導覽裡

client component 當後台根 layout           insight-engine
  → 整棵樹變成 client，還要 KNOWN_ADMIN_PAGES 之類的 hack 才分得出路由

role 用自由文字 + TS 白名單                 兩個專案都是
  → 用 enum 或 check constraint，資料庫自己擋

後台一律走 service role client             ai_island_v3
  → 少一層防護。1page 的後台照樣走 RLS，service role 只給 migration 與腳本
```

---

## 六、必須先決定的（Luffy 裁決）

1. **BB 的「我的詢問」要不要讓會員看到我們的回覆？**
   要的話就需要 MC（帳號內聯繫），而 MC 目前排在 Phase M 沒做。
   不要的話，會員頁只列「我留過什麼」。

2. **報價單要不要能匯出 PDF？**
   要的話會多一個相依（PDF 產生），而且要決定在伺服器還是瀏覽器產生。
   先不做的話，BE 只到「畫面上看得到報價內容」。

3. **工時要不要計時器（開始／停止），還是只手動填？**
   計時器需要處理「忘了停」「跨日」「多裝置同時開」，那是一個獨立的小專案。
   建議 BF 先只做手動填，計時器另外評估。

4. **CMS 先接哪幾個地方？**
   建議 BH 只接 FAQ 與價格兩處——它們現在就在痛（FAQ 有四個空缺要改程式才補得上，
   價格改一次要同時記得改 Agent 的系統提示）。首頁全文案化留到之後，
   一次全部搬進 CMS 會讓 BH 變成三段的量。

5. **CRM 設計器的資料筆數上限訂多少？**
   `saved_sites` 是每人 20 份。CRM 記錄的性質不同（一份 CRM 裡會有幾百筆），
   建議「每人 5 份定義、每份定義 2000 筆記錄」，一樣用資料庫 trigger 擋。

---

## 七、這份 CR 沒有解禁的東西

```text
金流串接                仍然不做。invoices/payments 是記帳，不是收錢
多租戶                  1page 是我們自己的網站，不是給別人開後台的 SaaS
SiteConfig 的安全邊界    §36 全部維持
兩個後台的授權分離       §47 / CR-002 維持
使用者定義的 DDL         永遠不做。CRM 設計器一律 jsonb，見三之三
CMS 產生新路由           CMS 管既有頁面的既有欄位，不長新頁面
```

---

## 八、這份 CR 之後的總量

```text
Phase B     BA BB BC BD BE BF BG BH    八段（後台）
CR-003-5    CRM 設計器                 一段（前台，插在 BA 與 BD 之間）
```

比 CR-003 的四段大一倍以上，而且 BD～BG 每一段都自帶資料表、RLS、
CRUD、清單與詳細頁。**照既有的節奏，這是好幾天的量，不是一天。**

先做的順序建議：**BA → BB → BC → CR-003-5 → BH → BD → BE → BF → BG**。

理由：
- BA 定外殼，後面每一段才是「加一個區段」而不是「再想一次版面」
- BB / BC 只是把現有東西搬進去，做完馬上看得到整體長相
- CR-003-5 排在 BD 前面，先把「訪客的 CRM」名字定死，後台那套才不會撞名
- BH（CMS）排在 BD 前面，是因為它現在就在痛（改一句文案要部署一次）
