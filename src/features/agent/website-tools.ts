import { z } from "zod";

import { siteSectionSchema } from "@/features/website-engine/schema";
import {
  addSection,
  removeSection,
  reorderSections,
  setSectionVariant,
  updateSectionContent,
} from "@/features/website-engine/section-ops";
import {
  ACCENT_IDS,
  ACCENT_LABELS,
  getTemplate,
  TEMPLATES,
  THEME_IDS,
  THEME_PRESETS,
} from "@/features/website-engine/templates";

import { defineTool, toolError, toolResult } from "./tool-registry";

/**
 * Agent 操作 Website（Spec §21 / §22 / §23）
 *
 * ── 免費與付費的分界線就在這個檔案裡 ──────────────────────────
 *
 * Spec §23 說得很清楚：「聊天免費，開始產生成果時收費。」
 *   Free Advisor        Basic Preview
 *   Paid Workshop       Agent Website Editing、Complete Copy Draft
 *
 * 所以這裡的工具分成兩半：
 *
 *   free      改品牌名、產業、風格、模板——訪客本來就能在首頁自己按
 *             （Spec §15），讓 Agent 代按不算產生成果
 *   workshop  改 Section 結構與文案——那是實際在做網站，屬於付費階段
 *
 * 分界寫在工具的 tier 上，由 registry 依身分過濾。忘了篩的表現是
 * 「免費就拿到了付費功能」，而那不會有任何錯誤訊息。
 *
 * ── 為什麼免費那半回傳的是 patch，不是直接改 ──────────────────
 *
 * 預覽的唯一狀態在瀏覽器裡（website-engine/preview-context.tsx）。
 * server 存一份就會有兩份可變狀態，而兩份一定會分歧——
 * 表現是「AI 說改好了，畫面沒動」。
 *
 * 所以工具回傳的是一份要套用到 draft 上的變更，由 route 串流給 client，
 * client 套用到同一個 context 上。訪客自己按與 AI 代按，走的是同一條路徑。
 */

/* ------------------------------------------------------------------ */
/* Free：Basic Preview（Spec §15 / §21）                               */
/* ------------------------------------------------------------------ */

const themeChoices = THEME_PRESETS.map(
  (preset) => `${preset.id}（${preset.label}：${preset.description}）`,
).join("；");

const templateChoices = TEMPLATES.map(
  (template) => `${template.id}（${template.name}：${template.description}）`,
).join("；");

const accentChoices = ACCENT_IDS.map((id) => `${id}（${ACCENT_LABELS[id]}）`).join("、");

const setBrand = defineTool({
  name: "set_brand",
  tier: "free",
  description:
    "把預覽的品牌名稱換成對方的店名或品牌名。對方講出名字之後呼叫，讓他在預覽裡看到自己的名字。",
  input: z.object({
    name: z.string().trim().min(1).max(80).describe("品牌或店名"),
  }),
  run({ name }) {
    return { ...toolResult({ applied: { brandName: name } }), patch: { brandName: name } };
  },
});

const setIndustry = defineTool({
  name: "set_industry",
  tier: "free",
  description: "把預覽的產業換掉。對方講出他在做什麼之後呼叫，例如甜點店、攝影、SaaS。",
  input: z.object({
    industry: z.string().trim().min(1).max(60).describe("產業或店的類型"),
  }),
  run({ industry }) {
    return { ...toolResult({ applied: { industry } }), patch: { industry } };
  },
});

const setTheme = defineTool({
  name: "set_theme",
  tier: "free",
  description:
    `換預覽的風格與主色。對方描述想要的感覺時呼叫（例如「高級一點」「不要太黑」「乾淨簡單」）。` +
    `風格：${themeChoices}。主色：${accentChoices}。`,
  input: z.object({
    theme: z.enum(THEME_IDS).describe("風格"),
    accent: z.enum(ACCENT_IDS).optional().describe("主色；不確定時省略，會沿用目前的"),
  }),
  run({ theme, accent }) {
    const patch = { themeId: theme, ...(accent ? { accentId: accent } : {}) };
    return { ...toolResult({ applied: patch }), patch };
  },
});

