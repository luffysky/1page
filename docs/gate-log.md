# Gate Log

每個 Sub-phase 結束的五項檢查紀錄（Implementation Plan §9）。
未過不得進下一段。

---

## 1A — Scaffold + Design Tokens

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### 環境

```text
Node        v24.13.1
pnpm        9.15.9
Next.js     16.3.0 (Turbopack)
React       19.2.8
TypeScript  5.9.3
Tailwind    4.3.3
ESLint      9.39.5
Vitest      3.2.7
Playwright  1.62.1
```

### Gate 五項

| # | 項目 | 指令 | 結果 |
|---|---|---|---|
| 1 | typecheck | `pnpm typecheck` | ✅ 0 error |
| 2 | lint | `pnpm lint` | ✅ ESLint 0 error / 0 warning、Prettier 全數符合 |
| 3 | test | `pnpm test` | ✅ 14 tests / 2 files 全綠 |
| 4 | build | `pnpm build` | ✅ 成功，5 條路由全部靜態預先產生 |
| 5 | visual | `SHOT_TAG=1a pnpm shots` | ✅ 16 張截圖產出，人工檢視通過 |

截圖位置：`artifacts/1a/`（`home-*.png`、`dev-tokens-*.png`，各 8 個斷點）

### 出口條件核對

| 出口條件 | 驗證方式 | 結果 |
|---|---|---|
| Gate 五項全過 | 見上表 | ✅ |
| `/_dev/tokens` 完整呈現八類 token | 人工檢視截圖 | ✅ |
| tokens.css 為唯一數值來源 | `tests/unit/no-hardcoded-design-values.test.ts` | ✅ |
| 中文字型實際載入並可見 | CDP `CSS.getPlatformFontsForNode` | ✅ |

### 中文字型實測（Plan §4 要求記錄）

裁決 A（思源宋標題）是 Phase 1 頭號效能風險，故實測而非假設。

**實際套用的字型**（production build，CDP 直接查詢渲染結果）：

```text
<h1>  宣告 "Noto Serif TC"  →  實際使用 Noto Serif TC，繪製 12 字
<p>   宣告 Inter            →  實際使用 Inter，繪製 8 字
```

不重蹈 V3 Demo「宣告 Inter 卻未載入任何字體資源」（Spec §45.2）。

**首屏字型傳輸量**：

```text
211.1 KB / 5 個分片
  50.0 KB  ┐
  47.3 KB  │
  44.9 KB  ├─ Noto Serif TC unicode-range 分片（僅標題實際用到的字）
  42.5 KB  │
  26.5 KB  ┘  + Inter latin
```

產生的 `@font-face` 共 109 條，全部為 `font-weight: 700`，
按 unicode-range 切片；`preload: false` 使瀏覽器只抓實際用到的分片。

> ⚠️ **此數值會隨頁面中文字數增加而上升。**
> 目前僅為 1A 佔位頁的字量。1D 首頁文字大幅增加後必須重新量測，
> 1E 的 LCP 驗收以屆時數值為準。

指令：`node scripts/measure-fonts.mjs <url>` / `node scripts/verify-fonts.mjs <url>`

### Guardrail 1 實測（`/_dev/*` 不得污染產品訊號）

於 production server 實際請求驗證，非僅靠設定推論：

```text
GET /                 → 200
GET /_dev/tokens      → 404          ✅ 非開發環境直接 404
GET /robots.txt       → Disallow: /_dev/   ✅
GET /sitemap.xml      → 僅收錄 /            ✅
metadata              → noindex, nofollow  ✅
analytics             → 尚未接入，無事件可發
```

### 過程中修正的問題

| 問題 | 處置 |
|---|---|
| `next/font/google` 對 Noto Serif TC 無 `chinese-traditional` 具名 subset；寫 `subsets:["latin"]` 會使中文整批掉回 fallback | 改為省略 `subsets` + `preload:false`，取得完整 unicode-range 分片組 |
| Token 樣本頁的 Typography 樣本以 `<p>` 渲染，繼承 `--font-sans`，導致 display-* 樣本顯示黑體、樣本頁謊報 | 每列改為明示套用實際字族（`font-display` / `font-sans`） |
| `next dev` 與 `next build` 各自產生 route 型別，`next-env.d.ts` 被指向 dev 版，造成 typecheck TS2344 | `typecheck` 改為 `next typegen && tsc --noEmit`，自給自足不依賴前一個指令 |

