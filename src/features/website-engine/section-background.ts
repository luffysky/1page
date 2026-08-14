import type { CSSProperties } from "react";

import { isSafeCssValue } from "./theme";
import type { SectionBackground, SectionBackgroundType } from "./schema";

/**
 * Section 背景的取值與樣式（CR-004 / Phase B BJ）
 *
 * ── 純函式，因為背景是最容易「看起來對但其實壞了」的東西 ──────
 *
 * 背景壞掉的方式很少是白畫面。多半是：
 *   - 遮罩沒生效，白字壓在淺色照片上，看得到但讀不出來
 *   - 漸層兩端只填了一端，於是整塊變成純色，而沒有人發現少了什麼
 *   - 切換型別之後上一種的值還留著，兩層疊在一起
 *
 * 這三件事都可以在這裡用純函式驗，不必開瀏覽器。
 */

/**
 * 選了照片或影片時預設給的遮罩濃度。
 *
 * ⚠️ 不是 0。
 *
 * 從 0 開始的話，第一眼看到的是「照片很漂亮、字有點看不清楚」，
 * 而那個「有點」在自己的螢幕上通常還讀得出來——因為看的人
 * 已經知道那行字寫什麼。真正讀不出來的是別人，在別的螢幕上。
 *
 * 預設壓一層，要拿掉是一個明確的動作。
 */
export const DEFAULT_MEDIA_OVERLAY = 0.4;

/** 漸層預設由上往下（CSS 的 180deg） */
export const DEFAULT_GRADIENT_ANGLE = 180;

/** 空的背景。切換型別時用它當基準，才不會把上一種的值帶著走 */
export const EMPTY_BACKGROUND: SectionBackground = { type: "none" };

/**
 * 這個背景實際上會畫出東西嗎。
 *
 * ⚠️ 型別選了 `image` 但還沒挑圖，等於沒有背景。
 *
 * 不分辨的話，編輯器會顯示「已設定背景」而畫面上什麼都沒有——
 * 使用者會以為是壞了，然後開始亂改別的東西。
 */
export function hasVisibleBackground(background: SectionBackground | undefined): boolean {
  if (!background || background.type === "none") return false;

  switch (background.type) {
    case "color":
      return Boolean(background.color);
    case "gradient":
      return Boolean(background.gradientFrom && background.gradientTo);
    case "image":
      return Boolean(background.imageUrl);
    case "video":
      // 影片還沒挑，但有封面圖的話仍然畫得出東西
      return Boolean(background.videoUrl || background.imageUrl);
    default:
      return false;
  }
}

/**
 * 設定不完整的地方。回傳給編輯器顯示，不是拋錯。
 *
 * 「還沒填完」與「填錯了」是兩件事。前者在編輯過程中隨時都成立，
 * 拋錯的話使用者連挑第二個顏色的機會都沒有。
 */
export function backgroundWarnings(background: SectionBackground | undefined): string[] {
  if (!background || background.type === "none") return [];

  const warnings: string[] = [];

  if (background.type === "color" && !background.color) {
    warnings.push("還沒選顏色，這一塊會照原本的底色顯示。");
  }

  if (background.type === "gradient") {
    if (!background.gradientFrom || !background.gradientTo) {
      warnings.push("漸層要兩個顏色才成立，現在只填了一端。");
    }
  }

  if (background.type === "image" && !background.imageUrl) {
    warnings.push("還沒選圖片。");
  }

  if (background.type === "video") {
    if (!background.videoUrl) warnings.push("還沒選影片。");
    if (!background.imageUrl) {
      /*
       * 這一條特別重要。
       *
       * 影片還在載、或訪客開了「減少動態效果」時，看到的就是封面。
       * 沒有封面的話那一塊是全黑，而文字浮在全黑上——
       * 看起來像網站壞了，而不是像設計。
       */
      warnings.push("建議也選一張封面圖：影片還沒載完、或訪客關掉動態效果時，看到的是它。");
    }
  }

  if (
    (background.type === "image" || background.type === "video") &&
    (background.overlay ?? 0) === 0
  ) {
    warnings.push("沒有遮罩。照片上的字很容易看不清楚——尤其在比較亮的螢幕上。");
  }

  return warnings;
}

