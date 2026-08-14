"use client";

import { useActionState, useId, useState } from "react";

import { saveCmsDocument } from "@/features/cms/actions";
import { appendAt, blankLike, removeAt, setAt, type Path } from "@/features/cms/edit-value";
import { CMS_FIELD_LABELS } from "@/features/cms/registry";

/**
 * CMS 文件編輯器（CR-004 / Phase B BH + BI）
 *
 * ── 表單是照著內容的形狀長出來的，不是為每個 key 各寫一份 ──────
 *
 * 為每一種 key 各做一份表單，就是**第二份 schema**——而它與 zod 那份
 * 遲早分歧，分歧的表現是「表單上有的欄位存不進去」或
 * 「存得進去的欄位表單上沒有」。
 *
 * 所以這裡走的是與內容面板（content-panel.tsx）同一招：
 * 走一遍值本身，遇到字串給輸入框、遇到陣列給可增減的清單、
 * 遇到物件就往下一層。加一個新的 key 完全不用動這個檔案。
 *
 * BH 的第一版直接讓人編 JSON。那對「偶爾改一次價格」還行，
 * 但 BI 之後幾乎每個區塊都可編輯了，而**要改一句首頁標題卻得面對
 * 括號與引號**是說不過去的。JSON 那條路留著（下面的「進階」），
 * 因為新增一整段陣列時它仍然比較快。
 *
 * ── 欄位名 ────────────────────────────────────────────────────
 *
 * 顯示的名字來自 `CMS_FIELD_LABELS`，查不到就用原本的鍵。
 * 刻意不做成必填——必填就變成第三份 schema 了。
 *
 * ⚠️ 陣列裡每一項的欄位名都要帶上它是第幾項。
 * 只寫「名稱」的話，一份有六個項目的內容上就有六個叫「名稱」的框，
 * 而讀螢幕的人與自動化測試都分不出是哪一個。
 * （圖片編輯器的模糊區域剛踩過一模一樣的問題。）
 */

const inputClass = "border-brand-line bg-brand-bg text-body-sm w-full rounded-md border px-3 py-2";

const labelOf = (key: string) => CMS_FIELD_LABELS[key] ?? key;

/** 這幾個欄位天生就長，給多行框 */
const LONG_FIELDS = new Set(["lead", "summary", "answer", "description", "disclosure"]);

function isLong(key: string, value: string): boolean {
  return LONG_FIELDS.has(key) || value.length > 80;
}

/* ------------------------------------------------------------------ */

