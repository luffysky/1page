# Phase 2–8 分段計畫

**Source of Truth:** `docs/1page-v1-spec.md`（V1.1, FROZEN）  
**Phase 1 詳細計畫：** `docs/phase-1-implementation-plan.md`（已完成）

---

## 0. 本文件的層級

這份文件只定**每個 Phase 切成哪幾段、各段的目標與出口條件**。

各段的實作細節（檔案配置、型別設計、測試清單）在**該 Phase 開工前**
另寫詳細計畫，格式比照 Phase 1——因為切法要看前一個 Phase 實際長出什麼，
憑現在的想像去規劃 Phase 5 的 Agent，八成會規劃錯。

Gate 規則不變，每段結束跑：

```text
typecheck → lint → test → build → visual / 行為 review
```

---

## 總覽

```text
Phase 2  Portfolio          6 段   2A–2F
Phase 3  Website Engine     4 段   3A–3D
Phase 4  Templates          4 段   4A–4D
Phase 5  Agent              5 段   5A–5E
Phase 6  Agent Web Tools    4 段   6A–6D
Phase 7  Workshop / Builder 3 段   7A–7C
Phase 8  QA / Deploy        5 段   8A–8E
                          ─────
                           31 段
```

---

# Phase 2 — Portfolio

Spec §8、§39、§41。

## ⚠️ 2026-08-10 重排：Supabase 相關段落延後

Supabase 專案改由 Zeabur 自架，尚未就緒。原順序（Schema → Admin → Upload →
List/Detail）會整個卡住，故重排為「先做不依賴資料庫的公開介面」。

這不是將就。1D 立下 `PortfolioRepository` 介面就是為了讓資料源可替換；
先由 UI 定義出 repository 真正需要提供什麼，再一次對真實資料庫實作，
比先猜介面再回頭改更省事。

```text
2A  Schema + RLS          ✅ 已寫  ⏸ 待資料庫驗證（Gate 未通過）
2B  /work 列表 + Filter    ← 可做（對 in-memory）
2C  /work/[slug] + SEO     ← 可做（對 in-memory）
2D  Repository 換 Supabase  ⏸ 待資料庫
2E  Admin 權限 + CRUD       ⏸ 待資料庫
2F  Media Upload            ⏸ 待 Storage
```

### 自架 Supabase 的注意事項

Zeabur 上的 Supabase 是自架版，與 Supabase Cloud 有幾點不同，
2D 開工時需留意：

```text
supabase link            針對 Supabase Cloud API，自架通常不適用
migration 套用           改用 supabase db push --db-url <postgres-url> 或 psql
型別產生                 supabase gen types typescript --db-url <url>
Auth                     自架版需自行確認已啟用並設定
Storage                  不使用（改用 Cloudflare R2，見 CR-001）
```

---

### 2A — Schema + RLS ⏸

建立 `portfolio_projects` / `portfolio_media` / `portfolio_categories` /
`portfolio_tags` 與兩張 join table（Spec §39），migration 與 RLS policy。

**已完成：** migration、seed（含一筆 draft）、`tests/db/rls.test.ts`。

**Gate 未通過。** RLS 未對真實資料庫執行過。
安全邊界沒驗證過就是沒驗證過，不因為程式碼寫完就算數。

**出口：** migration 可重複套用；匿名只能讀 `published`；寫入需 admin；
`pnpm test:db` 全綠；型別由 schema 產生而非手抄。

### 2B — `/work` 列表 + Filter

分類篩選、Project Type 篩選（Spec §8.7）。
桌機水平 filter，行動橫向 scroll chips。對 in-memory repository 開發。

**出口：** 篩選狀態進 URL（沿用 Home Goal 的 URL-as-source-of-truth 模式）；
八斷點無橫向捲動；axe 0 critical/serious；空結果有誠實說明不偷偷退回全部。

### 2C — `/work/[slug]` + SEO

Case Study 版式（Spec §8.10）。**缺資料的區塊不顯示空 Section**。
獨立 metadata（Spec §32）。

**出口：** 每件作品有獨立 title/description/OG/canonical；
來源類型標示明確；Related Projects 與 CTA 就位；未發布作品回 404。

