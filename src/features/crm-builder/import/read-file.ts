import { type Sheet, toSheet } from "./csv";
import { readXlsx } from "./xlsx";

/**
 * 讀使用者選的那個檔案（CR-003-5 匯入）
 *
 * ── 在瀏覽器裡讀，不上傳 ──────────────────────────────────────
 *
 * 檔案不離開這台電腦。送到伺服器的只有「對應好之後的那幾列值」。
 * 這不是為了省事：少一條上傳路徑，就少一整類問題（暫存檔、大小上限、
 * 病毒掃描、一個 2GB 的檔案）。而使用者要匯的本來就是自己的客戶名單。
 *
 * ── 讀不動就明講 ──────────────────────────────────────────────
 *
 * 副檔名不看，看內容。`.xls` 改名成 `.xlsx` 是很常見的事——
 * 照副檔名走的話會得到一份空表加一句「匯入成功，0 筆」。
 */

/** 一個檔案最大 5MB。500 筆記錄的 CSV 大概 100KB，這已經很寬鬆 */
const MAX_BYTES = 5 * 1024 * 1024;

export type ReadResult = { ok: true; sheet: Sheet } | { ok: false; error: string };

const XLSX_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

export async function readSpreadsheetFile(file: File): Promise<ReadResult> {
  if (file.size === 0) return { ok: false, error: "這個檔案是空的。" };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "檔案太大了（超過 5MB）。請只留要匯入的那幾欄再存一次。" };
  }

  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 4));
  const isZip = XLSX_SIGNATURE.every((byte, index) => head[index] === byte);

  if (isZip) {
    const sheet = await readXlsx(buffer);
    if (!sheet) {
      return {
        ok: false,
        error: "這個 Excel 檔讀不出內容。請在 Excel 裡「另存新檔」選 CSV（逗號分隔）再試一次。",
      };
    }
    return { ok: true, sheet };
  }

  /*
   * ⚠️ 舊的 .xls 檔（2007 以前）開頭是 D0 CF 11 E0，不是 ZIP。
   *
   * 它是完全不同的格式，這裡讀不了。當成純文字讀的話會得到一整片
   * 亂碼欄名——而使用者會以為是編碼問題，往完全錯的方向找。
   */
  if (head[0] === 0xd0 && head[1] === 0xcf) {
    return {
      ok: false,
      error: "這是舊版的 .xls 檔，讀不了。請在 Excel 裡另存成 .xlsx 或 CSV 再試一次。",
    };
  }

  // UTF-8 以外不猜（見 csv.ts）。BOM 在 toSheet 裡處理
  const sheet = toSheet(new TextDecoder().decode(buffer));
  if (!sheet) return { ok: false, error: "這個檔案裡沒有讀得到的資料。" };

  return { ok: true, sheet };
}
