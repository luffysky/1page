# V1 Definition of Done（Spec §42）

Phase 8E 的核對表。**打勾的依據是可以重跑的東西**——測試、稽核腳本、
或畫面上看得到的路由。「我記得有做」不算。

驗證方式的代號：

```text
[gate]   pnpm gate（typecheck / lint / test / build）
[e2e]    pnpm e2e
[db]     pnpm test:db
[wire]   pnpm audit:wiring
[sec]    pnpm audit:security
[perf]   pnpm audit:perf
[eval]   pnpm agent:eval（會花錢，人工判讀）
[眼]     人工檢視
```

最後更新：2026-08-13（Phase 8 收尾）

---

## Website

| 項目 | 狀態 | 依據 |
|---|---|---|
| 正式 Brand UI | ✅ | [眼] `/_dev/tokens`、`/_dev/primitives` |
| Desktop / Mobile 完整 | ✅ | [e2e] 8 斷點 × 全部公開路由，無橫向捲動 |
| Hero | ✅ | [e2e] `homepage.spec.ts` IA 順序 |
| Goal Selector | ✅ | [e2e] 選 goal 後四處同步反應 |
| Services | ✅ | [e2e] highlight 隨 goal 變動 |
| Pricing | ✅ | [e2e] 完整六級（§26.1） |
| Process | ✅ | [e2e] IA 順序 |
| CTA | ✅ | [wire]【8】所有路由可達 |
| Project Builder | ✅ | [e2e] `project-builder.spec.ts` |

## Portfolio

| 項目 | 狀態 | 依據 |
|---|---|---|
| Portfolio List | ✅ | [e2e] `work-list.spec.ts` |
| Category Filter | ✅ | [e2e] 篩選狀態進 URL |
| Tags | ⚠️ | 資料有，**篩選 UI 未做**（見待辦） |
| Detail Page | ✅ | [e2e] `work-detail.spec.ts` |
| Featured Work on Homepage | ✅ | [e2e] `homepage.spec.ts` |
| Admin Create / Edit | ✅ | [e2e] `authed-breakpoints.spec.ts` |
| Media Upload | ✅ | [db] `media-pipeline.test.ts` |
| Mixed Media | ✅ | [db] MIME allowlist 含圖片／影片／PDF |
| Client / Demo / Internal labels | ✅ | [e2e] 每件作品都標示來源類型 |
| Service relation | ⚠️ | 資料模型有，**Service Detail 頁未做** |
| Agent search support | ✅ | [gate] `tools.test.ts` |

## Website Engine

| 項目 | 狀態 | 依據 |
|---|---|---|
| SiteConfig Schema | ✅ | [gate] `schema.test.ts` |
| Theme Engine | ✅ | [e2e] `theme-scope.spec.ts`（含字型與間距真的生效） |
| Section Registry | ✅ | [gate] `site-renderer.test.tsx` |
| SiteRenderer | ✅ | [gate] + [e2e] |
| ≥3 Templates | ✅ | 四套。[gate] 每個 template × theme × accent 組合都通過 schema |
| Desktop/Mobile Preview | ✅ | [e2e] 切裝置時版面**真的重排**（container query） |

## Agent

| 項目 | 狀態 | 依據 |
|---|---|---|
| Free Advisor UI | ✅ | [e2e] `agent-ui.spec.ts` |
| Streaming response | ✅ | [眼] 瀏覽器實測；[e2e] 停止鈕 |
| Intent classification | ✅ | [gate] `scope.test.ts`；[eval] 七條探針 |
| Scope policy | ✅ | 同上 |
| Requirement collection | ✅ | [gate] + [眼] 實測寫入資料庫 |
| Portfolio recommendation | ✅ | [gate] `tools.test.ts` |
| Template recommendation | ✅ | [gate] |
| Website operation | ✅ | [眼] §21 原句實測；[eval] §21 探針 |
| Lead capture | ✅ | [db] `leads.test.ts` |
| Human handoff | ✅ | [gate] 不自動簽約、不排時間 |

## 安全（Spec §36）

| 項目 | 狀態 | 依據 |
|---|---|---|
| Agent 三區 | ✅ | [sec] 0 失敗 |
| Preview 三區 | ✅ | [sec] |
| Upload 三區 | ✅ | [sec] |
| 後台密路徑 | ✅ | [e2e] `admin-security.spec.ts`；[wire]【5】 |
| RLS | ✅ | [db] 64 條，全部用真實身分而非 service role |

## 效能與可及性

| 項目 | 狀態 | 依據 |
|---|---|---|
| LCP < 2.5s | ⚠️ | [perf] 本機 production build 772ms。**真實環境未量** |
| CLS < 0.1 | ⚠️ | [perf] 本機 0.0000。**真實環境未量** |
| INP < 200ms | ⚠️ | [perf] 本機 16ms。這是實驗室下限，**真實 INP 要看 RUM** |
| 全站 axe 0 critical/serious | ✅ | [e2e] `a11y-all-routes.spec.ts` |
| 鍵盤可完成主要流程 | ✅ | [e2e] 首頁 → 調預覽 → 送出需求，全程鍵盤 |

---

## 還沒完成的（誠實清單）

這一節存在的理由：打勾的表格很容易讓人以為「全部做完了」。

### 需要 Luffy 操作才能完成

1. **8C 真實環境效能**——上面三個 ⚠️ 都是本機數字，偏樂觀。
   部署之後跑 `pnpm audit:perf --url https://1page.snowrealm.pet`。
2. **8E Production Deploy**——沒有部署環境就沒有「production」可以驗。
3. **SMTP → `GOTRUE_DISABLE_SIGNUP=false` → 確認 `AUTOCONFIRM` 不是 true**
   （順序不能反）。卡住整個 Phase M。
4. **`NEXT_PUBLIC_ANALYTICS_ENDPOINT`**——沒設就完全不上報。不是壞掉，是還沒接。
5. **FAQ 缺的題目**：工期、修改次數、付款方式、維護收費。
   我不知道的沒有寫進 `config/faq.ts`——編一條看起來合理的答案，
   等於替這間工作室承諾了沒人答應過的事。
6. **`.env.local` 的 `ADMIN_PASSWORD` 已過期**。
7. **ai_island_v3 的密路徑 `Ak83QDhUOVqx`**——那串公開過，改程式碼救不回來。

### 規格內、但這一輪沒做

- **Tag 篩選 UI**（資料模型有，畫面沒有）
- **Service Detail 頁**（`/service/[id]`，Spec §8.13 的 Related Work）
- **Phase M（會員系統）MB–ME**——卡在 SMTP
- **Workshop 的付費流程**——Spec §25 明說 V1 不串金流，
  所以「未做」是照規格，不是漏做

### 已知的限制

- **速率限制是單一實例的記憶體計數器**。多實例部署會各自放行一份額度。
- **`agent_sessions` / `agent_messages` 未建表**（Spec §38 有列）。
  對話目前不留存，重新整理就沒了。