### 與計畫的差異

| 計畫原文 | 實際 | 理由 |
|---|---|---|
| 1A 建立 `src/config/` 空殼（services / pricing / portfolio-categories） | 只建立目錄，未建立模組 | 目前無任何呼叫端。依 Guardrail 2（只定當下需要的 contract），config 內容於 1D 有消費者時才寫 |
| 技術選型含 React Testing Library、axe | 1A 未安裝 | 1A 測試皆為靜態契約檢查，不需 DOM。RTL 於 1C、axe 於 1E 引入，避免安裝未使用的相依 |

以上兩點皆屬「延後到有需要時」，非刪減；不影響任何出口條件。

---

## 1B — Home Goal Context

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 指令 | 結果 |
|---|---|---|---|
| 1 | typecheck | `pnpm typecheck` | ✅ 0 error |
| 2 | lint | `pnpm lint` | ✅ 0 error / 0 warning |
| 3 | test | `pnpm test` | ✅ 33 tests / 4 files（1A 14 → 1B 33） |
| 4 | build | `pnpm build` | ✅ 成功 |
| 5 | visual／行為 | `pnpm e2e` + `SHOT_TAG=1b pnpm shots` | ✅ e2e 9/9、截圖 16 張 |

> 1B 幾乎沒有視覺產出，Gate 第 5 項驗的是 **URL 行為**（Plan §5）。
> 因此新增 `tests/e2e/goal-url.spec.ts`，在真實瀏覽器驗證整條鏈路，
> 而非只靠 mock router 的單元測試。

### 出口條件核對

| 出口條件 | 驗證 | 結果 |
|---|---|---|
| Gate 五項全過 | 見上表 | ✅ |
| `?goal=website` → context = website | e2e | ✅ |
| 點選 goal → URL 同步更新 | e2e | ✅ |
| `?goal=banana` → unsure，不拋錯不 404 | e2e（HTTP 200）+ unit | ✅ |
| unsure → 不套用任何 filter | e2e + unit | ✅ |
| 重新整理保留 goal | e2e | ✅ |
| 上一頁可回到前一個 goal | e2e | ✅ |
| `/?goal=ai` 可透過 debug 輸出驗證 | `GoalDebugPanel`（僅 development） | ✅ |

額外驗證（非計畫要求，但屬真實情境）：

```text
切換 goal 不造成整頁重新載入   ✅（window 標記存活）
保留網址上的其他查詢參數        ✅（?utm_source=ig 廣告進站）
```

### ⚠️ 過程中抓到的重大問題：頁面根本沒有 hydrate

第一次跑 e2e：9 個測試中 6 個失敗，全部是「點擊後 URL 不變」。

根因：**Next 16 將經由 `127.0.0.1` 存取的 dev 資產視為跨來源，以 403 擋下，
HMR handshake 失敗，頁面完全沒有 hydrate。**

嚴重性在於它的表現形式：

```text
SSR HTML 正常     → 截圖完全看不出異狀
唯讀行為正常      → URL → state 的測試通過
所有互動失效      → 按鈕是死的
```

1A 的 16 張截圖就是在這個狀態下拍的。當時頁面無互動元素，不影響結論，
但這證明**純看畫面的驗收會漏掉「畫面對、程式死」這一整類問題**。

處置：`next.config.ts` 加入 `allowedDevOrigins: ["127.0.0.1"]`（僅影響開發環境）。

### 計畫修訂：`router.replace` → `router.push`

計畫原文寫 `router.replace`，但同節驗收要求「上一頁可回到前一個 goal」，
兩者矛盾（replace 不產生歷史紀錄）。改採 `push`，理由見 Plan §5 修訂說明。

未動 Spec（§6.2 只規定 URL 驅動，未指定 push/replace），故不需 CR。

### 另一個測試自身的 bug