/**
 * 換背景型別時，把不屬於新型別的值清掉。
 *
 * ⚠️ 保留另一種**媒體**的值（圖片與影片互相保留），因為
 * 「先看看圖片、再換影片試試、再換回來」是真的會發生的比較行為，
 * 而每次切換都要重挑一次的話沒有人會去比較。
 *
 * 但顏色與漸層不保留：它們與媒體疊在一起會變成兩層背景，
 * 而使用者看到的是一個他沒設定過的結果。
 */
export function switchBackgroundType(
  background: SectionBackground | undefined,
  type: SectionBackgroundType,
): SectionBackground {
  const current = background ?? EMPTY_BACKGROUND;

  switch (type) {
    case "none":
      return { type: "none" };
    case "color":
      return { type: "color", color: current.color };
    case "gradient":
      return {
        type: "gradient",
        gradientFrom: current.gradientFrom,
        gradientTo: current.gradientTo,
        gradientAngle: current.gradientAngle ?? DEFAULT_GRADIENT_ANGLE,
      };
    case "image":
    case "video":
      return {
        type,
        imageUrl: current.imageUrl,
        videoUrl: current.videoUrl,
        overlay: current.overlay ?? DEFAULT_MEDIA_OVERLAY,
        blur: current.blur ?? 0,
      };
    default:
      return { type: "none" };
  }
}

/**
 * 底層那一格的 inline style。
 *
 * ⚠️ 不安全的值一律略過該項，而不是略過整個背景——
 * 與 `themeToCssVars` 同一個判斷：失敗要盡量小。
 *
 * 圖片走 CSS 的 `background-image` 而不是 `<img>`：
 * 這是裝飾，不是內容，不該進到無障礙樹裡，也不需要 alt。
 */
export function backgroundLayerStyle(background: SectionBackground): CSSProperties {
  const style: CSSProperties = {};

  if (background.type === "color" && background.color && isSafeCssValue(background.color)) {
    style.backgroundColor = background.color;
  }

  if (background.type === "gradient") {
    const from = background.gradientFrom;
    const to = background.gradientTo;

    if (from && to && isSafeCssValue(from) && isSafeCssValue(to)) {
      const angle = background.gradientAngle ?? DEFAULT_GRADIENT_ANGLE;
      style.backgroundImage = `linear-gradient(${angle}deg, ${from}, ${to})`;
    }
  }

  if (background.type === "image" && background.imageUrl) {
    /*
     * 網址進 `url()` 之前要包引號並逸出。
     *
     * schema 已經限定只能是我們自己的媒體網域，所以這裡不會有惡意值——
     * 但那是**兩個檔案之間的約定**，而約定會在有人加第二條寫入路徑時失效。
     * 逸出的成本是一行。
     */
    style.backgroundImage = `url("${background.imageUrl.replace(/["\\]/g, "\\$&")}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }

  const blur = background.blur ?? 0;
  if (blur > 0 && (background.type === "image" || background.type === "video")) {
    style.filter = `blur(${blur}px)`;
    /*
     * 模糊會把邊緣糊掉，露出底下的顏色。放大一點蓋過去。
     *
     * 這是模糊背景一定會遇到的事，而它的表現是「四周有一圈淡淡的框」——
     * 看得出來怪，但很難說出哪裡怪。
     */
    style.transform = `scale(${1 + blur / 100})`;
  }

  return style;
}

/**
 * 遮罩那一層。回傳 null 代表不需要這一層。
 *
 * ⚠️ 顏色本身來自 tokens.css 的 `--color-brand-scrim`，這裡只決定**濃度**。
 *
 * 寫死一個 `rgb(0 0 0 / x)` 的話，日後想把遮罩調成帶一點暖色
 * （與品牌底色同一個方向）就得回來改程式碼，而設計數值的唯一歸屬地
 * 應該是 tokens.css。`opacity` 是連續值，類別表達不了，所以留在 inline。
 */
export function overlayStyle(background: SectionBackground): CSSProperties | null {
  const overlay = background.overlay ?? 0;
  if (overlay <= 0) return null;
  if (background.type !== "image" && background.type !== "video") return null;

  return {
    backgroundColor: "var(--color-brand-scrim-solid)",
    opacity: Math.min(overlay, 1),
  };
}
