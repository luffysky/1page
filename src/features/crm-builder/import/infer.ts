import { CRM_LIMITS, type CrmFieldType } from "../schema";

import type { Sheet } from "./csv";

/**
 * 從一欄資料猜它是什麼型別（CR-003-5 匯入）
 *
 * ── 猜錯不是問題，猜錯而不說才是 ──────────────────────────────
 *
 * 這裡不追求猜得準。追求的是**每一次猜都說得出理由，而且使用者改得掉**。
 * 使用者的話是「值的類別看有沒有辦法正確判斷或者讓使用者後面可以修改」——
 * 後半句才是規格：猜完之後那份結果是可編輯的草稿，不是既成事實。
 *
 * 所以每一欄回傳的不只是型別，還有 `reason`（畫面上直接顯示給人看）
 * 與 `confidence`（低的那些預設就攤開來讓人確認）。
 *
 * ── 幾個真的會咬人的地方 ──────────────────────────────────────
 *
 * 1. 電話號碼是數字。`0912345678` 存成 number 之後前面那個 0 不見了，
 *    而且**看起來完全正常**——912345678 也是一串數字。
 *    所以有前導零的、或長到不像金額數量的，一律當文字。
 *
 * 2. Excel 的日期不是 ISO。`2026/8/18`、`2026.08.18` 都很常見，
 *    而 `recordSchemaFor` 的 date 只收 `YYYY-MM-DD`。
 *    猜成日期就得負責把值轉過去（見 normaliseValue），
 *    不然畫面上會說「這一欄是日期」然後每一列都匯入失敗。
 *
 * 3. 反覆出現的少數幾個值才是下拉選單。全都不一樣的（名字、Email）
 *    不是——那會產生一個有兩百個選項的下拉，比文字框還難用。
 */

export interface ColumnInference {
  header: string;
  type: CrmFieldType;
  /** 只有 select 用得到 */
  options: string[];
  /**
   * 這個猜測**猜錯的話會有代價**，請使用者看一眼。
   *
   * ⚠️ 不是「我不確定」。第一版標的是不確定，結果六欄裡有三欄掛著
   * 「不太確定，請看一下」——而一個永遠亮著的警告等於沒有警告，
   * 使用者只會一路按到底，然後漏掉真正該看的那一欄。
   *
   * 現在的規則是「猜錯會不會弄丟或擋掉資料」：
   *   0 / 1 猜成勾選     會 —— 那可能是數量，變成是／否就沒了
   *   樣本太少的下拉      會 —— 選項白名單會擋掉以後才出現的值
   *   看不出規律當文字    不會 —— 文字什麼都收得下，沒有東西會不見
   *   整欄空白當文字      不會 —— 沒有東西可以弄丟
   */
  needsReview: boolean;
  /** 一句話，直接顯示在畫面上。使用者要靠它決定要不要改 */
  reason: string;
  /** 有填的格數。0 代表整欄空白 */
  filled: number;
  /** 前幾個實際的值，讓使用者對照著看 */
  samples: string[];
}

const BOOLEAN_WORDS = new Set([
  "是",
  "否",
  "有",
  "無",
  "y",
  "n",
  "yes",
  "no",
  "true",
  "false",
  "✓",
  "v",
  "x",
]);

const TRUE_WORDS = new Set(["是", "有", "y", "yes", "true", "✓", "v", "1"]);

/** `2026-08-18` / `2026/8/18` / `2026.08.18` 都算 */
const DATE_LIKE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

/** 千分位與貨幣符號要先脫掉再判斷。`NT$ 1,200` 在真實的表裡到處都是 */
const CURRENCY = /[$＄¥￥€£,\s]/g;

/**
 * 幣別代碼寫在符號前面（`NT$`、`US$`、`TWD`）。
 *
 * 只脫**開頭**的、而且只脫這幾個已知的。放寬成「脫掉所有字母」的話，
 * `A123` 這種型號會變成數字 123——那是安靜的資料損壞。
 */
const CURRENCY_CODE = /^(nt|us|twd|rmb|cny|jpy|hkd|hk|eur|gbp)\$?/i;

