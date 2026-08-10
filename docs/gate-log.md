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

_未開始_