function Node({
  value,
  path,
  fieldKey,
  labelPrefix,
  onChange,
}: {
  value: unknown;
  path: Path;
  /** 這個節點在父層的鍵名。最外層沒有 */
  fieldKey?: string;
  /** 「產品線 2 · 」之類的前綴，讓同名欄位分得出來 */
  labelPrefix: string;
  onChange: (path: Path, next: unknown) => void;
}) {
  const id = useId();

  /* ── 陣列 ─────────────────────────────────────────────── */
  if (Array.isArray(value)) {
    const itemLabel = fieldKey ? labelOf(fieldKey) : "項目";

    return (
      <fieldset className="border-brand-line mt-4 rounded-lg border p-4">
        <legend className="text-body-sm px-2 font-bold">
          {labelPrefix}
          {itemLabel}
        </legend>

        {value.length === 0 ? (
          <p className="text-caption text-brand-muted">還沒有任何一項。</p>
        ) : null}

        {value.map((item, index) => (
          <div key={index} className="border-brand-line mt-3 rounded-md border p-3 first:mt-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-caption text-brand-muted font-bold">
                {itemLabel} {index + 1}
              </p>
              <button
                type="button"
                onClick={() => onChange(path, { __remove: index })}
                className="border-brand-line text-caption rounded-pill border px-3 py-1"
              >
                刪除{itemLabel} {index + 1}
              </button>
            </div>

            <Node
              value={item}
              path={[...path, index]}
              labelPrefix={`${itemLabel} ${index + 1} · `}
              onChange={onChange}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange(path, { __append: blankLike(value[0] ?? "") })}
          className="border-brand-ink text-caption rounded-pill mt-3 border px-4 py-1.5 font-bold"
        >
          新增一個{itemLabel}
        </button>
      </fieldset>
    );
  }

  /* ── 物件 ─────────────────────────────────────────────── */
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const nested = fieldKey !== undefined;

    const body = entries.map(([key, item]) => (
      <Node
        key={key}
        value={item}
        fieldKey={key}
        path={[...path, key]}
        labelPrefix={labelPrefix}
        onChange={onChange}
      />
    ));

    if (!nested) return <>{body}</>;

    return (
      <fieldset className="border-brand-line mt-4 rounded-lg border p-4">
        <legend className="text-body-sm px-2 font-bold">
          {labelPrefix}
          {labelOf(fieldKey)}
        </legend>
        {body}
      </fieldset>
    );
  }

  /* ── 布林 ─────────────────────────────────────────────── */
  if (typeof value === "boolean") {
    return (
      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(path, event.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-body-sm">
          {labelPrefix}
          {labelOf(fieldKey ?? "")}
        </span>
      </label>
    );
  }

  /* ── 數字 ─────────────────────────────────────────────── */
  if (typeof value === "number") {
    return (
      <div className="mt-3">
        <label htmlFor={id} className="text-caption text-brand-muted block">
          {labelPrefix}
          {labelOf(fieldKey ?? "")}
        </label>
        <input
          id={id}
          value={value}
          inputMode="decimal"
          onChange={(event) => onChange(path, Number(event.target.value))}
          className={`${inputClass} mt-1`}
        />
      </div>
    );
  }

  /* ── 字串（含 null，當成空字串處理）─────────────────────── */
  const text = value === null || value === undefined ? "" : String(value);
  const name = `${labelPrefix}${labelOf(fieldKey ?? "")}`;

  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-caption text-brand-muted block">
        {name}
      </label>
      {isLong(fieldKey ?? "", text) ? (
        <textarea
          id={id}
          value={text}
          rows={3}
          onChange={(event) => onChange(path, event.target.value)}
          className={`${inputClass} mt-1`}
        />
      ) : (
        <input
          id={id}
          value={text}
          onChange={(event) => onChange(path, event.target.value)}
          className={`${inputClass} mt-1`}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function CmsEditor({ cmsKey, initial }: { cmsKey: string; initial: unknown }) {
  const serialized = JSON.stringify(initial, null, 2);

  const [value, setValue] = useState<unknown>(initial);
  const [raw, setRaw] = useState(serialized);
  const [showRaw, setShowRaw] = useState(false);
  const [state, action, pending] = useActionState(saveCmsDocument, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const rawId = useId();

  /*
   * 伺服器送來不同的內容時，把編輯中的值同步過去。
   *
   * ⚠️ 這一段是踩過才有的。還原某個版本之後，伺服器回傳的是新內容，
   * 但這個元件沒有重新掛載，`useState` 的初始值不會重算——
   * 畫面上還是還原前的舊內容。使用者按了「還原」看到沒變，
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
    setValue(initial);
    setRaw(serialized);
  }

  /**
   * 表單那邊的每一種操作都走這裡。
   *
   * 新增與刪除用 `{__append}` / `{__remove}` 這種標記，
   * 而不是讓 `Node` 自己組出新的整份值——`Node` 只知道自己的路徑，
   * 讓它去改整棵樹的話，那個邏輯會散在遞迴的每一層。
   */
  const handleChange = (path: Path, next: unknown) => {
    setLocalError(null);

    setValue((current: unknown) => {
      if (next !== null && typeof next === "object" && "__append" in next) {
        return appendAt(current, path, (next as { __append: unknown }).__append);
      }
      if (next !== null && typeof next === "object" && "__remove" in next) {
        return removeAt(current, path, (next as { __remove: number }).__remove);
      }
      return setAt(current, path, next);
    });
  };

  /*
   * 切到 JSON 時把目前編輯的內容帶過去，切回來時把 JSON 讀回結構。
   *
   * 不帶的話，兩邊會各改各的，而按下儲存時送出去的是其中一份——
   * 另一份的修改就這樣消失了，畫面上不會有任何提示。
   */
  const toggleRaw = () => {
    if (!showRaw) {
      setRaw(JSON.stringify(value, null, 2));
      setShowRaw(true);
      return;
    }

    try {
      setValue(JSON.parse(raw));
      setShowRaw(false);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "這不是合法的 JSON");
    }
  };

  /*
   * 送出去的一律是結構那份。
   *
   * 在 JSON 模式下先 parse 一次確認它合法——不合法就擋在這裡，
   * 讓錯誤訊息帶著位置，比伺服器只回「這不是合法的 JSON」有用。
   */
  const payload = showRaw ? raw : JSON.stringify(value, null, 2);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!showRaw) return;

    try {
      JSON.parse(raw);
    } catch (error) {
      event.preventDefault();
      setLocalError(error instanceof Error ? error.message : "這不是合法的 JSON");
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="mt-8">
      <input type="hidden" name="key" value={cmsKey} />
      <input type="hidden" name="content" value={payload} />

      {showRaw ? (
        <>
          <label htmlFor={rawId} className="text-body-sm block font-bold">
            內容（JSON）
          </label>
          <textarea
            id={rawId}
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setLocalError(null);
            }}
            spellCheck={false}
            rows={26}
            className="border-brand-line bg-brand-bg text-body-sm mt-2 w-full rounded-md border p-4 font-mono"
          />
        </>
      ) : (
        <Node value={value} path={[]} labelPrefix="" onChange={handleChange} />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-6 py-3 font-bold disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存"}
        </button>

        <button
          type="button"
          onClick={toggleRaw}
          className="border-brand-line text-body-sm rounded-pill border px-6 py-3"
        >
          {showRaw ? "回到表單" : "進階：直接編 JSON"}
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
