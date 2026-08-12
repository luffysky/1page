import type { SiteConfig, SiteSection } from "../schema";

import { TEMPLATE_DEFINITIONS } from "./definitions";
import { type AccentId, resolveTheme, type ThemeId } from "./themes";
import { PLACEHOLDER, type WebsiteTemplate } from "./types";

/**
 * Template Registry（Spec §12 / §8.15）
 *
 * 對外只有三件事：查模板、依 goal 篩模板、把一份 draft 變成 SiteConfig。
 */

export { ACCENT_IDS, ACCENT_LABELS, THEME_IDS, THEME_PRESETS, resolveTheme } from "./themes";
export type { AccentId, ThemeId, ThemePreset } from "./themes";
export type { TemplateSectionConfig, WebsiteTemplate } from "./types";

export const TEMPLATES = TEMPLATE_DEFINITIONS;

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export function getTemplate(id: string): WebsiteTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/**
 * 依 Home Goal 的 templateCategories 篩選。
 *
 * 空陣列＝不篩選（與 `config/home-goals.ts` 的約定一致，
 * `unsure` 與尚未細分的 goal 都是空陣列）。
 *
 * ⚠️ 篩選結果為空時**回傳空陣列，不偷偷退回全部**。
 * 這是 2B 就立下的規則：篩選後沒東西是一個事實，
 * 把它蓋掉會讓人以為篩選沒生效。呼叫端負責誠實說明。
 */
export function listTemplates(categories: readonly string[] = []): WebsiteTemplate[] {
  if (categories.length === 0) return [...TEMPLATES];

  return TEMPLATES.filter((template) =>
    template.category.some((item) => categories.includes(item)),
  );
}

/* ------------------------------------------------------------------ */
/* Draft → SiteConfig                                                  */
/* ------------------------------------------------------------------ */

/**
 * 訪客在 Template Experience 累積的選擇。
 *
 * 這是 Preview 的**唯一狀態**，SiteConfig 由它算出來而不是另外存一份。
 *
 * 為什麼不直接存 SiteConfig：兩份可變狀態一定會分歧。
 * 存 draft 的話「換主題」就只是換一個 id，整份 config 重新算；
 * 存 config 的話同一個操作變成「要記得同時改 theme.colors 的五個欄位」，
 * 而漏改一個的表現是「換了主題但按鈕還是舊顏色」。
 */
export interface SiteDraft {
  templateId: string;
  themeId: ThemeId;
  accentId: AccentId;
  brandName: string;
  industry: string;
}

export function draftFromTemplate(template: WebsiteTemplate): SiteDraft {
  return {
    templateId: template.id,
    themeId: template.defaultTheme,
    accentId: template.defaultAccent,
    brandName: template.defaultBrandName,
    industry: template.defaultIndustry,
  };
}

/**
 * 清理訪客輸入的自由文字。
 *
 * schema 的 `plainText` 會拒絕含 HTML 標籤形狀的字串——那對 Agent 的輸出是對的
 * （錯了要讓它知道並修正），但對著鍵盤打字的人不是：
 * 打到一半出現「這份網站設定目前無法呈現」，看起來像是自己把網站弄壞了。
 *
 * 所以在進 SiteConfig 之前就先把不合法的字元拿掉，讓驗證永遠會過。
 * 這不是繞過驗證——驗證仍在 SiteRenderer 那一關，這裡只是不讓它有機會失敗。
 */
function sanitizeFreeText(input: string, max: number, fallback: string): string {
  const cleaned = input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

  return cleaned || fallback;
}

type ContentValue = SiteSection["content"][string];

/** content 值可能是字串、字串陣列，或 {label,text} 物件陣列，全部都要代換 */
function substituteValue(value: ContentValue, brand: string, industry: string): ContentValue {
  const swap = (text: string) =>
    text.split(PLACEHOLDER.brand).join(brand).split(PLACEHOLDER.industry).join(industry);

  if (typeof value === "string") return swap(value);
  if (!Array.isArray(value)) return value;

  // schema 把陣列定義成「全字串」或「全物件」兩種，不是混合。
  // 分開處理而不是一律 map：混在一起會讓回傳型別退化成聯集陣列，
  // 那個聯集在 schema 眼中不是合法的 content 值。
  if (value.every((item): item is string => typeof item === "string")) {
    return value.map(swap);
  }

  return value.map((item) => ({
    ...item,
    label: swap(item.label),
    ...(item.text === undefined ? {} : { text: swap(item.text) }),
  }));
}

/**
 * Draft → SiteConfig。
 *
 * 回傳 `SiteConfig` 而非 ValidationResult：這條路徑上的每一個輸入都已經受控
 * （模板是我們自己寫的、主題是列舉、自由文字經過 sanitize），
 * 因此不會產出無效的設定，`templates.test.ts` 對所有組合實際驗證這件事。
 *
 * 即使如此，SiteRenderer 仍會再驗一次——那一層擋的是別條路徑
 * （Agent 的 tool call、序列化往返），與這裡的保證互不取代。
 */
export function buildSiteConfig(draft: SiteDraft): SiteConfig {
  const template = getTemplate(draft.templateId) ?? TEMPLATES[0]!;

  const brandName = sanitizeFreeText(draft.brandName, 80, template.defaultBrandName);
  const industry = sanitizeFreeText(draft.industry, 60, template.defaultIndustry);

  return {
    id: `preview-${template.id}`,
    brand: { name: brandName, industry },
    theme: resolveTheme(draft.themeId, draft.accentId),
    sections: template.sections.map((section) => ({
      ...section,
      content: Object.fromEntries(
        Object.entries(section.content).map(([key, value]) => [
          key,
          substituteValue(value, brandName, industry),
        ]),
      ),
    })),
    settings: { language: "zh-Hant" },
  };
}
