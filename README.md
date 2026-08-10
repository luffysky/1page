# 一頁起家 / 1page

AI-assisted Digital Studio / Interactive Sales Platform

**Stack:** Next.js + TypeScript + Tailwind CSS + Framer Motion + Supabase

---

## 文件

| 文件                                                                         | 用途                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [`docs/1page-v1-spec.md`](docs/1page-v1-spec.md)                             | **V1.1 · FROZEN · Source of Truth**                 |
| [`docs/phase-1-implementation-plan.md`](docs/phase-1-implementation-plan.md) | Phase 1（1A–1E）實作計畫                            |
| [`docs/gptsay.md`](docs/gptsay.md)                                           | V1 → V1.1 的 review 討論紀錄                        |
| [`yipage_studio_v3_polished.html`](yipage_studio_v3_polished.html)           | V3 概念 Demo（僅供參考，**不得移植**，見 Spec §45） |

---

## 開發規則

Spec 已封版。實作期間不得為遷就實作方便而修改 Spec；
發現規格有誤時，記錄於 Implementation Plan §10「規格衝突」，人工裁決後才發 V1.2。

Phase 1 分為 1A–1E，每段結束必須通過 Gate 才進下一段：

```text
typecheck → lint → test → build → visual review
```

Gate 未過不得跳段。詳見 Implementation Plan §9。

---

## 現況

```text
Phase 0   規格與計畫              ✅ 完成
Phase 1A  Scaffold + Tokens       ✅ Gate 通過
Phase 1B  Home Goal Context       ✅ Gate 通過
Phase 1C  Layout Primitives       ✅ Gate 通過
Phase 1D  Homepage Composition    ✅ Gate 通過
Phase 1E  Responsive + A11y       ✅ Gate 通過

Phase 2A  Schema + RLS            ⏸ 待資料庫驗證
Phase 2B  /work 列表 + Filter      ✅ Gate 通過
Phase 2C  /work/[slug] + SEO       ✅ Gate 通過
Phase 2D  Repository 換 Supabase   ⏸ 待資料庫
```

Gate 紀錄見 [`docs/gate-log.md`](docs/gate-log.md)。

---

## 開發指令

```bash
pnpm dev          # 開發伺服器
pnpm gate         # typecheck → lint → test → build（Gate 前四項）
pnpm shots        # 產生八斷點截圖至 artifacts/（Gate 第 5 項）
pnpm e2e          # 瀏覽器行為測試（URL / 互動 / a11y）
pnpm a11y         # 只跑 axe 無障礙掃描

pnpm typecheck    # next typegen && tsc --noEmit
pnpm lint         # eslint + prettier --check
pnpm lint:fix     # 自動修正
pnpm test         # vitest
```

量測工具：

```bash
node scripts/measure-fonts.mjs <url>   # 首屏字型傳輸量
node scripts/verify-fonts.mjs  <url>   # 實際套用的字型（CDP）
```
