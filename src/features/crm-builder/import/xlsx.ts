import { type Sheet } from "./csv";

/**
 * 讀 .xlsx（CR-003-5 匯入）
 *
 * ── 為什麼不裝套件 ────────────────────────────────────────────
 *
 * 整個專案只有十個執行期依賴，加一個是一個真實的決定。
 * 最常見的那個 xlsx 套件在 npm 上已經標為 deprecated 且有過 CVE，
 * 而我們要的只是「把第一張工作表讀成格子」——不寫入、不算公式、
 * 不管樣式。那件事用瀏覽器原生的 `DecompressionStream` 就做得到。
 *
 * ── .xlsx 是什麼 ──────────────────────────────────────────────
 *
 * 一個 ZIP，裡面是 XML：
 *   xl/workbook.xml          有哪幾張工作表
 *   xl/sharedStrings.xml     所有字串放在這裡，儲存格只存索引
 *   xl/worksheets/sheet1.xml 儲存格本身
 *
 * ⚠️ 只讀**第一張**工作表。多張的時候不猜是哪一張——
 * 猜錯的話使用者會看到一整份不認識的資料，而他不會想到是這個原因。
 *
 * ── 讀不動就大聲說 ────────────────────────────────────────────
 *
 * .xls（2007 以前的舊格式）根本不是 ZIP，這裡讀不了，也不假裝讀得了。
 * 回傳 null，讓上層說「請在 Excel 裡另存成 .xlsx 或 .csv」。
 */

interface ZipEntry {
  name: string;
  /** 0 = 直接存、8 = deflate。其餘（加密、bzip2）不支援 */
  method: number;
  data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

/**
 * 掃過每一個 local file header。
 *
 * 刻意不走中央目錄。走本地標頭的代價是遇到「大小寫在資料後面」
 * （streaming 產生的檔案，旗標 bit 3）就讀不到長度——那種檔案這裡
 * 會停下來回傳已經讀到的部分，而不是讀出一堆垃圾。
 */
function readZip(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && readU32(bytes, offset) === LOCAL_HEADER) {
    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;

    // bit 3：長度寫在資料後面。沒有長度就沒辦法知道這一筆到哪裡結束
    if ((flags & 0x08) !== 0 || compressedSize === 0) break;

    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.push({ name, method, data: bytes.subarray(dataStart, dataStart + compressedSize) });
    offset = dataStart + compressedSize;
  }

  return entries;
}

async function inflate(entry: ZipEntry): Promise<string | null> {
  if (entry.method === 0) return new TextDecoder().decode(entry.data);
  if (entry.method !== 8) return null;

  try {
    const stream = new Blob([entry.data as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  } catch {
    // 壞掉的檔案。回 null，上層會說「這個檔案讀不了」——比丟例外好，
    // 因為使用者要的是下一步怎麼辦，不是堆疊追蹤
    return null;
  }
}

/** XML 實體。只有這五個是規範裡的，其餘照抄 */
function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * sharedStrings.xml 裡每個 `<si>` 是一個字串。
 *
 * ⚠️ 一個 `<si>` 裡可能有好幾個 `<t>`（帶格式的字串會被切成好幾段：
 * 粗體的那幾個字自成一段）。只取第一個 `<t>` 的話，
 * 「王小明（重要客戶）」會變成「王小明」——少掉的部分沒有任何提示。
 */
function parseSharedStrings(xml: string): string[] {
  const items: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const pieces = [...match[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((piece) => piece[1]!);
    items.push(unescapeXml(pieces.join("")));
  }
  return items;
}

/** `B7` → 1（第二欄）。欄名是 26 進位，超過 Z 之後是 AA、AB…… */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * 一張工作表的格子。
 *
 * ⚠️ 空的儲存格**不會出現在 XML 裡**。所以一定要照 `r="B7"` 的欄號放，
 * 不能照出現順序推——照順序的話，中間留白的那一列會整列往左移，
 * 而畫面上看起來只是「這一列的資料錯位了」。
 */
function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];

    for (const cellMatch of rowMatch[1]!.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]!;
      const body = cellMatch[2]!;
      const reference = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";

      let value = "";
      if (type === "inlineStr") {
        value = unescapeXml(
          [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((piece) => piece[1]!).join(""),
        );
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        // t="s" 代表 <v> 裡是 sharedStrings 的索引，不是值本身
        value = type === "s" ? (shared[Number(raw)] ?? "") : unescapeXml(raw);
      }

      const index = reference ? columnIndex(reference) : cells.length;
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }

    rows.push(cells);
  }

  return rows;
}

/**
 * 讀第一張工作表。讀不動回 null。
 *
 * 回傳的形狀與 CSV 那條路完全一樣（`Sheet`），所以後面的型別猜測、
 * 對應介面、驗證全部共用——匯入的來源有兩種，處理只有一套。
 */
export async function readXlsx(buffer: ArrayBuffer): Promise<Sheet | null> {
  const entries = readZip(buffer);

  /*
   * 不另外檢查「有沒有讀到任何一筆」——找不到工作表的那一條就是同一件事。
   * 原本有一行 `if (entries.length === 0) return null`，故意拿掉它測試
   * 照樣全綠：它從來沒有擋過任何東西，因為下面那條先擋掉了。
   */
  const sheetEntry = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))[0];
  if (!sheetEntry) return null;

  const sheetXml = await inflate(sheetEntry);
  if (!sheetXml) return null;

  const stringsEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const shared = stringsEntry ? parseSharedStrings((await inflate(stringsEntry)) ?? "") : [];

  const table = parseSheet(sheetXml, shared)
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (table.length === 0) return null;

  const rawHeaders = table[0]!;
  const headers = rawHeaders.map((header, index) => header || `第 ${index + 1} 欄`);

  return {
    headers,
    rows: table.slice(1).map((cells) => headers.map((_, index) => cells[index] ?? "")),
  };
}
