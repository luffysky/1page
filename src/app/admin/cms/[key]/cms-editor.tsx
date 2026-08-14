"use client";

import { useActionState, useId, useState } from "react";

import { saveCmsDocument } from "@/features/cms/actions";

/**
 * CMS 文件編輯器（CR-004 / Phase B BH）
 *
 * ── 為什麼是 JSON 而不是逐欄位表單 ────────────────────────────
 *
 * 每一個 key 的形狀都不一樣（FAQ 是問答清單、價格是六級階梯）。
 * 為每一種各做一份表單，就是**第二份 schema**——而它與 zod 那份
 * 遲早分歧，分歧的表現是「表單上有的欄位存不進去」或
 * 「存得進去的欄位表單上沒有」。
 *
 * 這與內容面板（content-panel.tsx）刻意「照著值的形狀產生欄位」
 * 是同一個判斷，只是這裡的形狀差異更大，所以直接讓人編輯 JSON。
 *
 * 代價講清楚：使用者要面對括號與引號。所以
 *   - 存檔前先在瀏覽器裡驗一次 JSON，指出第幾行壞掉
 *   - 伺服器端的 zod 錯誤會指名是哪一個欄位
 *   - 有「排版」按鈕，把亂掉的縮排整理好
 *
 * 之後某個 key 真的常常要改，再為它做專屬表單——那時它會是一個
 * 有明確使用頻率支撐的決定，不是先做起來放。
 */

export function CmsEditor({ cmsKey, initial }: { cmsKey: string; initial: unknown }) {
  const serialized = JSON.stringify(initial, null, 2);

  const [text, setText] = useState(serialized);
  const [state, action, pending] = useActionState(saveCmsDocument, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fieldId = useId();

  /*
   * 伺服器送來不同的內容時，把編輯框同步過去。
   *
   * ⚠️ 這一段是踩過才有的。還原某個版本之後，伺服器回傳的是新內容，
   * 但這個元件沒有重新掛載，`useState` 的初始值不會重算——
   * 畫面上還是還原前的舊文字。使用者按了「還原」看到沒變，
   * 接著按「儲存」，就把自己剛還原掉的東西又存回去了。
   *
   * 第一版的修法是給元件一個會變的 `key` 讓它重新掛載，
   * 那確實修好了還原，但**順手把成功訊息也清掉了**——
   * `useActionState` 的結果活在元件裡，重新掛載就沒了。
   * 於是存檔之後畫面上什麼都不說，看起來像沒反應。
   *
   * 改成在 render 期間比對（與 portfolio-filter、dashboard-shell 同一招）：
   * 內容變了就同步，元件不重來，訊息也留得住。
   */
  const [syncedFromServer, setSyncedFromServer] = useState(serialized);
  if (syncedFromServer !== serialized) {
    setSyncedFromServer(serialized);
    setText(serialized);
  }

  /*
   * 在瀏覽器先驗一次 JSON。
   *
   * 不驗的話，少一個逗號要等一次往返才知道，而伺服器只說得出
   * 「這不是合法的 JSON」——說不出是哪裡。JSON.parse 的錯誤訊息
   * 帶著位置，直接轉給使用者比較有用。
   */
  const format = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "這不是合法的 JSON");
    }
  };

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="key" value={cmsKey} />

      <label htmlFor={fieldId} className="text-body-sm block font-bold">
        內容（JSON）
      </label>
      <textarea
        id={fieldId}
        name="content"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setLocalError(null);
        }}
        spellCheck={false}
        rows={26}
        className="border-brand-line bg-brand-bg text-body-sm mt-2 w-full rounded-md border p-4 font-mono"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-6 py-3 font-bold disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存"}
        </button>

        <button
          type="button"
          onClick={format}
          className="border-brand-line text-body-sm rounded-pill border px-6 py-3"
        >
          排版
        </button>
      </div>

      {localError ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-4 font-bold">
          {localError}
        </p>
      ) : null}

      {state ? (
        <p
          role="status"
          className={`text-body-sm mt-4 ${state.ok ? "text-brand-muted" : "text-brand-accent-strong font-bold"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