「上一頁」測試起初失敗並退到 `about:blank`。實測 `history.length` 後確認
實作正常（2 → 3），是測試在 URL 寫入前就 `goBack()`——樂觀狀態更新刻意早於
URL 寫入，測試必須等 URL 真的變更。已於測試中補上等待並註明原因。

### 實作要點

```text
config/home-goals.ts        六個 goal + §6.1 對應表，唯一來源
features/home/goal-context  Provider / useHomeGoal
features/home/goal-debug-panel  僅 development 渲染
```

兩個刻意的設計選擇：

1. **不使用 `useSearchParams()`**，改在事件處理中讀 `window.location.search`。
   前者會讓元件與「頁面是否靜態預先產生」耦合（靜態頁需 Suspense 包裹），
   而目前只在使用者互動時才需要當前查詢字串。

2. **以「render 期間由 props 調整 state」同步上一頁／下一頁**，而非 `useEffect`。
   少一次多餘 paint，且是 React 官方建議寫法。

### 需要注意的取捨

首頁因讀取 `searchParams` 而成為**動態渲染**（build 輸出 `ƒ /`）。
Phase 1 無資料庫，成本可忽略；Phase 2 接 Supabase 後需重新評估快取策略，
1E 的 LCP 驗收也應涵蓋此路由。

### 相依調整

| 套件 | 時機 | 說明 |
|---|---|---|
| `zod` | 1B | `?goal=` 驗證（Spec §36 指定） |
| `@testing-library/react` 等 | 1B | 1B 首次出現 client provider 與 hook，RTL 於此才有用途 |
| `@vitejs/plugin-react` | 已移除 | 要求 vite ^8，vitest 3 帶 vite 7；vitest 的 esbuild 依 tsconfig 已能處理 TSX |

---

## 1C — Layout Primitives

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 結果 |
|---|---|---|
| 1 | typecheck | ✅ |
| 2 | lint | ✅ 0 error / 0 warning |
| 3 | test | ✅ 47 tests / 7 files（1B 33 → 1C 47） |
| 4 | build | ✅ |
| 5 | visual + 行為 | ✅ 截圖 24 張、e2e 18/18 |

### 八個 Primitive

```text
Navbar（含 Mobile Nav）      components/shared/navbar.tsx        client
Hero                         components/landing/hero.tsx         server
EditorialSection             components/shared/editorial-section server
PortfolioLayout              components/portfolio/               server
TemplateExperienceShell      components/website-preview/         client
AgentWorkspaceShell          components/agent/                   client
PricingLadder                components/pricing/                 server
DarkCtaBlock                 components/shared/                  server
```

### 出口條件核對

| 出口條件 | 結果 |
|---|---|
| `/_dev/primitives` 可逐一檢視八個 primitive | ✅ |
| 兩個 Shell 的 TS 介面已定，site scope container 已存在 | ✅ |
| Mobile Nav 可實際開闔並支援鍵盤操作 | ✅ |

### Mobile Nav 以原生 `<dialog>` 實作

V3 Demo 在 900px 以下直接 `display:none` 且無替代（Spec §45.1）。
此處選原生 `<dialog>` + `showModal()`，而非自行拼裝面板：
focus trap、Escape 關閉、背景 inert 全是瀏覽器原生行為。
手刻這三件事很容易做得半殘，而無障礙半殘等同沒做。

e2e 實測：開闔、`aria-expanded` 同步、Escape 關閉、鍵盤開啟、焦點不逸出背景。

### 「禁止假互動」已成為會 fail 的測試

```text
TemplateExperienceShell  所有切換控制項 disabled
                         site scope 容器存在且無 inline style
                         e2e：force click 後 [data-site-scope] 的 style 仍為 null
AgentWorkspaceShell      輸入框與送出按鈕 disabled
                         等待 400ms 後訊息數量不變（不用 setTimeout 假裝 AI 回覆）
```

### ⚠️ 截圖抓到的中文排版問題

單元測試與 e2e 全綠，但截圖顯示標題斷行是壞的：

```text
修正前   從第一頁，開 / 始你的生意。        ← 拆開「開始」
        你不需要先知道怎 / 麼做。          ← 拆開「怎麼」
        會用 / AI，跟能 / 用 AI 做 / 出產品，/ 是兩回 / 事。
```

