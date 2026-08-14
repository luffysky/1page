import { z } from "zod";

import { isAllowedImageUrl } from "@/config/image-sources";

/**
 * SiteConfig Schema（Spec §9 / §10 / §14 / §36）
 *
 * ── 這份 schema 是 Website Engine 的安全邊界 ──────────────────
 *
 * Spec §44 的核心架構決策：
 *   > AI Agent 不生成網站程式碼，AI Agent 生成與修改結構化 SiteConfig。
 *
 * 也就是說，**SiteConfig 是不可信輸入**。它的來源包括 LLM 的輸出與訪客的操作，
 * 兩者都不能假設善意或正確。整條鏈路
 * （Agent → tool call → SiteConfig → SiteRenderer → 畫面）
 * 唯一的把關點就是這裡。
 *
 * Spec §36 對 Preview 的要求：
 *   禁止 arbitrary HTML／禁止 arbitrary JS／禁止 script injection／
 *   URL validation／image source validation
 *
 * 那些規則在此以「型別無法表達不合法的值」的方式落實，
 * 而不是在渲染時才逐一檢查——渲染點會越來越多，檢查遲早漏掉一處。
 */

/* ------------------------------------------------------------------ */
/* 基礎值                                                              */
/* ------------------------------------------------------------------ */

/**
 * CSS 色彩值。
 *
 * ⚠️ 這一條比看起來重要：3B 會把 ThemeConfig 的色彩注入 `--site-*`
 * CSS 自訂屬性。CSS 自訂屬性的值幾乎不受限制，若原樣採用，
 * `red; background-image: url("//evil/x")` 這種字串就能跳出屬性、
 * 插入額外宣告——也就是 CSS 注入。
 *
 * 因此只接受明確列舉的形式，不接受「任何看起來像顏色的東西」。
 */
const cssColor = z
  .string()
  .trim()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.\s,%/]+\)|hsla?\(\s*[\d.\s,%/deg]+\)|[a-zA-Z]{3,20})$/,
    "色彩必須是 hex、rgb()、hsl() 或具名顏色，且不得包含其他 CSS 宣告",
  )
  .max(64);

/**
 * 字型家族名稱。
 *
 * 同樣會進入 CSS 自訂屬性，因此不接受引號、分號與括號——
 * 那些是跳出屬性值所需要的字元。
 */
const fontFamily = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-zA-Z0-9一-鿿 \-,]+$/, "字型名稱只能包含文字、空白、連字號與逗號");

/**
 * 外部連結。
 *
 * 只接受 https 與 mailto。刻意排除：
 *   javascript:  可直接執行腳本
 *   data:        可夾帶 HTML／SVG，等同執行腳本
 *   http:        混合內容，且 2026 年沒有理由還用明文
 */
const externalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "mailto:";
    } catch {
      return false;
    }
  }, "連結只接受 https:// 或 mailto:");

/**
 * 圖片來源（Spec §36 image source validation）
 *
 * 比 externalUrl 更嚴：只認我們自己的媒體網域。理由見 config/image-sources.ts。
 *
 * ⚠️ 這條規則會讀環境變數（媒體網域是部署設定，不是程式常數）。
 * 沒設定媒體網域的環境裡**所有圖片都會被拒絕**——那是刻意的失敗方向：
 * 圖片不顯示看得出來，任意來源全部放行看不出來。
 */
const siteImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isAllowedImageUrl, "圖片只能放在本站的媒體網域上，請先上傳");

/**
 * 影片來源。
 *
 * 與圖片**完全同一條規則**（只認自己的媒體網域），刻意不放寬。
 *
 * 影片其實比圖片更該嚴格：`<video src>` 一樣會叫訪客的瀏覽器去連那個網址，
 * 而影片是持續性的請求，對方拿得到的不只是一次 IP，是整段觀看行為。
 *
 * 命名上分成兩個常數而不是共用一個，是為了讓錯誤訊息說得出是哪一種。
 */
const siteVideoUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isAllowedImageUrl, "影片只能放在本站的媒體網域上，請先上傳");

/** 站內路徑或外部連結 */
const linkTarget = z.union([
  z.string().regex(/^\/(?![/\\])[^\s]*$/, "站內路徑必須以單一斜線開頭"),
  z.string().regex(/^#[A-Za-z0-9_-]+$/, "錨點格式不正確"),
  externalUrl,
]);

/**
 * 純文字。
 *
 * Spec §36「禁止 arbitrary HTML」的落實方式：所有文字欄位都經過這裡，
 * 而 React 預設就會逸出。此處額外擋掉明顯的標籤形狀，讓問題在驗證階段
 * 就被看見，而不是靜靜地變成畫面上的一串 `<script>` 字樣。
 */
const plainText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !/<[a-zA-Z/!]/.test(value), "文字內容不得包含 HTML 標籤");

/* ------------------------------------------------------------------ */
/* Theme（Spec §14）                                                    */
/* ------------------------------------------------------------------ */

export const themeConfigSchema = z.object({
  colors: z.object({
    background: cssColor,
    surface: cssColor,
    text: cssColor,
    muted: cssColor,
    accent: cssColor,
  }),
  typography: z.object({
    heading: fontFamily,
    body: fontFamily,
  }),
  /** 只接受長度單位，不接受任意 CSS */
  radius: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?(px|rem|em|%)$/, "圓角必須是長度值")
    .max(16),
  spacingScale: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?(px|rem|em)$/, "間距必須是長度值")
    .max(16),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/* ------------------------------------------------------------------ */
/* Section（Spec §10）                                                  */
/* ------------------------------------------------------------------ */

export const SITE_SECTION_TYPES = [
  "hero",
  "about",
  "services",
  "features",
  "gallery",
  "portfolio",
  "pricing",
  "testimonials",
  "faq",
  // CR-003-2 補的一批。加在這裡還不夠——沒有進 SECTION_REGISTRY 的 type
  // 只會渲染成 UnknownSection，registry.test 會抓到。
  "process",
  "stats",
  "team",
  "form",
  "cta",
  "contact",
  /*
   * CR-003-3 把原本的 "map" 換成 "embed"。
   *
   * "map" 從一開始就只是一個宣告——沒有元件、沒有任何模板用它、
   * 也沒有任何地方存過 SiteConfig（Workshop 還沒做），所以拿掉沒有相容性代價。
   *
   * 換掉而不是並存的理由：地圖與 YouTube 是同一件事的兩個提供者，
   * 安全模型（提供者 + 識別碼，網址由我們組）也完全一樣。
   * 留兩種型別表達同一件事，只會讓下一個人不知道該用哪一個。
   */
  "embed",
  "footer",
] as const;

export const siteSectionTypeSchema = z.enum(SITE_SECTION_TYPES);
export type SiteSectionType = z.infer<typeof siteSectionTypeSchema>;

/**
 * Section 內容。
 *
 * Spec §10 定義為 `Record<string, unknown>`，因為不同 section 的欄位不同。
 * 但「unknown」不等於「什麼都能塞」——這裡限制成一層扁平結構，
 * 值只能是字串、數字、布林或字串/連結物件的陣列。
 *
 * 理由：3C 的 Section 元件會依 variant 取用這些欄位。若允許任意巢狀結構，
 * 每個元件都得自己防禦性解構，而漏掉的那個就是渲染時的例外。
 * 各 section 的精確 schema 在 3C 的 registry 中定義，此處是共同下限。
 */
/**
 * 一個欄位裡最多幾項。
 *
 * 匯出而不是寫死兩次：編輯器的「新增一項」要在同一個數字上停手。
 * 兩邊各寫一個數字的話，UI 那邊比較大就變成「按了沒反應」
 * （schema 擋下來，畫面不變，沒有任何訊息）。
 */
