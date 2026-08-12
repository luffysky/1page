import type { ThemeConfig } from "../schema";

/**
 * Theme 預設集（Spec §12 `defaultTheme` / §14 / §15）
 *
 * ⚠️ 這個檔案裡的色碼**不是本站的設計數值**，是「被預覽的客戶網站」的主題內容。
 * 本站自己的顏色一律來自 tokens.css，兩個系統之間沒有交集
 * （見 site-classes.ts 的說明）。`no-hardcoded-design-values` 因此列了具名例外。
 *
 * ── 為什麼 accent 是每個主題各自一組，而不是全站共用一組 ──────
 *
 * accent 會當成文字用（HeroEditorial 的 eyebrow、ContactSimple 的連結），
 * 因此必須對背景達到 WCAG AA 的 4.5:1。
 *
 * 而一個色值不可能同時對淺底與深底都達標：
 *   對 #FFF 達 4.5:1 需要相對亮度 ≤ 0.166
 *   對 #17140F 達 4.5:1 需要相對亮度 ≥ 0.224
 * 兩個條件互斥。所以共用一組 accent 的做法，
 * 結果一定是「深色主題選了某個 accent 之後字看不清楚」。
 *
 * 折衷是：accent 的 **id 共用、色值各自調**。
 * 訪客切換主題時保留他選的色系（陶土還是墨藍），
 * 但實際套用的是那個主題調好的版本。
 *
 * 對比度不是靠肉眼判斷——`themes.test.ts` 對每一組配對實算。
 */

export const THEME_IDS = ["warm", "luxury", "minimal"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** 1C 的殼就寫著這三個選項的文案，這裡是它們真正的實作 */
export const ACCENT_IDS = ["clay", "ink", "moss", "plum"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const ACCENT_LABELS: Record<AccentId, string> = {
  clay: "陶土",
  ink: "墨藍",
  moss: "苔綠",
  plum: "酒紅",
};

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  /**
   * accent 以外的主題內容。
   * accent 由 `resolveTheme` 從下方的 accents 表補上——
   * 少了那一步的 ThemeConfig 是不完整的，所以這裡刻意不是完整型別。
   */
  base: Omit<ThemeConfig, "colors"> & { colors: Omit<ThemeConfig["colors"], "accent"> };
  accents: Record<AccentId, string>;
}

/*
 * 字型只使用系統上必定存在的家族。
 *
 * 本站自己的字體是用 next/font 載入的，家族名稱是編譯期產生的雜湊，
 * 寫死在這裡會指到一個不存在的名字。而被預覽的網站終究是別人的網站，
 * 用系統字呈現「這個主題是襯線還是無襯線」已經足夠，
 * 為了預覽再多載幾套字體只會拖慢首頁。
 */
const SERIF = "Georgia, Times New Roman, serif";
const SANS = "Helvetica Neue, Arial, sans-serif";

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "warm",
    label: "暖一點",
    description: "米白底、襯線標題。適合手作、餐飲與生活風格的品牌。",
    base: {
      colors: {
        background: "#FBF6EF",
        surface: "#F2E7D8",
        text: "#241B14",
        muted: "#6A5748",
      },
      typography: { heading: SERIF, body: SANS },
      radius: "14px",
      spacingScale: "1rem",
    },
    accents: {
      clay: "#A8452B",
      ink: "#2F4C7A",
      moss: "#3F6B43",
      plum: "#8A2F4E",
    },
  },
  {
    id: "luxury",
    label: "精品一點",
    description: "深色底、小圓角。適合設計、選物與高單價服務。",
    base: {
      colors: {
        background: "#17140F",
        surface: "#221D17",
        text: "#F2E9DC",
        muted: "#A79683",
      },
      typography: { heading: SERIF, body: SANS },
      radius: "4px",
      spacingScale: "1.25rem",
    },
    accents: {
      clay: "#E08A6A",
      ink: "#8FB0DE",
      moss: "#8FC095",
      plum: "#E28BA6",
    },
  },
  {
    id: "minimal",
    label: "更極簡",
    description: "純白底、無襯線。適合產品、顧問與需要大量留白的內容。",
    base: {
      colors: {
        background: "#FFFFFF",
        surface: "#F4F4F5",
        text: "#18181B",
        muted: "#52525B",
      },
      typography: { heading: SANS, body: SANS },
      radius: "8px",
      spacingScale: "1rem",
    },
    accents: {
      clay: "#B03A1E",
      ink: "#1D4ED8",
      moss: "#146B32",
      plum: "#A21B57",
    },
  },
];

const PRESET_BY_ID = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]));

export function getThemePreset(id: ThemeId): ThemePreset {
  const preset = PRESET_BY_ID.get(id);
  if (!preset) {
    // THEME_PRESETS 與 ThemeId 同源，理論上不可能發生。
    // 留一個明確錯誤，好過回傳 undefined 讓呼叫端在渲染時才炸。
    throw new Error(`Unknown theme preset: ${id}`);
  }
  return preset;
}

/** 主題 + accent → 完整 ThemeConfig。這是兩者唯一的組合點 */
export function resolveTheme(themeId: ThemeId, accentId: AccentId): ThemeConfig {
  const preset = getThemePreset(themeId);

  return {
    ...preset.base,
    colors: { ...preset.base.colors, accent: preset.accents[accentId] },
  };
}
