# Phase 1 Implementation Plan

**Source of Truth:** `docs/1page-v1-spec.md` (V1.1, FROZEN)  
**狀態:** ✅ Reviewed & Approved — 1A 可開始  
**範圍:** Phase 1 only（1A–1E）。Phase 2 以後不在此文件內。

**已裁決：** A 思源宋標題 + 黑體內文｜B pnpm｜C `/_dev/*` 保留、Production 硬排除（詳見 §11）

---

## 0. 本計畫的規則

```text
1. Review 通過前不寫任何 code
2. 一次只做一個 Sub-phase
3. 每段結束必須通過 Gate，才進下一段
4. Gate 未過不得「先做下一段之後再回來補」
5. 實作與 Spec 衝突時，寫進 §9 規格衝突，不自行改 Spec
```

---

## 1. Phase 1 的定義與邊界

Phase 1 產出：**一個可運作、可視覺驗收、但沒有真實資料的首頁。**

### 做

```text
Next.js 專案骨架
Design Token 系統
Home Goal Context（URL-driven）
八個 Layout Primitives
首頁組裝（§4 IA 完整順序）
Responsive 8 斷點
A11y 基線
```

### 不做（明確排除，防 Scope Creep）

```text
❌ Supabase 連線 / 任何 DB
❌ 任何 LLM API 呼叫
❌ SiteConfig Schema / SiteRenderer / Theme Engine   → Phase 3
❌ 真實 Template                                      → Phase 4
❌ Agent 對話邏輯                                      → Phase 5
❌ Admin / 上傳                                        → Phase 2
❌ Analytics 實際上報（只留 call site）                 → Phase 7
```

**Template Experience 與 Agent Workspace 在 Phase 1 只做「殼」。**

殼的定義：版面、間距、互動骨架、TypeScript 介面已定義；
內容為 stub，切換按鈕**不接任何行為**（寧可 disabled，也不准用 DOM patch 假裝會動）。

> 這條是針對 V3 Demo 的具體防呆。§45.1 已記錄 Demo 用 `element.style.background`
> 偽造主題切換。Phase 1 若為了 demo 效果重蹈覆轍，Phase 3 會整段重寫。

---

## 2. 技術選型（需 Review 確認）

| 項目 | 選擇 | 理由 |
|---|---|---|
| Framework | Next.js App Router | Spec §1 |
| Language | TypeScript `strict: true` | — |
| Styling | **Tailwind CSS v4**（CSS-first `@theme`） | Token 定義在 CSS 變數，Tailwind utility 與 runtime Theme 共用同一份來源 |
| Motion | Framer Motion，限定 client island | Spec §33 警告過量 client component |
| Package Manager | pnpm | 待確認 |
| Unit Test | Vitest + React Testing Library | — |
| A11y Test | `@axe-core/react` + `vitest-axe` | Spec §35 |
| Visual / Responsive | Playwright（截圖矩陣，非像素比對） | Spec §34 八斷點 |
| Lint | ESLint (`next/core-web-vitals`) + `jsx-a11y` + Prettier | — |
| Validation | Zod | Spec §36 |

---

## 3. ⚠️ 最關鍵的架構決策：兩套 Token 系統不得混用

這是 Phase 1 最容易做錯、且錯了必然導致重寫的一點。

```text
系統 A：一頁起家官網自己的品牌 Token
  暖白 / 近黑 / Rocket Red
  Build-time，全域
  Tailwind @theme + CSS custom properties on :root

系統 B：SiteConfig.theme（§14）
  被預覽的「客戶網站」主題
  Runtime，per-config，可即時切換
  必須 scoped 注入，絕不可寫進 :root
```

**若把 B 實作成覆寫全域 CSS 變數，Preview 會污染官網本身，或反向繼承官網品牌色。**

Phase 1 的義務：

```text
1. 系統 A 完整建立
2. 系統 B 只定義 TypeScript 介面與「scope 邊界」，不實作
3. Preview 區塊的 DOM 從第一天就包在 scope container 內
   例：<div data-site-scope style={cssVarsFromTheme}>
4. 官網 token 一律 --brand-*，站點 token 一律 --site-*，命名層級即隔離
```