三個獨立原因：

1. **`ch` 單位不適用於中文。** `ch` 以拉丁數字「0」的字寬校準，中文字約為其兩倍寬。
   `max-w-[24ch]` 實測只放得下 5–6 個中文字。改用 `em`（1em ≈ 1 個中文字）。

2. **`text-wrap: balance` 會主動製造壞斷點。** 它為了讓各行等長而挑斷點，
   而瀏覽器不知道中文詞界，結果是把詞硬拆。改用 `pretty`。

3. **`word-break: auto-phrase` 對中文沒有實際效果。** Chromium 的詞組斷行
   分詞資料以日文為主。保留（無害、對日文有效）但不能倚賴它。

處置：Hero 與 Final CTA 這兩句最關鍵的大字改以 `titleLines` 逐行指定，
不把全站最重要的一行交給瀏覽器猜。

> 這一輪修正中我第一次只改了 Hero 的 `ch`，卻把 EditorialSection 的
> `max-w-[24ch]` 留著——同一個 bug 修一半，第二輪截圖才發現。

### PortfolioLayout 網格空洞

featured 佔 2 欄 2 列、其餘各佔 1 欄，導致第二列右半永遠是空的。
改為其餘各佔 2 欄，兩張剛好填滿 featured 右側。

### 刻意的型別設計

`PortfolioCard.cover` 為 `{ url: string; alt: string }`，**alt 必填**。
V3 Demo 的作品區全用 CSS 漸層背景，因此完全沒有替代文字（Spec §45.1）。
這樣「有圖但沒有 alt」在編譯期就不可能成立。

未提供 cover 時渲染純色佔位塊（`aria-hidden`），不會產生無替代文字的圖片。

### 依「相對位置」補上的 config

| 檔案 | 為何在 1C |
|---|---|
| `config/pricing.ts` | PricingLadder 是第一個消費者 |
| `config/home-copy.ts` | Hero / DarkCtaBlock 需要 Spec §5、§30 的指定文案 |
| `features/website-engine/types.ts` | TemplateExperienceShell 的 props 需要 SiteConfig 型別 |

`features/website-engine` 只有型別，**沒有任何 Engine 實作**——那是 Phase 3。

---

## 1D — Homepage Composition

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 結果 |
|---|---|---|
| 1 | typecheck | ✅ |
| 2 | lint | ✅ |
| 3 | test | ✅ 47 tests / 7 files |
| 4 | build | ✅ |
| 5 | visual + 行為 | ✅ 截圖 24 張、e2e 26/26 |

### IA 順序（Spec §4，e2e 驗證，不得調換）

```text
Navbar → Hero → Goal Selector → Selected Work → Template Experience
→ AI Website Advisor → AI Philosophy → Services → Pricing → Process
→ Final CTA → Footer
```

### 四處同步（Plan §6.1 的核心承諾）

選定 goal 後，e2e 逐項驗證四處確實反應：

```text
1. Selected Work        依 workCategories 篩選
2. Template Experience  顯示對應模板分類
3. Services             highlight 對應產品線（aria-current）
4. Agent CTA            initialIntent 帶入
＋ URL 同步
```

**Agent 與 Template 兩區原本吃 server 端的 goal，切換時不會更新——
同步會少兩處。**改以讀 context 的 client 包裝（`AdvisorSection`、
`TemplateExperienceSection`），Shell 本身維持純殼、不認識 Home Context。

### Portfolio 資料層

```text
repository.ts            介面 + filterByGoal（server / client 共用同一支）
in-memory-repository.ts  Phase 1 假資料，Phase 2 換實作、元件不動
```

篩選規則只有一份實作：server 與 client 共用 `filterByGoal`，避免兩邊分岔。

篩選後無結果時回傳空陣列並顯示誠實說明，**不偷偷退回全部**——
那會讓使用者以為篩選有作用，實際上沒有。

### 移除 GoalDebugPanel

1B 的臨時驗證裝置。真正的 Goal Selector 出現後它就是死碼，一併刪除，
並把 `goal-url.spec.ts` 改為透過真實 UI（`aria-pressed`）驗證——
測試應該打在使用者實際會碰到的東西上。


