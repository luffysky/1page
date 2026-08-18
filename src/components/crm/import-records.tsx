"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { importCrmRecordsAction } from "@/app/crm/actions";
import { convertRows } from "@/features/crm-builder/import/build";
import type { Sheet } from "@/features/crm-builder/import/csv";
import { readSpreadsheetFile } from "@/features/crm-builder/import/read-file";
import type { CrmEntity } from "@/features/crm-builder/schema";

/**
 * 用 Excel／CSV 一次填很多筆（CR-003-5 匯入）
 *
 * ── 三步，每一步都看得到結果 ─────────────────────────────────
 *
 * 選檔案 → **對應欄位**（自動照名字配好，可以改）→ 看一遍會匯進去幾筆、
 * 哪幾列有問題 → 送出。
 *
 * ⚠️ 「哪幾列有問題」一定要在送出**之前**就看得到。
 * 送出之後才說的話，使用者已經匯進去一半，要在後台一筆一筆找。
 *
 * ── 驗證在瀏覽器跑一次、伺服器再跑一次 ───────────────────────
 *
 * 用的是同一個 `convertRows` / `recordSchemaFor`，所以兩邊的鬆緊
 * 不可能不一樣。瀏覽器那一次是為了**先告訴人**，不是為了省伺服器的驗證——
 * 伺服器那一次才算數（見 addCrmRecords）。
 */
