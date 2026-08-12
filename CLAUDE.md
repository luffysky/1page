@AGENTS.md

# 這個專案反覆踩到的兩種毛病

寫在這裡是因為它們**都不會報錯、測試照樣綠、build 照樣過**。
只有實際去看畫面、或去讀瀏覽器算出來的值，才會發現。

每次開始寫東西之前先看一眼這兩條。

---

## 一、宣告了一個東西，卻沒有任何地方用到它

已經出現**六次**：

```text
1. spacingScale 注入了 --site-spacing，沒有任何 CSS 讀它
   → 主題裡有一個設定，改了畫面完全不動

2. 路由做好了，畫面上沒有入口
   → audit:wiring【8】路由可達性

3. 19 個分析事件裡有 5 個沒有呼叫點
   → tests/unit/analytics-call-sites.test.ts

4. pricing / testimonials / faq 在 SITE_SECTION_TYPES 裡但沒有元件
   → 訪客選到會看到「這個區塊還在準備中」
   → src/features/website-engine/registry.test.ts

5. 登入系統整套做完了（登入頁、profiles、RLS、trigger），
   選單上沒有任何地方連得到登入頁
   → 蓋好了房子沒有門。tests/e2e/account-entry.spec.ts

6. Security 稽核 21 項全綠，而整個專案一行 CSP 都沒有
   → 沒有任何一項在問這件事。一份稽核只證明它問過的問題。
```

**寫新東西時要問的**：這個欄位／型別／事件／路由／表，
**有沒有任何一行程式在讀它**？沒有的話，它現在就是壞的，
只是還沒有人發現。

**加守衛的方向**：不要逐一列「faq 要有元件」，
要反過來問「**清單裡有沒有哪一個沒人實作**」——
前者每次新增都要記得補，後者會自己發現下一次。
刻意的例外要進一份具名清單並**寫下理由**（見 registry.test.ts 的 `DEFERRED`、
audit-wiring 的 `UNLINKED_BY_DESIGN`）。

---

## 二、守衛通過不等於守衛有效

一天之內就抓到三個**名不副實的綠燈**：

```text
audit:security 的「限流在請求驗證之前生效」
  比對的是 checkRateLimit(...) 這串字，不是它的位置。
  限流搬到驗證後面照樣綠；只是多加一個參數卻會紅。兩個方向都錯。

section-ops 與 site-renderer 各有一條測試
  拿 "pricing" 當「還沒實作的 type」的例子。pricing 實作之後
  一條紅了、另一條照樣綠——但它驗的已經不是名字說的那件事。
  測試釘住了「哪一個還沒做」這種一定會過期的事實。

編輯器的鍵盤測試用 `await button.focus()`
  那是程式直接指定焦點，連 tabIndex={-1}（完全不在 Tab 順序上）
  都能成功。它從來沒在驗「鍵盤到得了」，只在驗「按了會動」。
```

**規則：每加一個守衛，就故意把程式改壞一次**，
確認它真的會紅、而且訊息說得出問題在哪。改壞的方式要對應
它宣稱要擋的那件事（測順序就真的把順序調換，測鍵盤可達性就真的
把元素移出 Tab 順序）。

**斷言要釘不會過期的事實。** 「schema 擋不擋得住非法 type」永遠成立；
「pricing 還沒實作」下週就不成立了。需要「目前還沒做的那一個」時，
去問 registry 算出來，不要寫死。

---

## 三、順手記下的幾個具體地雷

```text
font-[var(--x)]        Tailwind 的 font-* 同時是 family 與 weight 的前綴，
                       任意值形式無法判斷要哪一個，結果什麼都不產出。
                       要寫 font-(family-name:--x)。

@container             container-type: inline-size 會做行內軸尺寸內縮，
                       那個框就不再依內容撐開（量出來 width: 0）。
                       絕對定位又要包內容時，寬度必須明寫。

--site-* 的作用域       它們宣告在 [data-site-scope] 上。放到那個元素外面的
                       東西用 site.* 類別，會解析到不存在的變數——
                       背景變透明，沒有任何錯誤訊息。

comment vs code        稽核腳本比對原始碼前要先去掉註解。
                       同一個原因造成過一次假通過、一次假失敗。

Playwright dragTo      走滑鼠座標。在有自己捲軸的容器裡，來源捲進來、
                       目標捲出去，放開時游標底下是別塊。
                       驗自己的 DnD 邏輯要明確派送事件。

readOnly input         仍然吃 Tab。看得到、聚焦得到、打不了字——
                       axe 不會報這件事，但鍵盤使用者會卡在那裡。
```