---

## 1E — Responsive + A11y Baseline

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 結果 |
|---|---|---|
| 1 | typecheck | ✅ |
| 2 | lint | ✅ |
| 3 | test | ✅ 47 tests / 7 files |
| 4 | build | ✅ |
| 5 | visual + 行為 | ✅ 截圖 24 張、e2e 40/40（含 a11y 14 條） |

### ⚠️ axe 抓到三個對比違規——全部在 token 層

這是 Design Token 系統第一次真正發揮作用：問題不在元件，改一處全站修好。

```text
違規（WCAG AA 要求 4.5:1）
  --color-brand-muted #726d66 on bg   4.48   差 0.02
  白字 on --color-brand-accent        3.88
  --color-brand-accent 當文字 on bg   3.39
```

處置：

| Token | 前 | 後 | 理由 |
|---|---|---|---|
| `--color-brand-muted` | `#726d66` | `#6a655e` | 調深至 5.0:1，色相與暖調不變 |
| `--color-brand-accent` | `#ef3e2f` | 不變 | 保留品牌 Rocket Red，但**限裝飾用，不得承載文字** |
| `--color-brand-accent-strong` | — | `#c42a1b` | 新增。對底 4.97:1、配白字 5.69:1 |

替換規則精準鎖定「承載文字的紅」：`text-brand-accent`（全部是文字）
與 `bg-brand-accent text-brand-on-accent`（紅底白字）。
裝飾用的紅點、色票、間距示意條完全不動。

> Rocket Red 是品牌色，但它承載不了文字。把 accent 拆成「裝飾級」與
> 「文字級」是標準解法——品牌識別保留，可讀性不打折。

### Responsive（Spec §34）

八個斷點各自跑 axe 掃描 + 橫向捲動檢查，全數通過：

```text
375  390  430  768  1024  1280  1440  1920
```

### A11y 驗證項目

```text
axe critical / serious            0（首頁、已篩選、空狀態、行動選單開啟四種情境）
八斷點 axe                        全數 0
橫向捲動                          全數 0
鍵盤走訪                          每個焦點元素都有 3px 可見 outline
prefers-reduced-motion            transition-duration 實測 1e-05s
行動選單 focus trap               焦點不逸出至背景可互動元素
```

判準取 critical / serious 為零，不把 moderate / minor 當硬性門檻——
那層常含情境相關建議，拿來當 Gate 會讓人為了過關寫出奇怪的標記。

### Performance（Spec §33，production build）

```text
LCP   356 ms    目標 < 2500   ✅
CLS   0.0000    目標 < 0.1    ✅
字型  382.8 KB / 9 個分片
```

> ⚠️ 這是 localhost 量測，**沒有網路延遲，數字偏樂觀**。
> 結構面的結論才是重點：首屏無阻塞資源、零版面位移。
> 正式部署後（Phase 8）須以真實網路環境重測。

字型從 1A 的 211.1 KB / 5 分片上升到 382.8 KB / 9 分片——
如 1A 紀錄所預告，隨頁面中文字數增加。`preload: false` + `display: swap`
使其不阻塞首屏，LCP 356ms 證實了這點。

指令：`node scripts/measure-vitals.mjs <url>`

### 兩個測試自身的 bug

| 問題 | 實情 |
|---|---|
| reduced-motion 斷言用正規式比對 `"0.0001s"` | 瀏覽器以指數記法回報極小值（`1e-05s`），改為轉數值比較 |
| 鍵盤走訪測試在 `page.evaluate` 內引用 Node 端變數 `i` | 瀏覽器端 ReferenceError，改為在 Node 端累積 |

另外 `<nextjs-portal>`（Next 開發工具浮層）也在 tab 順序中且無 focus 樣式。
它不是產品內容、production build 不存在，故於測試中排除——
而不是為了讓測試過關去關掉開發工具。

---

## 2A — Portfolio Schema + RLS

**日期：** 2026-08-10（初版）／2026-08-10（對 Zeabur 資料庫驗證完成）  
**結果：** ✅ **全數通過**

一度標記為未通過：當時 Docker daemon 未啟動、Zeabur Supabase 尚未就緒，
RLS policy 寫完但沒對任何真實資料庫執行過。現已補齊。

