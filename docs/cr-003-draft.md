# CR-003 草案 — Widget 編輯器、擴充 Block、AI 客服 Widget

**狀態：** 草案，等 Luffy 裁決後才寫進 Spec §47 並升版 V1.3 → V1.4。

**來源：** Luffy 指定參考 `MaoTravelBlog` 的建站功能後裁決：
「這些也能抄啊 還有 AI 部份 如果他們網站想接 AI 客服也可以在模板給他們接個 AI
體驗一下 模板排版方式用 widget 可拖曳那種怎麼樣 每個區塊都是 widget」

---

## 這份 CR 要動到的封版條文

```text
§40  ❌ 完整 CMS 平台                → 解禁（有界線，見下）
§40  ❌ Wix-like Drag & Drop Editor  → 解禁
§40  ❌ Production AI Website SaaS   → 部分解禁（Demo 版解禁，正式產品仍非目標）
§36  Preview 禁止 arbitrary HTML     → **不解禁**，改以白名單嵌入取代（見下）
§22  Website Agent Tools             → 新增 widget 層級的操作
§23  免費／付費邊界                  → 需要重畫（見「必須先決定的一件事」）
```

---

## 三件事分開談

### 一、Widget 可拖曳編輯（解禁）

每個區塊都是 widget，可拖曳排序、個別設定。

**這件事本身沒有技術障礙**——Phase 6C 的 section 操作
（add / remove / reorder / updateContent / setVariant）已經寫完也測完了，
而且全部是純函式、失敗不留下半毀的 config。拖曳要做的是換一套操作介面，
底下呼叫的是同一組函式。

⚠️ **但有一條不能省：拖曳必須同時可用鍵盤操作。**

這不是我在加要求，是 WCAG 2.1 的硬規定（2.5.7 Dragging Movements），
而這個專案每一個 Phase 的 gate 都擋 axe critical/serious，
還有一條「主要流程可以完全用鍵盤走完」的測試。
只能用滑鼠拖的編輯器會直接讓那兩項變紅。

做法是每個 widget 同時提供：拖曳握把 + 「上移／下移」按鈕（可 focus、可按 Enter）。
兩者呼叫同一個 `reorderSections`。成本不高，但**必須從第一版就有**——
補做的話等於整個介面重寫一次。

**規模誠實說：** Phase 4 做「不可編輯的預覽」花了四段。
可拖曳編輯器要處理拖曳狀態、每個 widget 的設定面板、行動版的拖曳行為
（手機上拖曳與捲動會打架）、復原。這是**獨立的一個 Phase**，不是一段。

### 二、擴充 Block 種類（解禁）

目前 13 種 section、9 種有元件。MaoTravelBlog 有 60+ 種。

值得先抄的（對「接案工作室的客戶網站」實際用得到的）：

```text
faq / timeline / process / stats / team / testimonial
form / map / newsletter / social / countdown
accordion / tabs / columns / spacer / divider
```

這些都能用現有的 `SiteSection` 模型表達，不需要改 schema——
只是多寫元件與 registry 條目。可以分批做，一批三四種。

**不抄的兩種，理由是安全不是範圍：**

- `html`：那是把任意 HTML 塞進頁面。Preview 會渲染別人輸入的內容，
  這等於自己開一個 XSS 洞。
- `embed`：同上，但它想解決的需求是真的（放 YouTube、Google Maps）。

**替代做法：白名單嵌入。** 做一個 `embed` section，但只接受
「提供者 + ID」而不是一段 HTML：

```ts
{ type: "embed", variant: "youtube", content: { videoId: "..." } }
{ type: "embed", variant: "map", content: { query: "..." } }
```

渲染時由我們組出 `<iframe sandbox>`。使用者拿到一樣的功能，
而我們不需要相信他貼進來的字串。這條我建議照這樣做，
但如果你要真的 raw HTML，那也是你的決定——只是要知道代價是
「任何能編輯網站的人都能在頁面上執行 JavaScript」。

### 三、AI 客服 Widget（部分解禁）

要分成兩個東西，它們的成本差很多：

**(a) 模板裡的體驗版**——訪客在預覽裡看到一個 AI 客服對話框，
可以打字、會回答，但回答的是**這個模板示範的那間店**的事。
用途是讓客戶知道「我的網站可以有這個」。

這個好做：`/api/agent` 的基礎建設（串流、限流、工具、錯誤碼）已經在了，
差的是一個 section 元件 + 一份以該店資訊為 context 的系統提示。
**這是轉換工具，也是最值得先做的一個。**