export function ImportRecords({
  definitionId,
  entity,
}: {
  definitionId: string;
  entity: CrmEntity;
}) {
  /*
   * ⚠️ 讀進來的表**綁著它是為哪一類讀的**。
   *
   * 不綁的話，使用者選好檔案之後點另一個類別，對應表會原封不動地留著——
   * 而那些 id 在新的類別裡可能剛好也存在（兩類都是匯入建的話，
   * 欄位 id 都是 col-1、col-2……）。結果是電話填進金額欄，
   * 畫面上完全看不出來。
   *
   * 綁在一起之後，換類別＝這份檔案不算數，要重選。那是實話：
   * 對應是對著某一組欄位做的，換了一組就不成立。
   */
  const [loaded, setLoaded] = useState<{
    entityId: string;
    /** ⚠️ 檔案選擇讀完就清掉了，所以畫面上唯一還說得出「讀的是哪一個檔案」的地方就是這裡 */
    fileName: string;
    sheet: Sheet;
    mapping: (string | null)[];
  } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(importCrmRecordsAction, null);
  /*
   * 上一次按下送出時，送的是哪一份資料。
   *
   * ⚠️ 用來判斷「已經匯完了」——匯完之後表單要收起來，
   * 不然按兩下就是匯兩次，而畫面上兩次都顯示成功。
   *
   * 刻意不在 effect 裡清狀態：那是 `set-state-in-effect`，
   * 而且會多一幀「已經匯好了但表單還在」的畫面。這裡用推導的——
   * 換一個檔案之後 rows 就不一樣了，表單自己會回來。
   */
  const [submitted, setSubmitted] = useState<string | null>(null);
  const fileId = useId();

  async function handleFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    /*
     * 讀完就把選擇清掉。
     *
     * 不清的話，使用者在 Excel 裡改完同一個檔案再選一次**不會觸發 change**
     * （value 沒變），畫面上停在舊的內容——而他會以為自己的修改沒有存到。
     */
    input.value = "";
    if (!file) return;
    setReadError(null);

    const result = await readSpreadsheetFile(file);
    if (!result.ok) {
      setLoaded(null);
      setReadError(result.error);
      return;
    }

    /*
     * 照欄名自動配對。
     *
     * 配不上的留白（不匯入），**不亂猜順序**——照順序硬配的話，
     * 一份欄位順序不同的表會把電話填進金額欄，而兩邊都是一串數字，
     * 畫面上完全看不出來。
     */
    setLoaded({
      entityId: entity.id,
      fileName: file.name,
      sheet: result.sheet,
      mapping: result.sheet.headers.map(
        (header) => entity.fields.find((field) => field.label.trim() === header.trim())?.id ?? null,
      ),
    });
  }

  /** 換了類別就當作沒選過檔案——推導出來的，不必在 effect 裡清 */
  const active = loaded?.entityId === entity.id ? loaded : null;
  const sheet = active?.sheet ?? null;
  const mapping = active?.mapping ?? [];

  const preview = useMemo(() => {
    if (!sheet) return null;
    return convertRows(entity, sheet, mapping);
  }, [entity, sheet, mapping]);

  const mappedCount = mapping.filter(Boolean).length;
  const rowsJson = JSON.stringify(preview?.rows ?? []);
  /** 這一份已經送出去而且成功了。換一個檔案之後 rowsJson 就不一樣，表單自己回來 */
  const done = state?.ok === true && submitted === rowsJson;

  return (
    <div className="border-brand-line mt-6 rounded-lg border p-4">
      <p className="text-caption text-brand-muted">
        檔案在瀏覽器裡讀，不會上傳。送出去的只有對應好之後的那幾列。
      </p>

      <label htmlFor={fileId} className="text-caption mt-3 block font-bold">
        選一個檔案（.xlsx、.csv）
      </label>
      <input
        id={fileId}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx"
        onChange={(event) => void handleFile(event.target)}
        className="text-body-sm mt-1 w-full"
      />

      {readError ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {readError}
        </p>
      ) : null}

      {active && sheet && preview && !done ? (
        <form action={action} onSubmit={() => setSubmitted(rowsJson)} className="mt-4">
          <input type="hidden" name="definitionId" value={definitionId} />
          <input type="hidden" name="entity" value={entity.id} />
          <input type="hidden" name="rows" value={rowsJson} />

          <p className="text-caption text-brand-muted">
            讀到「{active.fileName}」：{sheet.headers.length} 欄、{sheet.rows.length} 列。
          </p>

          <h4 className="text-body-sm mt-3 font-bold">哪一欄放到哪一格</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {sheet.headers.map((header, index) => (
              <li key={`${header}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="text-body-sm min-w-0 flex-1 truncate">{header}</span>
                <span aria-hidden="true" className="text-brand-muted">
                  →
                </span>
                <select
                  value={mapping[index] ?? ""}
                  onChange={(event) =>
                    setLoaded((current) =>
                      current
                        ? {
                            ...current,
                            mapping: current.mapping.map((value, position) =>
                              position === index ? event.target.value || null : value,
                            ),
                          }
                        : current,
                    )
                  }
                  aria-label={`「${header}」要放到哪一格`}
                  className="border-brand-line bg-brand-paper text-body-sm w-44 rounded-md border px-3 py-2"
                >
                  <option value="">不匯入這一欄</option>
                  {entity.fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          <p className="text-body-sm mt-4">
            {sheet.rows.length} 列裡有 <strong>{preview.rows.length}</strong> 列可以匯入
            {mappedCount === 0 ? "（目前每一欄都設成不匯入）" : null}。
          </p>

          {/*
           * 有問題的那幾列逐列列出來。
           *
           * 只說「有 3 列失敗」的話，使用者要自己在三百列裡找是哪三列——
           * 而他手上那份檔案的列號正好與這裡的列號一致。
           */}
          {preview.problems.length > 0 ? (
            <div className="border-brand-line mt-3 rounded-md border border-dashed p-3">
              <p className="text-caption font-bold">這幾列匯不進去：</p>
              <ul className="text-caption text-brand-muted mt-1 flex flex-col gap-1">
                {preview.problems.slice(0, 10).map((problem) => (
                  <li key={problem.line}>
                    第 {problem.line} 列：{problem.message}
                  </li>
                ))}
              </ul>
              {preview.problems.length > 10 ? (
                <p className="text-caption text-brand-muted mt-1">
                  還有 {preview.problems.length - 10} 列，修好前面幾列之後會再算一次。
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending || preview.rows.length === 0}
            className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2 font-bold disabled:opacity-40"
          >
            {pending ? "匯入中……" : `匯入這 ${preview.rows.length} 筆`}
          </button>
        </form>
      ) : null}

      {state ? (
        <p
          role="status"
          className={`text-body-sm mt-3 font-bold ${state.ok ? "" : "text-brand-accent-strong"}`}
        >
          {state.message}
        </p>
      ) : null}

      {/*
       * 伺服器端也擋下來的那幾列。
       *
       * 理論上瀏覽器已經先擋過一樣的東西，但兩邊看到的定義可能不同步
       * （別的分頁改了設計）——這時候使用者需要知道的是哪幾列，
       * 而不是一句「有幾列失敗」。
       */}
      {state?.problems && state.problems.length > 0 ? (
        <ul className="text-caption text-brand-muted mt-2 flex flex-col gap-1">
          {state.problems.slice(0, 10).map((problem) => (
            <li key={problem.line}>
              第 {problem.line} 列：{problem.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
