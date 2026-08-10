import { ImageResponse } from "next/og";

import { BRAND_COLORS } from "@/config/brand-colors";

/**
 * Maskable 圖示。
 *
 * ⚠️ 這是 route handler，不是 Next 的 icon 檔案慣例。
 *
 * 慣例只認 `icon.tsx` / `apple-icon.tsx` 等固定檔名——
 * 第一版寫成 `app/icon-maskable.tsx`，它不會產生任何路由，
 * manifest 指過去直接 404。build 輸出的路由清單裡看得出來，
 * 但如果只看「build 成功」是不會發現的。
 *
 * Android 會把圖示裁成各種形狀（圓形、方形、水滴），內容必須留在
 * 中央約 80% 的安全區內。直接沿用一般圖示會被裁掉邊角，
 * 而那只有在真機安裝後才看得出來。
 */
export const dynamic = "force-static";

export function GET() {
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
        // 安全區：字級縮到約一般圖示的 70%，四周留白供裁切
        fontSize: 240,
        fontWeight: 900,
      }}
    >
      1
    </div>,
    { width: 512, height: 512 },
  );
}
