# Daily Works — 2026-08-11

Luffy。Claude 值班。
主題：**Phase 2 收尾（後台 + R2 媒體）→ Phase 3 全段完成（Website Engine）→ 接線稽核 + PWA**。

---

## ✨ 新做的

### 1. 2E 後台權限 + 作品 CRUD
- 參考 `ai_island_v3` / `SnowRealmSpace` 的密路徑模式，取其中最嚴謹的版本。
- 三層防線：密路徑（防掃描）→ `requireAdmin()` 身分驗證 → RLS（真正的邊界）。
- `ADMIN_SEGMENT` **無 `NEXT_PUBLIC_` 前綴**，且 `config/admin.ts` 匯入 `server-only`——client 誤引用直接編譯失敗。
- 選單入口只渲染給已驗證的後台人員：`getAdminEntry()` 回 null 時，密路徑完全不出現在送給瀏覽器的 HTML。
- Server Action 各自驗證身分（它們是可從瀏覽器直接呼叫的端點，「按鈕只有 admin 看得到」不構成保護）。
- 後台一律用**帶 cookie 的 anon client 而非 service role**：能讀草稿是因為 RLS 放行。
- 作品列表刻意**沒有刪除按鈕**（作品是累積型資產，誤刪代價高於封存）；新增時來源預設 Demo 而非 Client。

### 2. `pnpm gen:slug` 密路徑產生器
- 格式：base58（預設）/ alnum / alnum-mixed / hex / words，可指定長度與數量。
- `crypto.randomInt` 而非 `Math.random`（後者可預測）；不用 `% alphabet.length`（模數偏差）。
- 輸出標示熵值，低於 64 bits 直接警告。base58 排除 `0 O I l`——這串路徑遲早要有人用眼睛核對。

### 3. 2F 媒體上傳（Cloudflare R2）
- presigned URL 流程：**先驗證身分**，再驗 MIME/副檔名/大小，最後才簽發。
- 上傳鏈路四個鎖全部對真實 R2 驗證：key 由伺服器產生、Content-Type/Length 簽入簽章、篡改 key 使簽章失效、300 秒到期。
- MIME × 副檔名雙重比對；檔名 sanitize；拖曳排序；上傳進度（XHR 而非 fetch，後者回報不了進度）。
- SVG 刻意不在白名單（Spec §36 允許「停用 raw inline rendering」，此處採最徹底版本）。

### 4. Phase 3 Website Engine 全段
- **3A SiteConfig Schema**：SiteConfig 是不可信輸入（Spec §44 Agent 生成），Spec §36 的五條 Preview 要求全部在 schema 落實。色彩只接受明確列舉形式，不接受「看起來像顏色的東西」。
- **3B Theme Engine**：`--site-*` 注入 `[data-site-scope]`，e2e 於真實瀏覽器確認 `:root` 上沒有任何 `--site-*`。
- **3C Section Registry**：9 個 Section 元件、hero 三種 variant。用 Tailwind 任意值 `bg-[var(--site-*)]` 而非 inline style。
- **3D SiteRenderer**：唯一正式渲染入口，Preview 與正式網站共用。

### 5. `pnpm audit:wiring` 接線稽核
- 查「看起來有做、實際上沒接」的那一類問題，那些不會被 typecheck 或單元測試抓到。
- 七項：DB 欄位↔產生型別、程式碼 select↔DB、未接線欄位、公開路由、後台保護、草稿隔離、媒體網域。

### 6. PWA
- `manifest.webmanifest` + `/icon` + `/icon-maskable`（動態產生，`ImageResponse`）。
- `display: minimal-ui` 而非 `standalone`：保留網址列。對一個要建立信任的接案網站，藏網址列的代價大於「看起來像 app」的收益。
- 刻意**不做離線快取**：內容會變動的行銷網站做離線快取，只會讓訪客看到過期的作品集。
- `maximumScale: 5` 不鎖縮放（Spec §35）。

---

## 🐛 修好的

### Zeabur 部署失敗（`/sitemap.xml` 預先產生時撞上守衛）
把「production 執行期」與「production 建置期」混為一談。守衛意圖正確，但建置期拋錯擋掉的不是「展示假資料」而是「部署本身」。
改為 `sitemap` force-dynamic + `NEXT_PHASE` 判斷。驗證方式是**移開 `.env.local` 重跑 build**，不是推論。

### 簽名網址沒有鎖住 Content-Type（實際安全漏洞）
`PutObjectCommand` 帶了 `ContentType`，註解也寫了「R2 會驗證」，但實測：拿簽給 `image/png` 的網址上傳 `text/html`，**R2 回 200 接受**。
presigner 預設只簽 `host`，其餘標頭被提升成查詢參數而不納入簽章。修正：明確指定 `signableHeaders`。

### 一筆壞媒體網址讓整個作品頁 500
種子的 `example.invalid` 假封面被送進 `next/image`，未設定的主機名直接拋錯。
repository 改為只接受自家 R2 網址，其餘降級為佔位色塊——正確的失敗方式是少一張圖，不是整頁掛掉。

### `/icon-maskable` 回 404
寫成 `app/icon-maskable.tsx`，但 Next 的檔案慣例只認 `icon.tsx` 等固定檔名，自創檔名不會產生路由。manifest 指過去直接 404。改成 route handler。
build 輸出的路由清單看得出來，但只看「build 成功」不會發現。