export const MAX_CONTENT_ITEMS = 50;

const contentValue = z.union([
  plainText(2000),
  z.number().finite(),
  z.boolean(),
  z.array(plainText(500)).max(MAX_CONTENT_ITEMS),
  z
    .array(
      z.object({
        label: plainText(200),
        href: linkTarget.optional(),
        text: plainText(1000).optional(),
      }),
    )
    .max(MAX_CONTENT_ITEMS),
]);

/**
 * 圖片欄位的名稱。
 *
 * ── 為什麼是一個保留的鍵名，不是每種 section 各自宣告 ──────────
 *
 * content 是 `Record<string, ContentValue>`，型別上分不出「這個字串陣列
 * 是圖說還是圖片網址」。而圖片網址有一條字串沒有的限制（只能來自我們的
 * 媒體網域），漏掉那條的後果是任何人都能叫訪客的瀏覽器去連任意網址。
 *
 * 用一個保留的鍵名解決：叫 `images` 的欄位一律走圖片來源檢查。
 * 各 section 元件也照這個名字讀，所以「schema 檢查的」與「畫面畫的」
 * 是同一個欄位——不會變成「檢查了一個沒人讀的鍵」。
 */
export const IMAGE_CONTENT_KEY = "images";

/**
 * ⚠️ 檢查掛在 content 這一層，而不是外面包一個 refined 版本的 section schema。
 *
 * 包在外面的話會有兩個 schema，而 `siteSectionSchema` 必須維持是 ZodObject
 * （website-tools 取 `.shape.content` 去產生給模型看的 JSON Schema）。
 * 兩個並存的結果一定是某個驗證點用到寬鬆的那一個，而且不會有人發現。
 */
const sectionContent = z.record(z.string().max(60), contentValue).check((ctx) => {
  const images = ctx.value[IMAGE_CONTENT_KEY];
  if (images === undefined) return;

  if (!Array.isArray(images)) {
    ctx.issues.push({
      code: "custom",
      input: images,
      path: [IMAGE_CONTENT_KEY],
      message: "images 必須是圖片網址的陣列",
    });
    return;
  }

  images.forEach((url, index) => {
    if (typeof url === "string" && isAllowedImageUrl(url)) return;
    ctx.issues.push({
      code: "custom",
      input: url,
      path: [IMAGE_CONTENT_KEY, index],
      message: "圖片只能放在本站的媒體網域上，請先上傳",
    });
  });
});

/* ------------------------------------------------------------------ */
/* Section 背景（CR-004 / Phase B BJ）                                  */
/* ------------------------------------------------------------------ */

export const SECTION_BACKGROUND_TYPES = ["none", "color", "gradient", "image", "video"] as const;

export const sectionBackgroundTypeSchema = z.enum(SECTION_BACKGROUND_TYPES);
export type SectionBackgroundType = z.infer<typeof sectionBackgroundTypeSchema>;

/**
 * 一塊的背景。
 *
 * ── 為什麼四種來源各有自己的欄位 ──────────────────────────────
 *
 * 共用一個 `src` 的話，從「圖片」切到「影片」再切回來，
 * 原本挑好的那張圖已經不見了——而使用者只是想比較一下哪個好看。
 * 切換是**預覽**行為，不該有破壞性。
 *
 * ⚠️ `imageUrl` 在影片模式下是**封面**（poster）。
 *
 * 這不只是省一個欄位：影片還沒載完、或訪客開了「減少動態效果」時，
 * 畫面上必須有東西——沒有的話那一塊會是一片空白，而文字浮在空白上
 * 看起來像壞掉。詳見 `section-background.tsx`。
 */
