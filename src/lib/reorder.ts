/**
 * 把清單裡的某一項往上／往下移一格。
 *
 * ── 為什麼這件事要抽成一個共用純函式 ──────────────────────────
 *
 * CR-003-4 的網站編輯器與 CR-003-5 的 CRM 設計器都要「搬動一項」，
 * 而且各自都有三種輸入方式（滑鼠拖曳 / 鍵盤 / 觸控按鈕）。
 * 各寫一份的話會出現六條路徑，而它們會在**同一個邊界條件**上分岔：
 * 已經在第一項時再按上移要怎麼辦。
 *
 * 這裡的答案是**什麼都不做**，而不是繞到另一端。
 * 繞回去的表現是「一直按下移，那一塊突然跳到最上面」——
 * 使用者會以為自己弄壞了什麼。
 *
 * 回傳 `null` 表示「這一步不合法」，讓呼叫端原封不動地保留現狀。
 * 回一份沒改的複本也行，但那樣呼叫端就分不出「移動了」與「沒動」，
 * 於是每一次按鍵都會進一筆 undo 歷史——按十次上移要按十次復原才回得去。
 */
export function moveInOrder<T>(order: readonly T[], item: T, direction: "up" | "down"): T[] | null {
  const index = order.indexOf(item);
  if (index === -1) return null;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return null;

  const next = [...order];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
