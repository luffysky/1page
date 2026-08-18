import { ImageResponse } from "next/og";

import { BRAND_COLORS } from "@/config/brand-colors";

/**
 * iOS 加到主畫面時用的圖示。
 *
 * ⚠️ iOS **不讀 manifest 的 icons**，它只認 `<link rel="apple-touch-icon">`。
 * 沒有這個檔案的話，`layout.tsx` 裡的 `appleWebApp: { capable: true }`
 * 只做完一半：使用者「加到主畫面」，拿到的是一張**網頁截圖**當圖示。
 * 那件事在桌機上完全看不出來，Lighthouse 也不會說——
 * 只有真的用 iPhone 加一次才知道。
 *
 * ⚠️ 這裡不做圓角。iOS 自己會套遮罩，我們再切一次的話，
 * 圓角外面那圈會變成黑邊（背景是透明的）。
 * 一般圖示（`icon.tsx`）要圓角，因為那是瀏覽器分頁與 manifest 用的，
 * 沒有人會幫它切。
 *
 * 180×180 是 iOS 現行的建議尺寸。
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_COLORS.ink,
        color: BRAND_COLORS.paper,
        fontSize: 120,
        fontWeight: 900,
      }}
    >
      1
    </div>,
    size,
  );
}