### 2D — Repository 換 Supabase 實作 ⏸

以 Supabase 實作取代 `in-memory-repository`。**元件與型別不動**。

**出口：** `/work`、`/work/[slug]` 與首頁改吃真實資料且畫面無變化；
in-memory 版保留作測試替身。

### 2E — Admin 權限 + CRUD ⏸

`/admin/portfolio` route guard、建立／編輯／發布／下架／封存／排序／精選。

**出口：** 非 admin 一律 404 或導離；權限在 server 端與 RLS 雙重把關，
**不得只靠前端隱藏按鈕**（Spec §41）。

### 2F — Media Upload（Cloudflare R2）⏸

**CR-001：** 物件儲存改用 Cloudflare R2，Spec 已升 V1.2。

MIME allowlist、大小限制、副檔名驗證、檔名 sanitize、唯一路徑、
上傳進度、失敗重試、拖曳排序（Spec §8.9、§36）。

⚠️ **R2 沒有 RLS。** 資料庫那側的 policy 保護不到物件儲存，
上傳授權只剩自家 server route 把關。

**出口：** presigned URL 由 server 簽發且簽發前驗證 admin；
前端不持有 access key；bucket 不可公開列舉；
SVG 經 sanitize 或停用 inline 渲染；
路徑為 `portfolio/{projectId}/{uuid}.{ext}`。

---

# Phase 3 — Website Engine

Spec §9–§11、§14。核心約束：**Agent 不生成程式碼，只操作結構化 SiteConfig。**

### 3A — SiteConfig Schema + 驗證

以 Zod 定義 SiteConfig / SiteSection / ThemeConfig，型別以 1C 已建的
`features/website-engine/types.ts` 為基礎。

**出口：** 所有 SiteConfig 進出都經 schema 驗證；非法 config 有明確錯誤而非崩潰。

### 3B — Theme Engine（`--site-*` scoped 注入）

把 ThemeConfig 轉成 `--site-*` CSS 變數，注入 1C 已備妥的
`[data-site-scope]` 容器。

**出口：** `--site-*` **絕不出現在 `:root`**；切換主題不影響官網品牌色；
既有的 token 契約測試擴充為涵蓋此規則。

### 3C — Section Registry + Section 元件

`hero` / `about` / `services` / `gallery` / `cta` / `contact` 等，每種支援 variants。

**出口：** 未知 section type 或 variant 不使整頁崩潰，降級為可辨識的佔位。

### 3D — SiteRenderer

唯一正式 rendering 入口（Spec §11）。

**出口：** Preview 與正式 Template Website 共用同一個 renderer；
禁止 arbitrary HTML / JS 注入（Spec §36）。

---

# Phase 4 — Templates + Preview

Spec §12、§13、§15、§8.15。

### 4A — Template Registry + 3 套 Template

Studio / Local Business / Personal（Spec §13 建議先做這三套）。

**出口：** Template = Layout + Section Composition + Variants + Theme +
Default Content，全部資料化，不是硬寫的頁面。

### 4B — Template Experience 實裝

取代 1C 的殼。接上 Home Goal 的 `templateCategories` 篩選。

**出口：** 1C 立下的「禁止假互動」測試改為驗證**真的會動**；
所有切換皆為 SiteConfig mutation，零 DOM style 操作。

### 4C — 裝置切換 + Theme / Accent 切換

Desktop / Tablet / Mobile（Spec §15）。

**出口：** 訪客可免費修改 Brand Name / Industry / Theme / Accent；
每次操作都更新 SiteConfig。

### 4D — SiteConfig 傳遞

Template Experience → Agent、→ Project Builder，**無損傳遞**（Spec §8.15）。

**出口：** 訪客累積的設定不會在跳轉時消失，不需要重選一次。

---

# Phase 5 — Agent

Spec §16–§18、§20、§37。免費 Advisor。

### 5A — Agent API + streaming

`/api/agent`，串流回應，對話預算與長度限制。

**出口：** 逾時、中斷、超額都有明確行為，不是無聲失敗。