const bareNumber = (value: string) => value.replace(CURRENCY_CODE, "").replace(CURRENCY, "");

function isNumeric(value: string): boolean {
  const bare = bareNumber(value);
  if (bare === "" || bare === "-") return false;
  return Number.isFinite(Number(bare));
}

/**
 * ⚠️ 這一條是「不要把電話存成數字」。
 *
 * 判斷的是**字面上的形狀**，不是數值大小：前導零、或超過 9 位數字。
 * 身分證、統編、郵遞區號、訂單編號全都落在這裡，而它們共同的特徵是
 * 「長得像數字，但沒有人會對它做加減」。
 */
function looksLikeIdentifier(value: string): boolean {
  const bare = bareNumber(value);
  if (!/^\d+$/.test(bare)) return false;
  return (bare.length > 1 && bare.startsWith("0")) || bare.length >= 9;
}

function truncateSamples(values: readonly string[]): string[] {
  return values.slice(0, 3);
}

/**
 * 猜一欄。
 *
 * 順序是有意義的：先排掉「看起來像數字但不是數字」的，再依
 * 日期 → 勾選 → 數字 → 下拉 → 多行 → 單行 依序試。
 * 每一條都要求**全部有填的值都符合**，不是多數決——
 * 多數決會讓一欄裡混著兩三個匯不進去的值，而那些值就是使用者
 * 最需要看到的例外。
 */
export function inferColumn(header: string, rawValues: readonly string[]): ColumnInference {
  const values = rawValues.map((value) => value.trim()).filter((value) => value.length > 0);
  const samples = truncateSamples(values);
  const base = { header, options: [] as string[], filled: values.length, samples };

  if (values.length === 0) {
    return {
      ...base,
      type: "text",
      needsReview: false,
      reason: "這一欄一格都沒填，猜不出來，先當單行文字。",
    };
  }

  const distinct = [...new Set(values)];

  if (values.every((value) => DATE_LIKE.test(value))) {
    return {
      ...base,
      type: "date",
      needsReview: false,
      reason: `${values.length} 格都是年月日的樣子。`,
    };
  }

  if (values.every((value) => BOOLEAN_WORDS.has(value.toLowerCase()))) {
    return {
      ...base,
      type: "checkbox",
      needsReview: false,
      reason: `只有「${distinct.slice(0, 3).join("」「")}」這幾種值，當成勾選。`,
    };
  }

  /*
   * 只有 1 與 0 的欄位。
   *
   * 它可能是旗標，也可能是數量。這裡選勾選但標成低把握——
   * 因為兩種讀法都合理，而合理的歧義就該讓使用者決定。
   */
  if (distinct.length <= 2 && values.every((value) => value === "0" || value === "1")) {
    return {
      ...base,
      type: "checkbox",
      needsReview: true,
      reason: "整欄只有 0 與 1。當成勾選了，如果那其實是數量請改成數字。",
    };
  }

  if (values.some(looksLikeIdentifier)) {
    const example = values.find(looksLikeIdentifier)!;
    return {
      ...base,
      type: "text",
      needsReview: false,
      reason: `像「${example}」這種是編號不是數量，存成數字會掉開頭的 0，所以當文字。`,
    };
  }

  if (values.every(isNumeric)) {
    return { ...base, type: "number", needsReview: false, reason: `${values.length} 格都是數字。` };
  }

  /*
   * 下拉選單：反覆出現的少數幾個值。
   *
   * 三個條件缺一不可——
   *   有重複（distinct < filled）：全都不一樣的是名字，不是選項
   *   數量夠少（<= 上限，且不超過一半）：兩百個選項的下拉沒有人用得下去
   *   每個都夠短（<= 60）：那是 optionSchema 的上限，超過的存不進去
   */
  const shortEnough = distinct.every((value) => value.length <= 60);
  /*
   * 比例而不是固定倍數。
   *
   * 第一版寫的是 `distinct * 2 <= filled`，於是一份只有五列、
   * 三種狀態的真實資料猜不出來——而小檔案正是使用者
   * 第一次試匯入時會拿來用的那種。
   *
   * ⚠️ 這裡曾經還有一個 `distinct < filled`（「要有重複」）。
   * 它是死的：全都不重複時比例就是 1，永遠過不了 0.7。
   * 故意拿掉它測試照樣全綠，才發現那一行從來沒有擋過任何東西。
   */
  const fewEnough =
    distinct.length <= CRM_LIMITS.optionsPerField && distinct.length <= values.length * 0.7;

  if (fewEnough && shortEnough) {
    return {
      ...base,
      options: distinct,
      type: "select",
      /*
       * 樣本不夠紮實的下拉要人看一眼：選項是白名單，
       * 之後出現一個沒在名單上的值會被擋下來，而那時候沒有人記得
       * 這份名單是三列資料猜出來的。
       */
      needsReview: !(values.length >= 4 && distinct.length * 2 <= values.length),
      reason: `${values.length} 格裡只出現 ${distinct.length} 種值，做成下拉選單。`,
    };
  }

  if (values.some((value) => value.length > 80 || value.includes("\n"))) {
    return { ...base, type: "textarea", needsReview: false, reason: "有幾格很長，用多行文字。" };
  }

  // 文字是安全的預設：什麼都收得下，所以猜「錯」也不會弄丟東西
  return { ...base, type: "text", needsReview: false, reason: "看不出特別的規律，當單行文字。" };
}

