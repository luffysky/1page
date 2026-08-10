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

_未開始_