**(b) 真的能部署給客戶的 AI 客服**——那是一條新產品線：
每個客戶要有自己的知識庫、自己的 API 用量與計費、自己的對話紀錄與後台。
那不是一個 section，是 §40 說的 Production AI SaaS。

我建議 CR-003 先解禁 (a)，(b) 另外開。理由是 (a) 兩三天內能上線並開始
幫你賣東西，(b) 是一個產品。

---

## 必須先決定的一件事：免費／付費的線要畫在哪

Spec §23 現在的線是「聊天免費，開始產生成果時收費」，
所以 Phase 6 把工具分成 free 與 workshop 兩級：改品牌名／風格／模板是免費，
改 Section 結構與文案是付費。

**可拖曳編輯器整個落在付費那一邊。** 如果訪客不付費就能拖出一個完整網站，
那 Website Workshop（NT$990 起）就沒有東西可以賣了——
它的交付物清單第二到第五項全是這個。

三個選項：

| 選項 | 意思 | 代價 |
|---|---|---|
| A | 編輯器留在 Workshop 之後 | 保住現在的定價模型；訪客要先付費才玩得到最好玩的部分 |
| B | 免費能拖，但存檔／匯出要付費 | 轉換率最高；要做「未登入的暫存」與「付費才能保留」的界線 |
| C | 全部免費，改賣正式建站 | Workshop 這一級實質消失，六級價格要重畫 |

**我的建議是 B。** 它保留了「先玩再付」的漏斗（正是 §0 funnel 的設計），
而「你調了半天的東西要留下來得付 990」是一個非常好講的理由。
但這是你的定價，不是我的。

---

## 提議的執行順序

```text
CR-003-1  AI 客服體驗 Widget（模板內）        ✅ 已完成
CR-003-2  擴充 Block 一批（faq/process/stats/team/testimonial/form）  ✅ 已完成
CR-003-3  白名單嵌入（youtube / map）  ✅ 已完成
CR-003-4  Widget 編輯器（獨立 Phase，含鍵盤操作）
```

先做 1 是因為它成本最低、對轉換最直接，而且不依賴前面那個定價決定。
定價已選 **B（免費編輯、存檔才付費）**，4 照這個前提做。

### CR-003-3 完成記錄

收的是**提供者 + 識別碼**，網址由我們組。YouTube 只收 11 個 base64url 字元，
地圖整串 encodeURIComponent——兩者都不可能組出別的主機。
沒列在白名單裡的提供者一律拒絕（預設不行，而不是預設可以然後擋壞的）。

嵌入採 facade：按下去之前不會連到 Google 或 YouTube。
這個預覽長在我們自己的首頁上，直接放 iframe 等於每個訪客都被送去
第三方一次。這條有 e2e 守著，刻意把 facade 拿掉驗證過會紅。

順帶把 enum 裡的  換成 —— 從頭到尾只是一個宣告，
沒有元件也沒有任何模板用它。換完之後 registry.test 的 DEFERRED 清單是空的。

⚠️ 過程中發現的一件事，不在這份 CR 範圍內但你應該知道：
**專案目前沒有任何 Content-Security-Policy。** 現在開始有第三方 iframe 了，
 值得設一下。要我另開一段做嗎？

### CR-003-1 完成記錄

實際跟它講過話，三種問法都對：

- **網站上有寫的**（營業時間、座位數）→ 照著模板內容回答
- **網站上沒寫的**（有沒有停車位）→ 說沒寫、要幫你留言，沒有編
- **問一頁起家的價格** → 說只負責這間店的事

Spec §47 的兩個硬性要求各由一條測試守著（`tests/unit/demo-assistant-isolation.test.ts`），
兩條都刻意改壞驗證過會紅。

順帶修掉一條假的守衛：`audit-security.mjs` 的「Rate limit 在請求驗證之前生效」
原本比對的是呼叫寫法而不是位置——限流搬到驗證後面它也不會紅。已改成真的比位置。

---

## 裁決欄

```text
Widget 可拖曳編輯    □ 同意   □ 修改後同意   □ 不做
擴充 Block           □ 同意   □ 修改後同意   □ 不做
raw HTML / embed     □ 用白名單嵌入   □ 我要真的 raw HTML（知道代價）
AI 客服 (a) 體驗版   □ 同意   □ 不做
AI 客服 (b) 正式產品 □ 另開 CR   □ 併進這一份   □ 不做
免費／付費的線       □ A   □ B   □ C   □ 其他：________
```