即使 Phase 1 的 Preview 是張 stub，**scope container 也要先存在**。

---

## 4. Sub-phase 1A — Scaffold + Design Tokens

### 目標
專案可跑、Token 系統成形、有可視覺驗收的 Token 樣本頁。

### 工作項

```text
Next.js + TS strict + App Router 初始化
依 Spec §2 建立目錄骨架（空資料夾 + index barrel）
Tailwind v4 接入
建立 src/styles/tokens.css
建立 src/config/ 空殼（services / pricing / portfolio-categories）
ESLint / Prettier / Vitest / Playwright 設定
package.json scripts（見 §8 Gate）
建立 /_dev/tokens 樣本頁
```

### Token 範疇（Spec §43 Phase 1 指定的八類）

```text
color        --brand-bg / paper / ink / muted / line / accent / accent-soft
typography   font family、size scale、line-height、letter-spacing、weight
spacing      間距階
radius       圓角階
shadow       陰影階
container    最大寬度、gutter
breakpoint   §34 八個斷點
motion       duration、easing、reduced-motion fallback
```

### 具體數值來源

色彩沿用 V3 Demo（§3.0 允許）：

```text
bg      #f4efe7
paper   #fffdf9
ink     #141414
muted   #726d66
line    #d8d0c7
accent  #ef3e2f
```

**但字級不沿用。** Demo 的 H1 是 `clamp(52px, 8vw, 96px)`，
Spec §3 要求桌機 72–112px、手機 44–64px，需重新建 scale。

### 字型實作（裁決 A 的落地方式）

決策：**思源宋體（Noto Serif TC）標題 + 黑體內文。**

角色分工必須寫死，不可蔓延：

```text
宋體  僅限 Editorial Heading（H1 / H2 / 大型引言）
黑體  內文、導航、按鈕、表單、價格、Agent 對話、所有功能性文字
```

> Agent 對話一律黑體。宋體用在 AI 客服會像在朗誦民國文學選集。

#### ⚠️ 這是 Phase 1 的頭號效能風險

完整 Noto Serif TC 單一字重約 5–10MB。若天真地整套載入首屏，
§33 的 `LCP < 2.5s` 直接失守——而字型正好落在 LCP 元素（H1）上。

實作策略：

```text
標題宋體
  自託管 + unicode-range 分片（cn-font-split 或等效工具）
  只載 1 個字重（標題用，建議 600 或 700）
  font-display: swap
  不使用 next/font/google 直接載 CJK（會 self-host 全量）

內文黑體
  系統字體堆疊優先，零下載
  PingFang TC → Microsoft JhengHei → Noto Sans TC → sans-serif

英文 / 數字
  Inter via next/font/google（Latin subset，體積可接受）
```

三條硬規則：

```text
1. 只載實際用到的字重，不整套字族塞進來
2. 中文字型不得阻塞首屏渲染
3. fallback 堆疊明確寫出，且 fallback 狀態下版面不得跳動（CLS，§33）
```

1A 的 Gate 必須實測首屏字型傳輸量，並記錄數值。
若分片後仍拖垮 LCP，這是 §10 規格衝突的正當案例，提 CR 而非硬做。

### /_dev/tokens 樣本頁

1A 若沒有可看的東西，Gate 的「visual review」無從執行。
此頁列出全部 token：色票、字級階梯、間距尺規、陰影、圓角、motion 示範。

`/_dev/*` 的排除規格見 §11 C——**不是「藏起來」，是非開發環境直接 404。**

### 出口條件

```text
✅ Gate 五項全過
✅ /_dev/tokens 完整呈現八類 token
✅ tokens.css 為唯一數值來源，元件中無 hard-coded 色碼／字級
✅ 中文字型實際載入並在樣本頁可見（不重蹈 Demo 宣告 Inter 卻沒載入）
```

---

## 5. Sub-phase 1B — Home Goal Context

### 目標
首頁的狀態機制先於任何 Section 存在。（Spec §6.2 明列為不可後補）

### 工作項