### Gate

| # | 項目 | 結果 |
|---|---|---|
| 1–4 | typecheck / lint / test / build | ✅ 73 tests / 10 files |
| 5 | `pnpm test:db` | ✅ 10/10（對 Zeabur 實例） |

### 出口條件核對

| 出口條件 | 驗證方式 | 結果 |
|---|---|---|
| migration 可重複套用 | 第二次執行全部跳過 | ✅ |
| 匿名只能讀 published | `pnpm test:db` + 獨立 curl | ✅ |
| 寫入需 admin | 匿名 POST → HTTP 401 | ✅ |
| 型別由 schema 產生 | `pnpm db:types` introspect | ✅ |

### 自架 Supabase 的實際情況

Zeabur 版沒有對外開放的 Postgres 連線埠，`supabase link` 也只對 Supabase Cloud
有效，因此 CLI 的 `db push` 與 `gen types` 都用不了。可用的是 Kong 後方的
pg-meta：`POST {SUPABASE_URL}/pg/query`（需同時帶 `apikey` 與 `Bearer`，
兩者皆為 service role key）。

據此自建兩支工具：

```text
scripts/db-push.mjs    套用 migration，已套用者記錄於 public._migrations
                       → 「migration 可重複套用」的實作
scripts/db-types.mjs   introspect information_schema 產生 src/types/database.ts
```

### ⚠️ 對 `/pg/query` 端點做了授權探測

這個端點可執行任意 SQL 且公開可達，因此先確認它的授權姿態：

```text
無驗證           → 401
anon key         → 403   ✅ 一般使用者拿不到
偽造 Bearer      → 401
service role key → 200   （且必須同時帶 apikey 標頭）
```

姿態正確。但這也再次確認：**service role key 等同資料庫管理員**，
絕不可出現在瀏覽器端、不可加 `NEXT_PUBLIC_` 前綴。
`.env.local` 已確認被 `.gitignore` 忽略且未被 git 追蹤。

### 獨立驗證（不經過我們的任何程式碼）

`pnpm test:db` 用的是 supabase-js。另以 curl 直接打 REST API 再驗一次，
模擬「有人拿到 anon key 自己打 API」：

```text
列出全部作品     → 只回 3 筆 published，草稿不在其中
指名查詢草稿     → []（RLS 以「查得到零筆」表現，不洩漏該筆存在）
嘗試 POST 新增   → HTTP 401
讀取 admin 名單  → []
```

### 新增：資料庫 enum 與應用層型別的一致性守衛

`src/features/portfolio/type-parity.test.ts`

資料庫的 `portfolio_project_type` 與應用層手寫的 `PortfolioProjectType`
若分歧，症狀很難查：資料庫多了一個類型，程式端不會有編譯錯誤，
只會在 UI 顯示 undefined 標籤，或該類型的作品被靜默略過。
現在分歧會直接讓測試失敗。

---

## 2B — `/work` 列表 + Filter

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 結果 |
|---|---|---|
| 1 | typecheck | ✅ |
| 2 | lint | ✅ 0 error / 0 warning |
| 3 | test | ✅ 58 tests / 8 files（1E 47 → 2B 58） |
| 4 | build | ✅ |
| 5 | visual + 行為 | ✅ 截圖 32 張、e2e 58/58 |

### 出口條件核對

| 出口條件 | 結果 |
|---|---|
| 篩選狀態進 URL | ✅ 沿用 Home Goal 的模式，含上一頁 |
| 八斷點無橫向捲動 | ✅ e2e 逐一驗證 |
| axe 0 critical/serious | ✅ 八斷點全數 |
| 空結果誠實說明不退回全部 | ✅ |

### 對 in-memory repository 開發是刻意的

Supabase 延後後，`/work` 仍可完整開發——這是 1D 立下
`PortfolioRepository` 介面的回報。2D 只換實作，`src/app/work/page.tsx`
一行都不用改。

而且順序反而更好：**由 UI 定義 repository 真正需要提供什麼**
（本段新增 `listPublished(filter)`），再一次對真實資料庫實作，
比先猜介面再回頭改省事。

