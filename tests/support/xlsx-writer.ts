/**
 * 產一份真的 .xlsx（測試用）
 *
 * ── 為什麼要自己寫，而不是放一個二進位檔進 repo ────────────────
 *
 * 放檔案的話，測試失敗時沒有人看得出裡面是什麼；改一格資料要
 * 開 Excel 存檔再 commit 一坨看不懂的位元組。而讀檔那一端
 * （`import/xlsx.ts`）正好也是自己寫的——**用同一個人寫的兩邊互相驗證
 * 是假的綠燈**，所以這裡刻意照 ZIP 與 SpreadsheetML 的規格寫：
 * 正確的 CRC32、正確的中央目錄、真的 deflate。
 *
 * ⚠️ 它仍然只是一份**測試用**的 xlsx：沒有 workbook 的關聯檔（.rels）、
 * 沒有樣式，欄數只支援到 Z。要的是「規格上正確到足以驗讀檔那一端」，
 * 不是「Excel 打得開」——後者沒有驗過，就不要在這裡宣稱。
 */

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Part {
  name: string;
  text: string;
  /** 存的方式。刻意兩種都要用得到——真的 .xlsx 兩種都會出現 */
  store?: boolean;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

async function zip(parts: Part[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: number[] = [];
  const central: number[] = [];

  for (const part of parts) {
    const raw = encoder.encode(part.text);
    const body = part.store ? raw : await deflateRaw(raw);
    const name = encoder.encode(part.name);
    const method = part.store ? 0 : 8;
    const crc = crc32(raw);
    const offset = chunks.length;

    chunks.push(
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(body.length),
      ...u32(raw.length),
      ...u16(name.length),
      ...u16(0),
      ...name,
      ...body,
    );

    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(body.length),
      ...u32(raw.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    );
  }

  const centralOffset = chunks.length;
  chunks.push(
    ...central,
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(parts.length),
    ...u16(parts.length),
    ...u32(central.length),
    ...u32(centralOffset),
    ...u16(0),
  );

  return new Uint8Array(chunks);
}

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * 0 → A、25 → Z、26 → AA。
 *
 * ⚠️ 一定要支援兩個字母。只做到 Z 的話，讀檔那一端的 26 進位
 * 算錯了也沒有任何測試會紅——而算錯的後果是第 27 欄的值蓋掉第 2 欄，
 * 在前 20 欄之內就開始安靜地損壞資料。
 */
function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/**
 * 把一份格子寫成 .xlsx。
 *
 * 字串一律走 sharedStrings（Excel 自己就是這樣存的），數字直接寫 `<v>`。
 * 空格子**不寫進 XML**——那正是讀檔那一端最容易錯的地方，
 * 所以 fixture 一定要重現它。
 */
export interface XlsxOptions {
  /**
   * 把每個字串切成兩段 `<t>`。
   *
   * 真實的 Excel 只要一格裡有一部分是粗體，那一格就會變成這種
   * 「rich text」——一個 `<si>` 裡好幾個 `<r><t>`。只讀第一個 `<t>` 的話
   * 「王小明（重要客戶）」會變成「王」，而少掉的部分沒有任何提示。
   */
  richText?: boolean;
}

export async function makeXlsx(rows: string[][], options: XlsxOptions = {}): Promise<Uint8Array> {
  const shared: string[] = [];
  const indexOf = (value: string) => {
    const existing = shared.indexOf(value);
    if (existing !== -1) return existing;
    shared.push(value);
    return shared.length - 1;
  };

  const sheetRows = rows
    .map((cells, rowIndex) => {
      const body = cells
        .map((cell, columnIndex) => {
          if (cell === "") return "";
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          const numeric = cell !== "" && Number.isFinite(Number(cell));
          return numeric
            ? `<c r="${reference}"><v>${cell}</v></c>`
            : `<c r="${reference}" t="s"><v>${indexOf(cell)}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${body}</row>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const sharedXml = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared
    .map((value) => {
      if (!options.richText) return `<si><t>${escapeXml(value)}</t></si>`;
      const head = escapeXml(value.slice(0, 1));
      const tail = escapeXml(value.slice(1));
      return `<si><r><t>${head}</t></r><r><t>${tail}</t></r></si>`;
    })
    .join("")}</sst>`;

  return zip([
    // mimetype 類的小檔案 Excel 也是直接存的，所以這裡刻意不壓縮
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
      store: true,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="工作表1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    { name: "xl/sharedStrings.xml", text: sharedXml },
    { name: "xl/worksheets/sheet1.xml", text: sheetXml },
  ]);
}
