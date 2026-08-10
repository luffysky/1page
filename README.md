# 一頁起家 / 1page

AI-assisted Digital Studio / Interactive Sales Platform

**Stack:** Next.js + TypeScript + Tailwind CSS + Framer Motion + Supabase

---

## 文件

| 文件 | 用途 |
|---|---|
| [`docs/1page-v1-spec.md`](docs/1page-v1-spec.md) | **V1.1 · FROZEN · Source of Truth** |
| [`docs/phase-1-implementation-plan.md`](docs/phase-1-implementation-plan.md) | Phase 1（1A–1E）實作計畫 |
| [`docs/gptsay.md`](docs/gptsay.md) | V1 → V1.1 的 review 討論紀錄 |
| [`yipage_studio_v3_polished.html`](yipage_studio_v3_polished.html) | V3 概念 Demo（僅供參考，**不得移植**，見 Spec §45） |

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
Phase 0  規格與計畫        ✅ 完成
Phase 1  Scaffold → 首頁    ⏳ 計畫待 Review
```

尚未建立 Next.js 專案。目前 repo 只有文件與概念 Demo。