### PortfolioLayout 加上 variant

截圖發現列表頁版面有洞：`PortfolioLayout` 原本永遠把第一件放大成 2×2，
那在首頁 3 件時是刻意的主視覺，但 6 件的列表頁會讓最後一列空一半。

```text
featured  首頁用。第一件放大，適合 3 件左右
uniform   /work 用。等權重網格，md 兩欄 / xl 三欄
```

「第一件比較重要」在列表語境下本來就不成立。
順帶把網格跨距從卡片本身移到外層 `<li>`，卡片只管高度。

### 篩選器的兩個細節

**結果數以 `aria-live="polite"` 播報。** 篩選後畫面變了但焦點還在 chip 上，
螢幕閱讀器使用者沒有任何線索知道發生了什麼。

**「Client Project」選項保留。** 目前沒有任何客戶案作品，
所以這個篩選必定零結果——但它是誠實的可選條件，不是宣稱我們有客戶案例，
且 2D 接上真實資料後就會有意義。空狀態已處理。

### 測試自身的 bug

「假資料中不出現 Client Project」原本掃全頁，抓到的是**篩選器選項**而非作品卡。
改為只掃 `<article>`。

---

## 2C — `/work/[slug]` + SEO

**日期：** 2026-08-10  
**結果：** ✅ 全數通過

### Gate 五項

| # | 項目 | 結果 |
|---|---|---|
| 1 | typecheck | ✅ |
| 2 | lint | ✅ 0 error / 0 warning |
| 3 | test | ✅ 70 tests / 9 files（2B 58 → 2C 70） |
| 4 | build | ✅ |
| 5 | visual + 行為 | ✅ 截圖 40 張、e2e 79/79 |

### 出口條件核對

| 出口條件 | 結果 |
|---|---|
| 每件作品有獨立 title/description/OG/canonical | ✅ e2e 逐一驗證，並確認換作品時 metadata 會跟著換 |
| 來源類型標示明確 | ✅ 放在 Hero 而非埋在頁尾 |
| Related Projects 與 CTA 就位 | ✅ 不含自己、同分類優先 |
| 未發布作品回 404 | ✅ 找不到與未發布走同一條路徑 |

### 「不顯示空 Section」是設計出來的，不是靠自律

Spec §8.10：「如果沒有完整 Case Study 資料，只顯示存在的區塊。」

種子資料刻意做成詳盡程度不一：

```text
interior-studio      完整五段 Case Study + 連結 + AI 揭露
yipage-identity      只有 problem / solution
ai-website-workshop  完全沒有 Case Study
```

全部填滿的種子驗證不了這條規則——就像 2A 的 seed 必須放一筆 draft
才驗得了「草稿讀不到」。e2e 逐一驗證三種詳盡程度，
且確認**標題本身也不出現**，而不是留一個標題配空白。

### 未發布與不存在回同一種回應

`getBySlug` 找不到與未發布一律回 `null`，頁面一律 404。
若兩者回應不同，就能從差異推出「有一筆你看不到的草稿存在」。

### ⚠️ 順手抓到兩個死連結

ESLint 提示內部導航應使用 `next/link` 時，順著檢查發現：

```text
Hero 主 CTA      → #try      首頁根本沒有 #try（實際區塊是 #advisor）
Final CTA        → #contact  在 /work 與詳細頁上不存在該錨點
Navbar 品牌 logo → #top      同樣只存在於首頁
```

三個都沒有任何既有測試抓到。錨點連結特別容易腐爛：
改了 section id 不會有東西壞掉，直到有人真的點下去才發現什麼都沒發生。

處置：
1. 站內連結全面改用 `next/link`（`<a>` 會觸發整頁重新載入，
   在有多個頁面之後是實際可感知的退步，不只是 lint 規則）
2. 錨點一律寫成 `/#section` 而非 `#section`，讓同一個元件出現在任何頁面都有效
3. **新增 `tests/e2e/no-dead-links.spec.ts`**：掃三個路由的所有站內連結，
   錨點檢查目標元素是否存在，路由檢查 HTTP 狀態

### 測試工具的兩個絆腳石