export function inferSheet(sheet: Sheet): ColumnInference[] {
  return sheet.headers.map((header, index) =>
    inferColumn(
      header,
      sheet.rows.map((row) => row[index] ?? ""),
    ),
  );
}

/**
 * 把一格原始文字轉成該型別存得進去的樣子。
 *
 * ⚠️ 這一步不能省。猜成日期卻把 `2026/8/18` 原封不動送進
 * `recordSchemaFor`，畫面上會顯示「這一欄是日期」然後每一列都匯入失敗——
 * 使用者完全不知道自己做錯了什麼，因為他什麼都沒做錯。
 *
 * 轉不動的**原樣回傳**，交給 schema 去擋。在這裡自己吞掉的話，
 * 錯誤會從「第 12 列的日期看不懂」變成「莫名其妙少了一列」。
 */
export function normaliseValue(type: CrmFieldType, raw: string): string {
  const value = raw.trim();
  if (value === "") return "";

  switch (type) {
    case "date": {
      const match = DATE_LIKE.exec(value);
      if (!match) return value;
      const [, year, month, day] = match;
      return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
    }
    case "number": {
      const bare = bareNumber(value);
      return Number.isFinite(Number(bare)) && bare !== "" ? bare : value;
    }
    case "checkbox":
      return TRUE_WORDS.has(value.toLowerCase()) ? "true" : "false";
    default:
      return value;
  }
}

/**
 * 使用者自己把某一欄改成「下拉選單」時，選項從哪裡來。
 *
 * ⚠️ 猜測結果裡的 `options` 只有在**猜成 select 時**才有值。
 * 少了這個函式，使用者手動改成下拉之後會得到一個沒有選項的欄位——
 * 而 schema 會擋（「下拉選單至少要有一個選項」），
 * 表現是「改了型別，然後整份匯入按不下去」，畫面上沒有說為什麼。
 */
export function optionsForColumn(
  values: readonly string[],
): { ok: true; options: string[] } | { ok: false; error: string } {
  const distinct = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  if (distinct.length === 0) {
    return { ok: false, error: "這一欄一格都沒填，做不出下拉選單的選項。" };
  }
  if (distinct.length > CRM_LIMITS.optionsPerField) {
    return {
      ok: false,
      error: `這一欄有 ${distinct.length} 種不同的值，超過下拉選單的 ${CRM_LIMITS.optionsPerField} 個選項上限。`,
    };
  }
  const tooLong = distinct.find((value) => value.length > 60);
  if (tooLong) {
    return { ok: false, error: `「${tooLong.slice(0, 12)}…」太長了，做不成選項。` };
  }

  return { ok: true, options: distinct };
}
