# 待辦狀態校正 0811

> 這份是 2026-08-11 收工時**對照實際程式與實測結果**校正過的權威狀態。
> Phase 進度以 `docs/gate-log.md` 的 Gate 紀錄為準，那份是逐段的驗收證據。
> 規格仍以 `docs/1page-v1-spec.md`（V1.2，FROZEN）為唯一來源。

---

## ✅ 已完成（都已 commit/push 上 main，且各段 Gate 通過）

### Phase 1 — Scaffold → 首頁（1A–1E）
Design Token 系統（八類）、Home Goal Context（URL 驅動）、八個 Layout Primitive、
首頁依 Spec §4 IA 組裝、八斷點 RWD + a11y 基線。
LCP 356ms / CLS 0（localhost，Phase 8 需以真實網路重測）。

### Phase 2 — Portfolio（2A–2F）
Schema + RLS（對 Zeabur 實測）、`/work` 列表 + Filter、`/work/[slug]` + SEO、
Repository 換 Supabase、後台權限 + CRUD、R2 媒體上傳。

### Phase 3 — Website Engine（3A–3D）
SiteConfig Schema + 驗證、Theme Engine（`--site-*` scoped）、
Section Registry（9 元件）、SiteRenderer。

### 額外完成（不在原計畫）
- `pnpm gen:slug` 密路徑產生器（多格式、熵值提示）
- `pnpm audit:wiring` 接線稽核（七項）
- PWA（manifest + 動態圖示，刻意不做離線快取）
- ai_island_v3 的密路徑洩漏修正（**未 commit**，見下）

**測試總數：167 unit + 98 e2e + 45 db = 310。**

---

## 🔴 真正還沒做（純程式、沒被外部卡）

### 分類清單沒有接上資料庫
`portfolio_categories` 表已建立且已灌入 11 筆種子，但 `/work` 的篩選 UI
讀的是 `config/portfolio-categories.ts` 的硬編清單。

`config/portfolio-categories.ts` 的註解寫著「2D 換上真實資料庫後改由 DB 供應」——
那件事沒有發生。目前後果有限（兩份清單內容一致），但**沒有任何機制保證它們維持一致**：
在後台新增分類不會出現在篩選器上。

同理未接線的欄位（`audit:wiring` 第 3 項）：
`portfolio_categories.active`、`portfolio_tags` 的 join、`admin_users.note`、`created_at`。

### 後台頁面沒有納入 RWD 與 a11y 斷點檢查
`/`、`/work`、`/work/[slug]` 三條公開路由各跑 8 個斷點的 axe + 橫向捲動檢查。
後台（`/admin/*`、`/login`）沒有——後台也是人在用的。

### 作品詳細頁的 Case Study 無法從後台編輯
`case_study_json` / `links_json` / `ai_disclosure_json` 已在 schema 與公開頁完整支援，
但後台編輯表單只有基本欄位。目前只能改資料庫。

### Tag 與 Service 篩選
Spec §8.7 列出「另可依 Project Type / Industry / Tag / Service 篩選」。
目前只做了 Category + Project Type。

---

## ⏳ 被外部卡住 / 需 Luffy 操作

- **ai_island_v3 密路徑 `Ak83QDhUOVqx` 必須更換。** 它曾出現在公開的 robots.txt
  與每位訪客都會載入的根版面 JS chunk 中。改完程式碼救不回來——那串已經公開過。
  可用本專案的 `pnpm gen:slug` 產生新的。
- **ai_island_v3 的修改尚未 commit。** 那是另一個專案，提交與否由 Luffy 決定。
- **後台帳號密碼已更換**（原本 9 碼）。✅
- **Supabase 公開註冊已關閉**（`GOTRUE_DISABLE_SIGNUP=true`，實測 422）。✅
- **R2 已綁自訂網域** `1page-r2.snowrealm.pet`。✅
  ⚠️ 與站台同註冊網域。**目前無須任何調整**——瀏覽器預設發出的是 host-only
  cookie（不帶 `Domain` 屬性），只有 `1page.snowrealm.pet` 收得到，
  媒體網域看不見。已確認 `src/lib/supabase/` 與 `middleware.ts` 都沒有設 `domain`。

  真正要留意的是未來某一天：**若需要跨子網域共用登入狀態**
  （例如再開一個 `app.snowrealm.pet` 要共用 session），那時會有人加上
  `Domain=.snowrealm.pet`——那一加，R2 網域就同時收得到 auth cookie，
  SVG 不進白名單的決定必須重新評估，而且會變得更不能鬆綁。

---

## 📋 接下來的 Phase（依 `docs/phase-2-8-plan.md`）

```text
Phase 4  Templates + Preview     4 段   4A–4D   ← 下一步
Phase 5  Agent                   5 段   5A–5E
Phase 6  Agent Website Tools     4 段   6A–6D
Phase 7  Workshop / Builder      3 段   7A–7C
Phase 8  QA / Deploy             5 段   8A–8E
```

Phase 4 會把 1C 立的 `TemplateExperienceShell` 從殼變成真的：
「禁止假互動」那組測試屆時要改為驗證**真的會動**。

---

## 🔒 不得回頭破壞的約束

這些是各 Phase 立下、且有自動化測試守著的邊界。
新功能若與它們衝突，是新功能要調整，不是把測試改綠。

```text
tokens.css 是設計數值唯一來源      no-hardcoded-design-values（含具名例外清單）
--site-* 絕不出現在 :root          theme.test.ts + theme-scope.spec.ts
Demo/Concept 不得冒充客戶案例       portfolio-layout.test.ts + repository 測試
草稿在資料庫層就讀不到             rls.test.ts（繞過所有前端程式碼驗證）
presigned URL 鎖死 type/length/key r2-upload.test.ts（對真實 R2）
後台密路徑不進瀏覽器 bundle        admin-security.spec.ts
站內連結不得指向不存在的目標       no-dead-links.spec.ts
SiteConfig 是不可信輸入            schema.test.ts（44 條，多數在驗惡意輸入）
未知 section 不使整頁崩潰          site-renderer.test.ts
```

---

## 🧭 已知取捨（不是待辦，是刻意的決定）

- **presigned 上傳不檢查 magic bytes**：檔案不經過我們的伺服器，換來的是
  不必讓 100MB 影片流經 Node 行程。MIME × 副檔名雙重比對是替代方案。
- **SVG 不在上傳白名單**：需先接伺服器端 sanitizer。R2 已改自訂網域且與站台
  同註冊網域，此決定比先前更該維持。
- **首頁為動態渲染**：讀 `searchParams` 所致。Phase 2 無快取需求，
  Phase 8 效能重測時再評估。
- **分類篩選在記憶體完成**：PostgREST 巢狀條件需 inner join，
  那會讓回傳的關聯只剩符合條件的分類，卡片就少顯示分類。
- **PWA 不做離線快取**：內容會變動的行銷網站做離線快取，
  只會讓訪客看到過期的作品集。