```text
src/config/home-goals.ts   六個 goal 定義 + 對應 filter 映射
src/features/home/goal-context.tsx
  - Server: page.tsx 讀 searchParams
  - Client: Provider 持有 optimistic state
  - 寫回 URL：router.replace(..., { scroll: false })
Zod 驗證 ?goal= 值
無效值 → fallback "unsure"，不 crash、不丟 404
useHomeGoal() hook
```

### Source of Truth 的精確定義（Guardrail 3）

「URL 是 Source of Truth」與「切 Goal 不可整頁 reload」看似衝突，必須寫清楚：

```text
初始渲染      URL → state          Server 讀 searchParams，決定首次輸出
互動當下      state → 立即渲染      client context 樂觀更新，畫面即時反應
互動之後      state → URL          router.replace(scroll:false)，供分享與 analytics
```

即：**URL 是初始來源與可分享紀錄，互動期間由 client state 驅動畫面。**
兩者在定義好的時點單向同步，不同時爭奪控制權。

Phase 1 的資料是 in-memory，filter 一律在 client 完成，不觸發 RSC 重取。
Phase 2 接 Supabase 後，是否改為 server-side filter 需重新評估——
屆時若要改，走 §10 CR 流程。

### 非法值與預設（Guardrail 3）

```text
/?goal=website    ✅ 生效
/?goal=banana     → fallback "unsure"，不報錯、不 404、不留在 URL 上誤導
（無 goal 參數）   → "unsure"，不套用任何 filter
```

### Goal 對應映射（Spec §6.1）

| goal | Work filter | Template filter | Service highlight | Agent intent |
|---|---|---|---|---|
| website | web | web | Web | website |
| brand | brand | — | Brand & Design | brand |
| marketing | content, social, advertising | — | Content & Growth | marketing |
| content | content | — | Content & Growth | content |
| ai | ai, automation | product | AI & Automation | ai |
| unsure | 不 filter | 不 filter | 不 highlight | unclear |

映射表放 config，不寫死在元件。

### 測試（Gate 的 test 項在此才真正有內容）

```text
URL ?goal=website → context = website
點選 goal → URL 同步更新
?goal=<不存在> → unsure，不拋錯
unsure → 不套用任何 filter
重新整理保留 goal
瀏覽器上一頁可回到前一個 goal
```

### 出口條件

```text
✅ Gate 五項全過
✅ 上述測試全綠
✅ 尚無任何 Section，但 /?goal=ai 可透過臨時 debug 輸出驗證狀態正確
```

> 1B 幾乎沒有視覺產出，visual review 這關檢查的是 URL 行為，不是畫面。

---

## 6. Sub-phase 1C — Layout Primitives

### 目標
八個版面元件各自成立，資料為 mock，尚未組裝成首頁。

### 八個 Primitive（Spec §43）

```text
1. Navbar          含 Mobile Nav（Demo 缺，§45.1）
2. Hero            §5 文案與雙 CTA
3. EditorialSection 大字 + 留白，非卡片
4. PortfolioLayout  滿版 / 不等寬網格
5. TemplateExperienceShell
6. AgentWorkspaceShell
7. PricingLadder    §26.2 兩組敘事，非六欄卡片
8. DarkCTABlock
```

### §3.1 Section Rhythm 的執行方式

八個 primitive 中只有 **PortfolioLayout** 與 **Services 用的卡片變體**屬於卡片文法。
其餘必須是別的版式。若實作時發現自己又在做「標題 + 一排圓角卡」，就是走錯了。

### Client / Server 邊界

```text
Server Component（預設）
  Hero、EditorialSection、PricingLadder、DarkCTABlock

Client Component（必要互動才用）
  Navbar（mobile toggle）
  GoalSelector
  TemplateExperienceShell（device toggle UI）
  AgentWorkspaceShell（輸入框）
```

Framer Motion 只出現在 client island，且一律尊重 `prefers-reduced-motion`。（§33、§35）

### 兩個 Shell 的介面先定，實作留空

```text
TemplateExperienceShell
  props: { config: SiteConfig | null, device: Device }
  內部預留 <div data-site-scope>，內容為 stub
  Theme / Device 切換 UI 存在但 disabled，附註 Phase 3/4

AgentWorkspaceShell
  props: { initialIntent: HomeGoal }
  聊天區為靜態範例訊息
  輸入框 disabled，附註 Phase 5
```