const setTemplate = defineTool({
  name: "set_template",
  tier: "free",
  description: `換預覽的模板。對方描述他要的網站類型時呼叫。可用：${templateChoices}。`,
  input: z.object({
    template: z.string().max(64).describe("模板 id"),
  }),
  run({ template }) {
    const found = getTemplate(template);
    if (!found) {
      // 講出有哪些，模型才改得動。只說「不對」它會再猜一個。
      return toolError(
        `沒有 ${template} 這個模板。可用的是：${TEMPLATES.map((item) => item.id).join("、")}`,
      );
    }

    return {
      ...toolResult({ applied: { templateId: found.id }, name: found.name }),
      patch: { templateId: found.id },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Workshop：Agent Website Editing（Spec §22 / §23）                   */
/* ------------------------------------------------------------------ */

/**
 * Section 操作需要一份完整的 SiteConfig 才能動，而那份 config
 * 只在付費的 Workshop 流程裡才存在（Phase 7）。
 *
 * 在那之前這些工具**不會被送給模型**——registry 依 tier 過濾，
 * 免費階段根本看不到它們。這裡的實作是為了讓 Phase 7 接上時
 * 不必重寫，而且它們背後的純函式現在就已經測過了
 * （website-engine/section-ops.test.ts）。
 */
function requireConfig(context: { config?: unknown }) {
  if (!context.config) {
    return toolError("目前沒有可編輯的網站。這個功能屬於 Website Workshop。");
  }
  return null;
}

const addSectionTool = defineTool({
  name: "add_section",
  tier: "workshop",
  description:
    "在網站裡加一個新區塊。對方說要多一段內容時呼叫。" +
    "id 要用小寫英數與連字號，且不可與現有區塊重複；position 省略就加在最後。",
  input: z.object({
    section: siteSectionSchema,
    position: z.number().int().min(0).optional().describe("插入位置；省略則加在最後"),
  }),
  run({ section, position }, context) {
    const missing = requireConfig(context);
    if (missing) return missing;

    const result = addSection(context.config!, section, position);
    return result.ok
      ? toolResult({ sections: result.config.sections.length })
      : toolError(result.error);
  },
});

const removeSectionTool = defineTool({
  name: "remove_section",
  tier: "workshop",
  description:
    "移除一個區塊。對方說某一段不需要時呼叫。移除前先確認他指的是哪一個 id，不要用猜的。",
  input: z.object({ id: z.string().max(64).describe("區塊 id") }),
  run({ id }, context) {
    const missing = requireConfig(context);
    if (missing) return missing;

    const result = removeSection(context.config!, id);
    return result.ok
      ? toolResult({ sections: result.config.sections.length })
      : toolError(result.error);
  },
});

const reorderSectionsTool = defineTool({
  name: "reorder_sections",
  tier: "workshop",
  description:
    "重新排列區塊順序。對方說想把某一段往上或往下移時呼叫。" +
    "必須列出**全部**區塊的 id，只給一部分會被拒絕——剩下的要放哪裡不該由系統猜。",
  input: z.object({ order: z.array(z.string().max(64)).min(1).describe("由上到下的區塊 id") }),
  run({ order }, context) {
    const missing = requireConfig(context);
    if (missing) return missing;

    const result = reorderSections(context.config!, order);
    return result.ok ? toolResult({ order }) : toolError(result.error);
  },
});

const updateSectionContentTool = defineTool({
  name: "update_section_content",
  tier: "workshop",
  description:
    "改一個區塊的文字內容。對方要求改標題、說明或項目時呼叫。" +
    "只會覆蓋你給的欄位，沒給的保留原樣——不需要把整段內容重打一次。",
  input: z.object({
    id: z.string().max(64),
    content: siteSectionSchema.shape.content,
  }),
  run({ id, content }, context) {
    const missing = requireConfig(context);
    if (missing) return missing;

    const result = updateSectionContent(context.config!, id, content);
    return result.ok ? toolResult({ updated: id }) : toolError(result.error);
  },
});

const setSectionVariantTool = defineTool({
  name: "set_section_variant",
  tier: "workshop",
  description:
    "換一個區塊的排版，內容不動。對方說「這段換個排法」時呼叫。" +
    "排版名稱要用該區塊型別實際支援的那幾個，傳錯會回傳可用清單。",
  input: z.object({ id: z.string().max(64), variant: z.string().max(40) }),
  run({ id, variant }, context) {
    const missing = requireConfig(context);
    if (missing) return missing;

    const result = setSectionVariant(context.config!, id, variant);
    return result.ok ? toolResult({ updated: id, variant }) : toolError(result.error);
  },
});

const resetPreview = defineTool({
  name: "reset_preview",
  tier: "free",
  description: "把預覽整個重設回目前模板的原始樣子。對方說「回到原本的」「重來」時呼叫。",
  input: z.object({}),
  run() {
    // 重設在免費階段就該有——訪客把預覽調成自己不喜歡的樣子之後，
    // 沒有回頭路是很糟的體驗，而那與付不付費無關。
    // patch 只帶 reset 旗標，實際的還原由 client 依目前模板重算。
    return { ...toolResult({ reset: true }), patch: { reset: true } };
  },
});

export const WEBSITE_TOOLS = [
  setBrand,
  setIndustry,
  setTheme,
  setTemplate,
  resetPreview,
  addSectionTool,
  removeSectionTool,
  reorderSectionsTool,
  updateSectionContentTool,
  setSectionVariantTool,
];
