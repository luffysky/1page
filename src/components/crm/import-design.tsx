"use client";

import { useId, useRef, useState } from "react";

import { ImportColumns } from "@/components/crm/import-columns";
import { attachEntity, planFromSheet } from "@/features/crm-builder/import/build";
import type { Sheet } from "@/features/crm-builder/import/csv";
import {
  type ColumnInference,
  inferSheet,
  optionsForColumn,
} from "@/features/crm-builder/import/infer";
import { readSpreadsheetFile } from "@/features/crm-builder/import/read-file";
import type { CrmDefinition, CrmFieldType } from "@/features/crm-builder/schema";

/**
 * 從 Excel／CSV 建一類（CR-003-5 匯入）
 *
 * ── 兩步，而且中間停下來 ──────────────────────────────────────
 *
 * 選檔案 → **看一遍猜出來的型別，可以改** → 加進設計。
 *
 * 中間那一步不能省。直接建好的話，使用者要等到匯入資料失敗、
 * 或是幾週後發現電話少了開頭的 0，才知道當初猜錯了。
 *
 * ── 這一步只建結構 ────────────────────────────────────────────
 *
 * 資料要等這份設計存起來、有了 id 之後，在記錄頁匯入。
 * 這件事直接寫在畫面上——不寫的話，使用者會以為資料已經進去了。
 */
export function ImportDesign({
  definition,
  onImported,
}: {
  definition: CrmDefinition;
  onImported: (definition: CrmDefinition) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<ColumnInference[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const nameId = useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const result = await readSpreadsheetFile(file);
    if (!result.ok) {
      setSheet(null);
      setColumns([]);
      setError(result.error);
      return;
    }

    setSheet(result.sheet);
    setFileName(file.name);
    setColumns(inferSheet(result.sheet));
    // 預設用檔名（去掉副檔名）當類別名字。使用者多半就是那個意思
    setName(file.name.replace(/\.[^.]+$/, "").slice(0, 60));
  }

  function changeType(index: number, type: CrmFieldType) {
    setError(null);

    setColumns((current) =>
      current.map((column, position) => {
        if (position !== index) return column;
        if (type !== "select") return { ...column, type, options: [] };

        /*
         * 改成下拉選單時要現算選項——猜測結果裡的 options 只有
         * 猜成 select 時才有值。算不出來就不要改，並且說出原因。
         */
        const values = (sheet?.rows ?? []).map((row) => row[index] ?? "");
        const options = optionsForColumn(values);
        if (!options.ok) {
          setError(`「${column.header}」${options.error}`);
          return column;
        }
        return { ...column, type, options: options.options };
      }),
    );
  }

  function addToDesign() {
    if (!sheet) return;

    const plan = planFromSheet(name, columns, definition.entities);
    const attached = attachEntity(definition, plan.entity);
    if (!attached.ok) {
      setError(attached.error);
      return;
    }

    /*
     * 只回傳定義，不回傳「剛剛加的是哪一類」。
     *
     * 設計器的 reducer（entityAfter）自己會找出新出現的那一類並跳過去，
     * 傳第二個參數等於同一件事算兩次——而兩次算出來不一樣的時候，
     * 沒有人知道該信哪一個。
     */
    onImported(attached.definition);
    setSheet(null);
    setColumns([]);
    setError(null);
    // 清掉檔案選擇，不然選同一個檔案不會觸發 change
    if (inputRef.current) inputRef.current.value = "";
  }

  const dropped = sheet ? planFromSheet(name, columns).droppedColumns : [];

  return (
    <div className="border-brand-line mt-8 rounded-lg border p-4">
      <h3 className="text-body-sm font-bold">從 Excel 或 CSV 建一類</h3>
      <p className="text-caption text-brand-muted mt-1">
        檔案不會離開這台電腦——在瀏覽器裡讀完，只有你按下「加進我的設計」之後的結構會存起來。
      </p>

      <label htmlFor={fileId} className="text-caption mt-3 block font-bold">
        選一個檔案（.xlsx、.csv）
      </label>
      <input
        ref={inputRef}
        id={fileId}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        className="text-body-sm mt-1 w-full"
      />

      {sheet ? (
        <>
          <label htmlFor={nameId} className="text-caption mt-4 block font-bold">
            這一類要叫什麼
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            className="border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2"
          />

          <p className="text-caption text-brand-muted mt-4">
            讀到「{fileName}」：{sheet.headers.length} 欄、{sheet.rows.length} 列。
            下面是每一欄猜出來的型別，猜錯的直接改。
          </p>

          <ImportColumns columns={columns} onChangeType={changeType} />

          {dropped.length > 0 ? (
            <p role="alert" className="text-caption text-brand-accent-strong mt-3 font-bold">
              一類最多 20 個欄位，所以這幾欄不會建進去：{dropped.join("、")}
            </p>
          ) : null}

          <button
            type="button"
            onClick={addToDesign}
            className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-4 px-5 py-2 font-bold"
          >
            加進我的設計
          </button>

          <p className="text-caption text-brand-muted mt-2">
            這一步只建欄位。資料要等這份設計存起來之後，在記錄頁用同一個檔案匯入。
          </p>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-3 font-bold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
