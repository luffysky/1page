/**
 * 登入後轉址目標的淨化。
 *
 * 若原樣採用 `?next=` 的值，攻擊者可以做出「看似本站登入頁、登入後跳到釣魚站」
 * 的連結——那就是開放轉址（open redirect）。使用者在真的本站網域上輸入帳密，
 * 然後被送到外部，整個過程沒有任何可疑之處。
 *
 * 規則：只接受單斜線開頭的站內絕對路徑。
 *
 * 特別注意協定相對網址（兩個斜線開頭）：瀏覽器會把它解讀為外部網址，
 * 看起來卻很像站內路徑。這是最常被漏掉的一種。
 */
const INTERNAL_PATH = /^\/(?![/\\])/;

// 控制字元可用來繞過上面的比對，或在轉址標頭中做注入
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function sanitizeNextPath(value: unknown, fallback = "/"): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0) return fallback;

  if (!INTERNAL_PATH.test(raw)) return fallback;
  if (CONTROL_CHARS.test(raw)) return fallback;

  return raw;
}