export const sectionBackgroundSchema = z.object({
  type: sectionBackgroundTypeSchema,
  color: cssColor.optional(),
  gradientFrom: cssColor.optional(),
  gradientTo: cssColor.optional(),
  /** 漸層角度。0 = 由下往上，90 = 由左往右（與 CSS 的 deg 一致） */
  gradientAngle: z.number().int().min(0).max(360).optional(),
  imageUrl: siteImageUrl.optional(),
  videoUrl: siteVideoUrl.optional(),
  /*
   * 遮罩濃度。
   *
   * ⚠️ 這一欄不是裝飾。一張隨手拍的照片後面壓著文字，
   * 對比度幾乎一定不合格——而那件事在設計稿上很難看出來，
   * 因為看的人已經知道那行字寫什麼。
   *
   * 所以編輯器在選了圖片或影片時會**預設給一個遮罩**，
   * 而不是從 0 開始（見 section-background.ts 的 DEFAULT_MEDIA_OVERLAY）。
   */
  overlay: z.number().min(0).max(1).optional(),
  /** 背景模糊，單位 px。讓照片退到後面去，文字才站得出來 */
  blur: z.number().int().min(0).max(20).optional(),
});

export type SectionBackground = z.infer<typeof sectionBackgroundSchema>;

export const siteSectionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Section id 只能是小寫英數與連字號"),
  type: siteSectionTypeSchema,
  variant: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "variant 只能是小寫英數與連字號"),
  content: sectionContent,
  /** 背景。沒有這一欄的舊資料照原本的樣子渲染（CR-004 / BJ） */
  background: sectionBackgroundSchema.optional(),
  settings: z
    .record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean()]))
    .optional(),
});

export type SiteSection = z.infer<typeof siteSectionSchema>;

/* ------------------------------------------------------------------ */
/* SiteConfig（Spec §9）                                                */
/* ------------------------------------------------------------------ */

export const siteConfigSchema = z.object({
  id: z.string().min(1).max(64),
  brand: z.object({
    name: plainText(80).pipe(z.string().min(1, "品牌名稱不可空白")),
    tagline: plainText(200).optional(),
    /**
     * logo 走與其他媒體相同的來源限制（Spec §36 image source validation）。
     *
     * ⚠️ 這裡以前是 `externalUrl`，也就是「任何 https 都收」——註解說的
     * 「與其他媒體相同的來源限制」在程式上從來沒有成立過。
     */
    logo: siteImageUrl.optional(),
    industry: plainText(60).optional(),
  }),
  theme: themeConfigSchema,
  /**
   * 上限 30 個 section 是刻意的。
   * Agent 可能因為誤解指令而產生大量重複區塊；沒有上限時，
   * 一次失控的 tool call 就能讓渲染端耗盡資源。
   */
  sections: z.array(siteSectionSchema).max(30),
  settings: z.object({
    language: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, "語言代碼格式不正確"),
  }),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

/* ------------------------------------------------------------------ */
/* 驗證入口                                                            */
/* ------------------------------------------------------------------ */

export interface ValidationFailure {
  path: string;
  message: string;
}

export type ValidationResult =
  { ok: true; config: SiteConfig } | { ok: false; errors: ValidationFailure[] };

/**
 * 驗證 SiteConfig。
 *
 * 回傳錯誤清單而非拋出例外：這條路徑的呼叫端是 Agent 的 tool call，
 * 它需要知道「哪裡不對」才能修正並重試。拋例外只會讓對話中斷。
 *
 * Spec §36「非法 config 有明確錯誤而非崩潰」。
 */
export function validateSiteConfig(input: unknown): ValidationResult {
  const result = siteConfigSchema.safeParse(input);

  if (result.success) return { ok: true, config: result.data };

  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    })),
  };
}

/** section 內重複的 id 會讓後續的更新／刪除操作指向錯誤對象 */
export function findDuplicateSectionIds(config: SiteConfig): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const section of config.sections) {
    if (seen.has(section.id)) duplicates.add(section.id);
    seen.add(section.id);
  }

  return [...duplicates];
}