**不准為了看起來會動而寫任何 DOM 樣式操作。**

### 出口條件

```text
✅ Gate 五項全過
✅ /_dev/primitives 元件展示頁可逐一檢視八個 primitive
✅ 兩個 Shell 的 TS 介面已定，且 site scope container 已存在
✅ Mobile Nav 可實際開闔並支援鍵盤操作
```

---

## 7. Sub-phase 1D — Homepage Composition

### 目標
依 §4 IA 組裝首頁，並接上 1B 的 Goal Context。

### IA 順序（不得調換）

```text
Navbar → Hero → Goal Selector → Selected Work
→ Template Experience → AI Website Advisor → AI Philosophy
→ Services → Pricing → Process → Final CTA → Footer
```

### 內容來源一律 config

```text
config/services.ts              四條產品線（§7）
config/pricing.ts               完整六級（§26.1）
config/portfolio-categories.ts  §8.6
config/home-goals.ts            1B 已建
```

### Portfolio 的過渡處理（重要）

Phase 1 無 DB，但**不可寫成 hardcoded JSX**（§8 明文禁止）。

作法：定義 repository 介面 + in-memory 實作。

```text
features/portfolio/repository.ts
  interface PortfolioRepository {
    listFeatured(): Promise<PortfolioProject[]>
    listByGoal(goal: HomeGoal): Promise<PortfolioProject[]>
  }

features/portfolio/in-memory-repository.ts
  回傳符合 §8.4 PortfolioProject 型別的假資料
```

Phase 2 只換實作，元件與型別不動。

### Repository 只定當下需要的 contract（Guardrail 2）

**介面只能有這兩個方法。** Phase 1 的首頁只需要「精選」與「依 Goal 篩選」。

明確不做：

```ts
// ❌ 不要第一天就寫這種東西
search(criteria, pagination, sort, projection, include, relations)
```

也**不要**先加 `getBySlug()`——`/work/[slug]` 是 Phase 2 的事，
Phase 1 沒有任何呼叫端。沒有呼叫端的方法就是規格債，不是前瞻性。

在還沒有客戶之前，不需要一顆 Enterprise Portfolio DBMS。

假資料必須標 `projectType: "demo"` 或 `"internal"`，
且 UI 顯示對應標籤——**Phase 1 的假資料也不准偽裝成客戶案例**（§8.2、§29）。

### 必須照 Spec 的文案

```text
H1        從第一頁，開始你的生意。
Subcopy   網站、品牌、內容、設計與 AI 自動化。
          從想法、設計到真正可以使用的產品。
Badge     AI-assisted · Human-reviewed
CTA 1     看看你的網站可以長怎樣
CTA 2     看看我們做過什麼        ← Demo 誤植為「瀏覽所有服務」（§45.1）
Final CTA 你不需要先知道怎麼做。只需要告訴我們，你想完成什麼。
```

### Analytics 只留 call site

```text
lib/analytics/track.ts   簽章正確，實作為 no-op + dev console
```

§31 事件名稱先接好，Phase 7 再接供應商。

### 出口條件

```text
✅ Gate 五項全過
✅ 首頁 IA 順序與 §4 完全一致
✅ 點 Goal → Work / Template / Services / Agent CTA 四處同步改變
✅ 六級價格完整且非六欄卡片
✅ 頁面無 hard-coded 商業內容，全部來自 config
✅ 連續卡片網格 Section 未超過兩次（§3.1）
```

---

## 8. Sub-phase 1E — Responsive + A11y Baseline

### 目標
Phase 1 的品質收尾，把 Demo 的技術債清單（§45.2）一次結清。

### Responsive（§34 八斷點）

```text
375  390  430  768  1024  1280  1440  1920
```

每個斷點檢查：無橫向捲動、Nav 可用、字級可讀、觸控目標 ≥44px。

### A11y（§35）