### 5B — Intent Router + Scope Policy

Spec §17 的 12 種 intent 與 IN_SCOPE / ADJACENT / CASUAL / UNCLEAR /
OUT_OF_SCOPE 處置。

**出口：** UNCLEAR **禁止直接拒絕**，先確認意圖；OUT_OF_SCOPE 不完成完整工作。

### 5C — 知識工具

`search_services` / `search_faq` / `search_portfolio` /
`recommend_portfolio` / `recommend_template`（Spec §20 白名單）。

**出口：** 只有 Demo 時必須明說「目前有相關 Concept / Demo」，
**不可說成客戶案例**（Spec §8.12）——這條要有測試。

### 5D — 需求蒐集 + Lead

Spec §19 Lead schema、`collect_requirement`、`estimate_price_range`。

**出口：** Lead 可持久化；價格只給區間，**不自動正式報價**（Spec §40）。

### 5E — Agent UI 實裝 + 匿名限制

取代 1C 的殼。rate limit、訊息／session 上限、prompt injection 處置（Spec §36、§37）。

**出口：** 對話區可鍵盤操作、訊息對輔助技術可讀（Spec §35）；
字體為黑體不是宋體。

---

# Phase 6 — Agent Website Tools

Spec §21、§22。

### 6A — Tool Registry + schema validation

所有 tool input 必須 schema validate（Spec §22）。

**出口：** 白名單之外的工具不可呼叫；禁止 shell / code execution /
raw query / arbitrary web search（Spec §20）。

### 6B — Agent 操作 SiteConfig

`set_brand` / `set_theme` / `set_template`。

**出口：** 「我想要高級甜點店，但不要太黑」能正確轉成 tool call 並更新 Preview。

### 6C — Section 操作

`add_section` / `remove_section` / `reorder_sections` /
`update_section_content` / `set_section_variant` / `generate_copy` / `reset_preview`。

**出口：** 每個操作都可逆或可重設；失敗的 tool call 不留下半毀的 SiteConfig。

### 6D — Lead 落地 + Human Handoff

`create_lead_summary` / `request_human_handoff`。

**出口：** Agent **不得自動簽約**（Spec §40）；交接有明確人工接手點。

---

# Phase 7 — Workshop / Builder / Analytics

Spec §23–§25、§30、§31。

### 7A — Workshop Gate

免費／付費邊界（Spec §23）。V1 **不串金流**（Spec §25）：
Unlock → Pricing Modal → 說明交付物 → CTA / Lead。

**出口：** 邊界清楚——聊天免費，開始產生成果時收費，不按訊息數計價。

### 7B — Project Builder

Spec §30。自動帶入 Agent Lead Context / Selected Template /
Portfolio Reference / Theme / SiteConfig。

**出口：** 從 Agent、Template、Portfolio 任一入口進入都不需重填。

### 7C — Analytics 接入

Spec §31 全部事件。Phase 1 已備妥 `lib/analytics/track.ts` 的呼叫點。

**出口：** 換的是傳輸層，不是散落各處的呼叫；`/_dev/*` 不上報。

---

# Phase 8 — QA / Deploy

Spec §32–§36。

### 8A — SEO

title / description / OG / canonical / sitemap / robots / structured data。

**出口：** Portfolio detail 有獨立 metadata（Spec §32）。

### 8B — Security 稽核

Agent（白名單、Zod、rate limit、injection）、Preview（禁 arbitrary HTML/JS、
URL 驗證）、Upload（MIME、大小、SVG、檔名、Storage policy、admin-only）。

**出口：** Spec §36 三區逐條核對，有紀錄。

### 8C — Performance 真實網路重測

Phase 1 的 LCP 356ms 是 localhost 數字，偏樂觀。

**出口：** 真實部署環境下 LCP < 2.5s、CLS < 0.1、INP < 200ms；
中文字型傳輸量在真實網路下重新評估。

### 8D — 全站 A11y 稽核

**出口：** 全部路由 axe 0 critical/serious；鍵盤可完成所有主要流程。

### 8E — Production Deploy

**出口：** Spec §42 Definition of Done 逐項核對完成。
