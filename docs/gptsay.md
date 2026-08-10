## 支持性分析

這份判讀我大致同意，而且抓到的幾個點都不是雞毛蒜皮，是**會直接影響正式版架構與轉換率**的東西。

最重要的前三個我會直接列成阻斷項：

* **價格階梯斷層**
* **Template Experience 在首頁消失**
* **正式版 Preview 必須改成 SiteConfig 驅動，不能 DOM patch**

其中價格那刀最該先修。`990 → 30,000` 真的太像搭電梯突然剪斷鋼索。😂
正式 Funnel 應該完整恢復成：

> Free Advisor
> → Website Workshop 990+
> → Template Build 8,800+
> → Semi-Custom 15,800+
> → Custom 30,000+
> → Strategy / 專案報價

這樣每一層都有自然升級路徑。

而 **Website / Template Experience** 我也贊成獨立拉出來，不要完全藏在 Agent 裡。首頁應該讓客戶即使**不想聊天**，也能自己：

> 看 Template → 選產業 → 換 Theme → 看 Desktop / Mobile → 再決定要不要叫 Agent 幫忙。

Agent 應該是「加速理解與操作」，不是模板體驗唯一入口。

至於視覺，我會改掉 Spec 那句：

> HTML 只作功能概念參考，不沿用視覺設計。

改成：

> **V3 Demo 的品牌色彩、暖白／近黑／Rocket Red 與部分版面語言作為正式 Design Token 起點；正式版重新建立 Grid、Typography、Spacing 與 Section Composition，不直接移植 Demo CSS。**

這比較符合現在實際狀況。

換句話說：

**保留靈魂，拆掉骨架重蓋。**

---

## 對立性視角

不過我會挑戰其中一點：

> 「Demo 視覺完成度其實不低，重畫一次成本不划算。」

**如果「重畫」是指全部推翻品牌方向，那確實沒必要。**

但如果因此演變成：

> 「那就沿用這份 HTML CSS 改成 Next。」

我會強烈反對。

因為現在已經出現：

* CSS patch 疊 patch
* 重複 selector
* inline style
* inline event handler
* DOM manipulation
* 無完整 token system
* responsive navigation 缺失
* accessibility 欠帳
* 一堆區塊仍然靠 card 解決

這種 prototype 最危險的就是：

> **「看起來已經 70% 了，不然直接修到正式版。」**

然後三週後發現那 70% 是泥巴做的。☠️

所以正式 Next 版我會採：

> **視覺語言沿用，程式實作 100% 重建。**

不是把 HTML migrate 成 JSX。

### 正式 Phase 1 應該先做這幾件事

先定真正的：

**Design Tokens**

* color
* typography
* spacing
* radius
* shadow
* container
* breakpoint
* motion

然後做：

**Navbar / Hero / Editorial Section / Portfolio Layout / Template Experience / Agent Workspace / Pricing Ladder / CTA**

再接資料與 Engine。

尤其卡片問題我完全同意。正式版要避免：

> Section 標題
> ↓
> 六張圓角卡
> ↓
> Section 標題
> ↓
> 四張圓角卡
> ↓
> Section 標題
> ↓
> 三張圓角卡

那是 SaaS Dashboard 的文法，不是精品工作室。

正式版應該交替：

> **大字 Editorial**
>
> → 滿版作品
>
> → split layout
>
> → interactive canvas
>
> → whitespace
>
> → pricing table
>
> → dark CTA block

節奏才會出來。

---

還有他抓到的 **Goal Selector 沒行為** 我很喜歡，因為這其實可以讓首頁開始「活」。

例如點：

> **我要一個網站**

頁面可以同步：

1. Selected Work filter → Web
2. Template Experience → Web templates
3. Services → Web highlight
4. Agent CTA → `initialIntent = website`

點：

> **我要導入 AI**

則全部切成 AI / Agent / Automation 案例。

這樣 Goal Selector 就不是六張漂亮墓碑，是整個首頁的**Context Controller**。

這可以正式寫進 Spec。

---

### 我會直接形成一個 V1 修正清單

**P0**

* 恢復完整 6 級價格階梯
* Template Experience 獨立 Section
* SiteConfig-based Preview
* Portfolio data-driven
* Goal Selector 有 context 行為
* Hero secondary CTA 改回作品
* Mobile Nav
* Accessibility 基線

**P1**

* Editorial typography
* 減少 Card Density
* Portfolio Filter
* `/work/[slug]`
* Agent ↔ Goal ↔ Portfolio ↔ Template context synchronization

**P2**

* Workshop unlock
* persistence
* analytics
* deeper Agent tools

這樣就很清楚。

一句話總結：

> **V3 Demo 已經找到品牌方向，但還不是正式前端的底。**

色彩、氣質、商業流程可以留下。

CSS、DOM 操作和目前的版面組織，**正式版該砍就砍，不要惜屍。** 😂

如果現在讓 Claude Code 開工，我會先把這份 review 直接併回 `1page-v1-spec.md`，做成 **V1.1**，避免它照舊 Spec 做出一個「規格正確但轉換斷掉」的版本。
