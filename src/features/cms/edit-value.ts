/**
 * 在巢狀結構裡改一個值（CR-004 / Phase B BI）
 *
 * ── 為什麼要有這個檔案 ────────────────────────────────────────
 *
 * 後台的內容編輯器是**照著值的形狀長出來的**，不是為每個 key
 * 各寫一份表單。理由在 `cms-editor.tsx` 的檔頭：那會變成第二份 schema，
 * 而第二份 schema 遲早與 zod 那份分歧。
 *
 * 照形狀長的代價是：改一個欄位時只知道它的**路徑**
 * （`["items", 2, "label"]`），不知道它是誰。所以需要這幾個函式。
 *
 * 全部是純函式，因為這是整個編輯器裡唯一會默默出錯的地方——
 * 少複製一層的話，改 A 會連 B 一起改，而畫面上看起來完全正常。
 */

export type Path = readonly (string | number)[];

/** 路徑上的值。中途遇到不是物件／陣列的東西就回 undefined */
export function getAt(value: unknown, path: Path): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }

  return current;
}

/**
 * 回傳一份新的結構，路徑上的值換成 `next`。
 *
 * ⚠️ 沿路的每一層都要複製。
 *
 * 直接改原本那個物件的話，React 比對前後兩份參照會發現「沒變」，
 * 於是畫面不更新——使用者打字，字沒有出現。
 * 而只複製最外層也不夠：裡面那幾層仍然是同一個參照。
 */
export function setAt<T>(value: T, path: Path, next: unknown): T {
  if (path.length === 0) return next as T;

  const [head, ...rest] = path;

  if (Array.isArray(value)) {
    const index = Number(head);
    const copy = [...value];
    copy[index] = setAt(copy[index], rest, next);
    return copy as T;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return { ...record, [String(head)]: setAt(record[String(head)], rest, next) } as T;
  }

  /*
   * 路徑指到一個不存在的地方。
   *
   * 這在編輯器裡不該發生（路徑是從值本身走出來的），
   * 但安靜地回傳原值會讓那次編輯憑空消失——寧可讓它長出來。
   */
  return (typeof head === "number" ? [] : { [String(head)]: setAt(undefined, rest, next) }) as T;
}

/** 陣列尾端加一項 */
export function appendAt<T>(value: T, path: Path, item: unknown): T {
  const list = getAt(value, path);
  if (!Array.isArray(list)) return value;
  return setAt(value, path, [...list, item]);
}

/** 移掉陣列裡的第 index 項 */
export function removeAt<T>(value: T, path: Path, index: number): T {
  const list = getAt(value, path);
  if (!Array.isArray(list)) return value;
  return setAt(
    value,
    path,
    list.filter((_, i) => i !== index),
  );
}

/**
 * 依現有的一項，做出一個空白的新項。
 *
 * ⚠️ 不複製既有那一項的內容。
 *
 * 複製的話，新增出來的是一份一模一樣的東西，而使用者很容易
 * 只改了一半就存檔——結果網站上出現兩筆長得幾乎一樣的內容。
 * 空白的那一份至少會逼人把每一格都看過。
 *
 * 但**形狀**要照著抄，不然新項少了某個欄位，schema 會擋下整份存檔
 * 而錯誤訊息指向的是一個使用者沒看過的欄位名。
 */
export function blankLike(sample: unknown): unknown {
  if (Array.isArray(sample)) return [];
  if (sample === null) return null;

  switch (typeof sample) {
    case "object":
      return Object.fromEntries(
        Object.entries(sample as Record<string, unknown>).map(([key, item]) => [
          key,
          blankLike(item),
        ]),
      );
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}
