/**
 * CSV / TSV 解析（CR-003-5 匯入）
 *
 * ── 為什麼自己寫，而不是裝一個 ────────────────────────────────
 *
 * 匯入的資料**一定要驗**——欄位型別、選項白名單、必填，
 * 全部都得再過一次我們自己的 schema。既然驗證跑不掉，
 * 那「把一串字切成格子」這件事就沒有必要換一個依賴進來。
 *
 * 而且這裡的失敗模式很具體：分隔符在引號裡、換行在引號裡、Excel 的 BOM。
 * 那三件事用 `split(",")` 一定錯，而錯的樣子是**安靜的**——
 * 一列變兩列、一格變兩格，畫面上看起來只是「資料有點怪」。
 * 自己寫才有辦法一條一條釘住。
 *
 * ── 不做的事 ──────────────────────────────────────────────────
 *
 * 不猜編碼。UTF-8（含 BOM）之外一律當作 UTF-8 讀——猜錯的話
 * 使用者會看到一整片亂碼，而那比「請存成 UTF-8」難懂得多。
 */

export interface Sheet {
  /** 第一列。空白的欄名會補成「第 N 欄」，不留空 */
  headers: string[];
  /** 其餘每一列。長度一律補齊到 headers.length */
  rows: string[][];
}

/**
 * 猜分隔符。
 *
 * ⚠️ 只看**第一列**，而且只在三個候選之間選：逗號、Tab、分號。
 * 分號是歐洲版 Excel 的預設（那裡逗號是小數點），
 * 而使用者不會知道自己的檔案是哪一種。
 *
 * 猜法是「哪一個在第一列出現最多次」——不是完美，但錯的時候
 * 使用者一眼就看得出來（整列變成一格），而不是安靜地錯。
 */
export function detectDelimiter(firstLine: string): string {
  const candidates = [",", "\t", ";"];
  let best = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    // 引號裡的分隔符不算——不然「台北市, 大安區」會讓逗號贏
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const char = firstLine[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/**
 * 把整份文字切成格子。
 *
 * 依 RFC 4180：欄位可以用雙引號包起來，裡面可以有分隔符與換行，
 * 兩個連續的雙引號代表一個字面上的雙引號。
 */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  // Excel 存 UTF-8 CSV 時會加 BOM。不去掉的話第一個欄名會多一個看不見的字元，
  // 而「客戶」與「﻿客戶」在畫面上一模一樣、比對起來不相等
  const clean = text.replace(/^﻿/, "");
  if (clean.trim().length === 0) return [];

  const sep = delimiter ?? detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          // `""` 是一個字面上的引號
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // CRLF 的 CR 直接跳過；單獨的 CR 當作沒有（舊 Mac 換行早已絕跡）
    } else {
      field += char;
    }
  }

  // 最後一格／最後一列。檔案結尾沒有換行是常態
  row.push(field);
  rows.push(row);

  /*
   * 整列都是空字串的丟掉。
   *
   * ⚠️ 只丟「整列皆空」，不丟「有空格的列」——後者可能是真的有一列
   * 只填了一格，而那是使用者的資料。
   */
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** 每個欄位頭尾的引號已經在解析時處理掉了，這裡只去空白 */
const tidy = (value: string) => value.trim();

export function toSheet(text: string, delimiter?: string): Sheet | null {
  const table = parseDelimited(text, delimiter);
  if (table.length === 0) return null;

  const rawHeaders = table[0]!.map(tidy);

  /*
   * 空白的欄名補成「第 N 欄」。
   *
   * 留空的話，後面的對應介面會出現一個沒有名字的選項，
   * 而使用者分不出那是哪一欄。
   */
  const headers = rawHeaders.map((header, index) => header || `第 ${index + 1} 欄`);

  const rows = table.slice(1).map((cells) =>
    // 長度補齊。少了的話後面每一處都要防 undefined，而那種防禦遲早漏一個
    headers.map((_, index) => tidy(cells[index] ?? "")),
  );

  return { headers, rows };
}