```text
語意化 HTML（非全 div）
鍵盤可完整操作首頁
focus 可見且非預設藍框
aria-label 補齊圖示型按鈕
色彩對比 AA
prefers-reduced-motion 生效
表單錯誤訊息可讀
圖片 alt（Demo 的 CSS 漸層佔位無 alt，§45.1）
```

### Performance 抽查（§33）

```text
LCP < 2.5s
CLS < 0.1
確認 Hero 無 blocking 資源
確認未在首屏載入 Agent 相關任何東西
```

### 出口條件

```text
✅ Gate 五項全過
✅ 八斷點截圖矩陣完成且人工看過
✅ axe 零 critical / serious
✅ 鍵盤走完首頁全部互動
✅ Lighthouse 手動跑一次並記錄數值
```

---

## 9. Gate 定義

每個 Sub-phase 結束執行，**五項全過才進下一段**。

```text
1. typecheck     pnpm typecheck    tsc --noEmit，零 error
2. lint          pnpm lint         ESLint + Prettier，零 error、零 warning
3. test          pnpm test         Vitest，全綠
4. build         pnpm build        next build 成功，零 type error
5. visual        pnpm shots        Playwright 產出截圖 → 人工 review
```

### 關於第 5 項

Playwright 只負責**產生**八斷點截圖到 `artifacts/<sub-phase>/`，
不做像素比對（Phase 1 版面仍在變動，pixel diff 只會製造噪音）。

判定由人做。這一關的通過標準是你說過。

### Gate 失敗處理

```text
修到過為止。不接受：
  「先跳過，1E 一起處理」
  「這個 warning 不影響功能」
```

---

## 10. Spec Change Request 流程

Frozen 的意思是「不得邊做邊改」，**不是「發現 Spec 有 bug 也硬做」**。

正確流程：

```text
發現 Spec 問題
    ↓
停止該項實作（不繞過、不自行變通）
    ↓
提出 Change Request（記錄於下表）
    ↓
人工裁決
    ↓
Spec 升版（V1.2）
    ↓
恢復實作
```

工程師不自行改 Spec，也不把錯誤規格當聖旨撞牆。兩種都不對。

### CR 紀錄

```text
（目前無）

| # | 日期 | Sub-phase | Spec 章節 | 問題 | 建議 | 裁決 | 版本 |
```

---

## 11. 已裁決事項

### A. 字型 ✅ 思源宋體標題 + 黑體內文

理由：全站黑體無法建立「精品工作室 × Editorial」的辨識度。
宋體負責標題氣勢，黑體負責一切功能性資訊。

實作規範與效能風險見 §4「字型實作」。**這是 Phase 1 的頭號效能風險項。**

### B. Package Manager ✅ pnpm

第一天鎖定，並寫入 `package.json`：

```json
"packageManager": "pnpm@<version>"
```

避免後續 npm / pnpm / yarn 三教合流，產生多份 lockfile。
CI 與本機一律 `pnpm install --frozen-lockfile`。

### C. `/_dev/*` ✅ 保留，Production 硬排除

保留原因：Phase 1 的 visual review 需要固定靶，否則 1A、1B 無畫面可審。

排除方式**不是把導航連結藏起來**，而是：

```text
非開發環境 → 直接 404 / route unavailable
```

實作：`if (process.env.NODE_ENV !== "development") notFound()`

### C.1 開發路由不得污染產品訊號（Guardrail 1）

`/_dev/*` 是開發工具，不是產品內容。必須同時排除於：

```text
sitemap.xml        不得收錄
robots.txt         明確 disallow
analytics          不得發送任何 §31 事件
metadata           noindex, nofollow
```

否則將來會出現客戶逛到 `/_dev/tokens` 觀賞我們的 RGB 配色研究報告。

---

## 12. 執行順序總覽

```text
Review 本計畫               ✅ 通過
    ↓
裁決 §11 三項               ✅ 完成
    ↓
1A Scaffold + Tokens        → Gate   ← 現在在這裡
    ↓
1B Home Goal Context        → Gate
    ↓
1C Layout Primitives        → Gate
    ↓
1D Homepage Composition     → Gate
    ↓
1E Responsive + A11y        → Gate
    ↓
Phase 1 完成 → 進 Phase 2（Portfolio Schema / Admin / Upload）
```
