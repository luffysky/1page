import { ImageResponse } from "next/og";

import { BRAND_COLORS } from "@/config/brand-colors";

/**
 * 應用圖示。
 *
 * 用 ImageResponse 動態產生而非放靜態檔：品牌識別只有一個「1」與
 * Rocket Red，沒有複雜圖形，因此不值得為它維護多個尺寸的 PNG。
 * 顏色與 tokens.css 的品牌值一致。
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        fontSize: 340,
        fontWeight: 900,
        borderRadius: 96,
      }}
    >
      1
    </div>,
    size,
  );
}
