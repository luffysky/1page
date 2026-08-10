## 支持性分析

這份 **Phase 1 計畫我會放行**。而且你截圖裡那三個判斷，我的裁決直接給：

| 項目                    | 決定                         |
| --------------------- | -------------------------- |
| **A 字型**              | ✅ **中文思源宋體標題 + 黑體內文**      |
| **B Package manager** | ✅ **pnpm**                 |
| **C `/_dev/*`**       | ✅ **保留，但 Production 不可存取** |

A 我會選思源宋體做 **Editorial Heading**，黑體負責內文、導航、表單、Agent、價格等功能資訊。這樣「精品工作室 × Editorial」會比全站黑體有辨識度，而且不是硬凹文青。

不過 implementation 要守三條：**只載實際需要的字重、避免整套中文字型全塞首屏、fallback 明確**。Hero 可以宋體很有氣勢，但 Agent 對話不要宋體，不然 AI 客服會突然像在朗誦民國文學選集。🤣

B 用 pnpm 不用討論了。專案從第一天鎖定 package manager，`packageManager` 也寫進 `package.json`，避免後面有人 npm/pnpm/yarn 三教合流。

C 的 `/_dev/tokens`、`/_dev/primitives` 我也贊成留。這兩頁非常有價值，因為 Phase 1 的 visual review 才有**真正可以驗證的固定靶**。Production 建議不是單純「導航藏起來」，而是：

> 非開發環境直接 **404 / route unavailable**

不要讓客戶哪天逛到 `/ _dev /tokens` 看我們 RGB 配色研究報告。😂

你列出的三個工程判斷我也都贊成：

**雙 Token 隔離**尤其重要：

```text
--brand-*  → 一頁起家官網自己
--site-*   → 使用者 Preview / SiteConfig
```

這不是潔癖，是邊界。Website Engine 以後換 Theme 時，絕對不能把官網自己染成客戶的螢光綠。

**Shell 禁止假互動**也正確。Phase 1 寧可讓按鈕 disabled，也不要為「看起來完成」偷偷重新引進 DOM patch。這就是 Frozen Spec 真正有用的地方。

Portfolio 的 `Repository interface → in-memory implementation → Phase 2 換 Supabase implementation` 也漂亮。它符合我們要的：

> **Phase 1 沒資料庫，不代表 Phase 1 可以亂寫死資料。**

而且假作品全部標 `demo/internal`，這點要一直守。

---

## 對立性視角

我現在只會再補 **4 個很小但值得在開工前寫進 Plan 的約束**，不是改 Spec，是 implementation guardrail。

第一，`/_dev/*` 不只 Production 排除，**也不要被 sitemap、robots、analytics 正常事件污染**。這是開發工具，不是產品內容。

第二，Repository interface 不要設計成「為了未來萬能而萬能」。Phase 1 只定目前 UI 真正需要的 contract，例如：

```ts
listFeatured()
listByGoal()
getBySlug()
```

不要第一天就寫：

```ts
search(criteria, pagination, sort, projection, include, relations...)
```

不然又在尚未有客戶前打造一顆 Enterprise Portfolio DBMS。🙂

第三，URL-driven Goal Context 要先定清楚**非法值與預設行為**：

```text
/?goal=website   ✅
/?goal=banana    → fallback default
沒有 goal        → default / all
```

而且切 Goal 最好不要造成整頁 reload。URL 是 Source of Truth，但 UX 仍然要像單頁體驗。

第四，Frozen Spec 很好，但：

> **「不接受邊做邊改 Spec」不能變成「發現 Spec 有 bug 也硬做」。**

正確制度應該是：

```text
發現 Spec 問題
↓
停止該項實作
↓
提出 Spec Change Request
↓
你裁決
↓
升版本
↓
再繼續
```

不是工程師自己邊寫邊改，也不是把錯誤規格當聖旨撞牆。

### 所以我的正式裁決

**A：思源宋體標題 + 黑體內文。**
**B：pnpm。**
**C：`/_dev/*` 保留，Production 硬排除。**

然後：

> **Phase 1A 可以開始。**

目前最值得高興的其實不是「計畫寫得詳細」，而是這次開工前已經把**哪些地方絕對不能偷懶**說死了。這會比叫 Claude Code 一句「照 Spec 做得漂亮一點」可靠太多。😏