### 三個死連結（Hero `#try` / Final CTA `#contact` / Navbar `#top`）
都沒有任何既有測試涵蓋。錨點連結特別容易腐爛：改了 section id 不會有東西壞掉，直到有人真的點下去。
新增 `tests/e2e/no-dead-links.spec.ts`。

### a11y 對比違規（三處，全在 token 層）
`--color-brand-muted` 4.48（差 0.02）、白字 on accent 3.88、accent 當文字 3.39。
新增 `--color-brand-accent-strong`：Rocket Red 保留為品牌色但**限裝飾用，不得承載文字**。

---

## 🔍 審查（Luffy 要求：API↔DB 別接錯欄位、UI↔後端接線、RWD）

以 `pnpm audit:wiring` 實測，非閱讀程式碼。

```text
【1】DB 欄位 ↔ 產生型別      45 個欄位全部同步          ✅
【2】程式碼 select ↔ DB      17 個欄位取用，無未知欄位   ✅
【3】未接線欄位              5 個（見下方待辦）          ⚠️
【4】公開路由                7 條全部符合預期狀態碼      ✅
【5】後台保護                裸 /admin 404、密路徑導向登入、首頁 HTML 不含密路徑  ✅
【6】草稿隔離                列表不含、詳細頁 404        ✅
【7】媒體網域                目前無媒體記錄              ✅
```

**RWD**：`/`、`/work`、`/work/[slug]` 三條路由 × 8 個斷點（375/390/430/768/1024/1280/1440/1920），
每個斷點各跑 axe 掃描 + 橫向捲動檢查，全數通過。後台頁面尚未納入斷點檢查（見待辦）。

**測試總數**：167 unit + 98 e2e + 45 db = **310**。

---

## ⏳ 需 Luffy 操作（沒法純 code 修）

- **ai_island_v3 的密路徑必須更換**。`Ak83QDhUOVqx` 曾出現在 robots.txt 與每位訪客的根版面 JS chunk 中，改完程式碼救不回來。可用本專案的 `pnpm gen:slug` 產生新的。
- **ai_island_v3 的修改尚未 commit**（那是另一個專案，提交與否由 Luffy 決定）。
- R2 已綁自訂網域 `1page-r2.snowrealm.pet`，**與站台同註冊網域**。若之後要設 cookie，不要設在 `.snowrealm.pet` 範圍，否則媒體網域讀得到。

---

## 📌 記錄的坑

### 守衛通過不等於守衛有效（本日第二次）
`no-hardcoded-design-values` 的 inline style 規則原本比對 `style={{`，只抓得到物件字面值。
`SiteScope` 寫的是 `style={vars}`，**整個漏掉**——那條規則從 1A 立起到現在，
對「主題注入」這種真正需要被審視的寫法完全無效，而它一直是綠的。

前一次是 2E：兩條後台安全測試因為 Playwright 沒載入 `.env.local` 而**靜默跳過**，報告全綠。

### 一份全是誤報的稽核比沒有稽核更糟
`audit-wiring` 第一版用 `[\s\S]*?` 跨行比對 select 區塊，吃進整個檔案，
把 `const` / `await` / `return` 當成未知欄位回報。下次真的有問題時沒人會相信它。

### 判準要寫「要防什麼」，不是「什麼時候要」
佔位與錯誤細節原本用 `NODE_ENV === "development"`，測試環境（`"test"`）因此看不到。
要防的是**對正式環境訪客洩漏內部結構**，判準應為 `!== "production"`。

### 網域搬遷是加法，不是替換
R2 換自訂網域時若只認新網域，既有媒體記錄的網址還原不出 key，
會被 2F 加的「非自家網址就降級」防線誤傷而整批消失。

### 型別／鏡像一律要有一致性測試
資料庫型別（`db:types` + parity test）、品牌色鏡像（`brand-colors.test.ts`）。
允許重複，但不允許無聲分歧——分歧方向永遠是「程式以為可以，實際不允許」。

---

## 今日 commit（時間序）

```text
0eae27c  docs: phase 2-8 分段計畫 + feat(2a): portfolio schema & RLS (待驗證)
102d0fc  feat(2b): /work 列表 + Filter
da1d65a  feat(2c): /work/[slug] 詳細頁 + SEO；CR-001 物件儲存改用 R2
f115b80  feat(2a): RLS 對 Zeabur 資料庫驗證通過，Gate 補齊
a27ef3d  feat(2d): repository 換 Supabase 實作
5e45d13  fix: 修正 Zeabur 部署失敗——建置期不該擋住部署
b04e280  docs: .env.example 標明 R2 三個憑證值只需其中兩個
2fd8e5a  feat(2e): 後台權限 + 作品 CRUD
ef8fdb9  feat(2f): 媒體上傳（Cloudflare R2）— Phase 2 完成
65751e5  feat(3a): SiteConfig Schema + 驗證
9f0a3ba  chore: R2 自訂網域 + 確認公開註冊已關閉
a1b873c  feat(3b): Theme Engine（--site-* scoped 注入）
3a2fcca  feat(3c,3d): Section Registry + SiteRenderer — Phase 3 完成
（本篇 + 稽核腳本 + PWA 隨後提交）
```