| 問題 | 實情 |
|---|---|
| `CSS.escape` 在 Playwright 測試中 undefined | 那是瀏覽器 API，Node 端沒有。改用 `[id="..."]` 屬性選擇器 |
| 首頁 CTA 斷言失敗 | 斷言寫死 `#work`，而 href 已改為 `/#work`。意圖（導向作品）不變，更新斷言 |

### Sitemap 改為資料驅動

作品詳細頁由 repository 供應而非手抄，2D 換 Supabase 後自動反映真實資料，
且只列出已發布作品。採白名單（明列要收錄的）而非黑名單（排除 `/_dev`）——
白名單不容易漏。

---

## 2D — Repository 換 Supabase 實作

**日期：** 2026-08-11  
**結果：** ✅ 全數通過

### Gate

| # | 項目 | 結果 |
|---|---|---|
| 1–4 | typecheck / lint / test / build | ✅ 73 unit tests |
| 5 | e2e + 截圖 | ✅ 79/79、40 張 |
| ＋ | `pnpm test:db` | ✅ 29/29（RLS 10 + repository 整合 19） |

### 出口條件：畫面無變化

**首頁、`/work`、`/work/[slug]` 三個頁面一行都沒改**，只換了 `getPortfolioRepository()`
回傳的實作。原本針對 in-memory 資料寫的 79 條 e2e 全數通過，
而 e2e 跑的是連著真實資料庫的 dev server。

這是 1D 立下 `PortfolioRepository` 介面的完整回報。

### schema 缺口在接線時才浮現

2B/2C 把 UI 做出來後才發現 2A 的 schema 少了兩個欄位：

```text
kicker    標題上方小標。summary 是段落敘述，兩者用途不同不能互相取代
services  Spec §8.4 明列，§8.13 的「Service Detail 自動顯示 Related Work」靠它
```

補了 migration 0003。這正是「先由 UI 定義 repository 需要什麼，
再對真實資料庫實作」這個順序的用處——缺口在接線時浮現，
而不是等 Admin 介面做完才發現存不了。

`services` 用 `text[]` 而非 join table：服務是 config 中的固定四條產品線，
不是使用者可新增的實體，Spec §39 的表列也沒有這張 join table。

### 產生式型別當場擋下不一致

migration 0003 之後沒重新產生型別，`tsc` 立刻報
「`kicker` 不在 `PortfolioProjectsRow` 上」。`pnpm db:types` 一跑就修好。

若型別是手抄的，這個不一致會安靜地存在到執行期。

### 三個刻意的實作選擇

**一律使用 anon client。** 未發布作品讀不到不是因為查詢加了
`status = published`，而是因為 RLS 不給。因此即使查詢寫錯，草稿也不會外流。
公開路徑絕不改用 service role key——那會讓 RLS 完全失效，而症狀是靜默的。

**分類篩選在記憶體完成。** PostgREST 對巢狀關聯下條件需要 inner join 語法，
而那會讓回傳的關聯只剩符合條件的分類，卡片上就會少顯示分類。
此規模下不值得為了少一次過濾而犧牲顯示正確性。

**缺少設定時分環境處理。**

```text
development  退回 in-memory 並在主控台警告（沒憑證的人 clone 下來仍能看畫面）
production   直接拋錯
```

在 production 靜默退回種子資料是最糟的失敗模式：網站看起來完全正常，
只是展示的全是不存在的作品。寧可整頁掛掉，也不要對訪客說謊。

### Gallery 排除封面

資料庫種子給 interior-studio 加了一張 cover 之後，詳細頁的 Gallery 冒出來了——
但那只是把列表卡片的同一張圖再看一次。改為 Gallery 排除 `role = 'cover'`，
語意才正確：封面給卡片用，圖廊放其他媒體。

### 尚未接上的部分

`PortfolioCard.cover` 刻意不映射。資料庫裡的封面目前指向尚未存在的檔案，
真實媒體要等 2F 接上 R2。在那之前一律用佔位色塊——寧可顯示色塊，
也不要在頁面上放一張破圖。

佔位色調改由 slug 雜湊決定（原本手挑），因此分布不如手挑均勻。
這是 2F 之前的過渡呈現，不值得為此增加 schema 欄位。
