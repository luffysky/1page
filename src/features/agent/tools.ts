import "server-only";

import { z } from "zod";

import { searchFaq } from "@/config/faq";
import { readCmsDocument } from "@/features/cms/read";
import { HOME_GOAL_IDS, homeGoalSchema } from "@/config/home-goals";
import { ALL_CATEGORIES, PORTFOLIO_CATEGORIES } from "@/config/portfolio-categories";
import { createLead } from "@/features/leads/repository";
import { hasContactChannel, leadSchema, missingLeadFields } from "@/features/leads/schema";
import { getPortfolioRepository } from "@/features/portfolio";
import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";
import type { PortfolioListItem } from "@/features/portfolio/repository";
import { listTemplates } from "@/features/website-engine/templates";

import { estimatePriceRange } from "./estimate";
import { AgentToolRegistry, defineTool, toolError, toolResult } from "./tool-registry";
import { WEBSITE_TOOLS } from "./website-tools";

/**
 * Agent 知識與需求工具（Spec §20 白名單 / §8.12 / §19）
 *
 * 產品線與價格不在這裡——它們小、穩定、永遠相關，放進被快取的系統提示
 * 比做成工具好（理由見 knowledge.ts，含 5B 實測到的「模型自己編價格」）。
 */

/* ------------------------------------------------------------------ */
/* Spec §8.12：Demo 不可講成客戶案例                                   */
/* ------------------------------------------------------------------ */

/**
 * 依實際回傳的資料產生揭露指示。
 *
 * ⚠️ 規格點名要有測試的規則。系統提示裡已經寫了「Demo 不可講成客戶案例」，
 * 但那是一句通則，隔了十幾輪對話之後份量會被稀釋。
 * 這裡讓指示**跟著資料一起送達**：查出來的東西裡沒有客戶案例時，
 * 工具回傳的內容本身就帶著那句話，而且是程式算出來的。
 *
 * 模型可以忽略一句遠處的通則，但很難忽略貼在資料上的一行字。
 */
export function portfolioDisclosure(items: readonly { projectType: string }[]): string {
  if (items.length === 0) {
    return "沒有符合的作品。不要為了有東西可講而拿不相關的作品充數，直接說目前沒有這個方向的作品。";
  }

  const hasClient = items.some((item) => item.projectType === "client");

  if (!hasClient) {
    return (
      "⚠️ 以下**全部是 Concept／Demo／自家產品，沒有客戶案例**。" +
      "回覆時必須明說「目前有相關的 Concept／Demo，可以先看方向」，" +
      "絕對不可以講成「我們幫某某客戶做過」。"
    );
  }

  return "以下有客戶案例，也可能混著 Concept／Demo。逐件依 projectType 標示，不要混為一談。";
}

function toPortfolioPayload(items: PortfolioListItem[]) {
  return {
    disclosure: portfolioDisclosure(items),
    projects: items.map((item) => ({
      title: item.title,
      kicker: item.kicker,
      // 同時給代碼與中文標籤：代碼用於判斷，標籤用於直接引述。
      // 兩者都給就不需要模型自己翻譯，也就不會翻錯。
      projectType: item.projectType,
      projectTypeLabel: PROJECT_TYPE_LABELS[item.projectType],
      categories: item.categories,
      href: item.href,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* 知識                                                                */
/* ------------------------------------------------------------------ */

/**
 * 給模型看的分類選項。
 *
 * ⚠️ 這裡刻意用程式碼裡那份種子，**不是**從資料庫讀。
 *
 * 工具的 JSON Schema 是在模組載入時算好的（`z.toJSONSchema`），
 * 改成每次請求都查資料庫的話，整個 tool registry 都要變成非同步——
 * 而它現在是「schema 就是驗證器本身」那條保證的基礎。
 *
 * 這樣安全的前提是**種子與資料庫不會分岔**，而那件事有 `test:db`
 * 的一條測試在盯（`portfolio-categories.test.ts`）。分岔就會紅。
 */
const categorySlugs = PORTFOLIO_CATEGORIES.map((category) => category.slug);

const searchPortfolio = defineTool({
  name: "search_portfolio",
  tier: "free",
  description:
    "查作品集。對方問「你們做過什麼」「有沒有類似的案例」「有做過某某產業嗎」時呼叫，不要憑印象回答。" +
    "回傳結果會標明每件作品是客戶案例還是 Concept／Demo。",
  input: z.object({
    category: z
      .enum([ALL_CATEGORIES, ...categorySlugs])
      .optional()
      .describe("作品分類；不確定時省略"),
  }),
  async run({ category }) {
    const items = await getPortfolioRepository().listPublished({
      category: category ?? ALL_CATEGORIES,
      projectType: "all",
    });

    return toolResult(toPortfolioPayload(items));
  },
});

const recommendPortfolio = defineTool({
  name: "recommend_portfolio",
  tier: "free",
  description: "依對方的目標推薦作品。已經知道他想做什麼類型（網站／品牌／行銷／內容／AI）時呼叫。",
  input: z.object({
    goal: homeGoalSchema.optional().describe(`對方的目標：${HOME_GOAL_IDS.join("、")}`),
  }),
  async run({ goal }) {
    const repository = getPortfolioRepository();
    const items = goal ? await repository.listByGoal(goal) : await repository.listFeatured();

    return toolResult(toPortfolioPayload(items));
  },
});

const recommendTemplate = defineTool({
  name: "recommend_template",
  tier: "free",
  description:
    "推薦網站模板。對方在談版型、風格或想看看網站長什麼樣子時呼叫。" +
    "回傳的模板與首頁預覽區的是同一批，講出來對方可以直接去點。",
  input: z.object({
    category: z.string().max(40).optional().describe("模板分類，例如 web 或 product；不確定時省略"),
  }),
  run({ category }) {
    const templates = listTemplates(category ? [category] : []);

    return toolResult({
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        recommendedIndustries: template.recommendedIndustries,
      })),
      hint: "訪客可以在首頁的模板區直接切換這些模板，不需要註冊或付費。",
    });
  },
});

const searchFaqTool = defineTool({
  name: "search_faq",
  tier: "free",
  description:
    "查常見問題。對方問流程、價格怎麼算、免費範圍、折抵、AI 使用方式、作品來源類型時呼叫。" +
    "查不到就是沒有這條資料——那時要說不確定，不要自己補一個答案。",
  input: z.object({
    query: z.string().min(1).max(200).describe("對方問題的關鍵詞"),
  }),
  async run({ query }) {
    /*
     * FAQ 從 CMS 讀，不是從程式碼的常數。
     *
     * 後台改了 FAQ、網站上顯示新的、而 AI 顧問還在用舊的回答——
     * 那件事沒有任何地方會報錯，只有問到那一題的人會發現。
     */
    const document = await readCmsDocument("faq.list");
    const entries = searchFaq(document.entries, query);

    return toolResult({
      entries: entries.map((entry) => ({ question: entry.question, answer: entry.answer })),
      hint:
        entries.length === 0
          ? "沒有這條資料。要說不確定，並提議留下聯絡方式由真人回覆——不要自己補一個答案。"
          : "照這裡的內容回答，不要加上沒寫的細節。",
    });
  },
});

/* ------------------------------------------------------------------ */
/* 需求與 Lead（Spec §19 / §20）                                       */
/* ------------------------------------------------------------------ */

const collectRequirement = defineTool({
  name: "collect_requirement",
  tier: "free",
  description:
    "整理目前為止問到的需求。對方講出他的狀況、目標、時程或預算之後呼叫，" +
    "會回傳「還缺什麼」，讓你知道下一句該問什麼。這個工具不會存檔，只是幫你整理。",
  input: leadSchema,
  run(lead) {
    const missing = missingLeadFields(lead);

    return toolResult({
      collected: lead,
      missing,
      hint:
        missing.length === 0
          ? "資訊夠了。問對方願不願意留下來讓真人回覆，他同意再呼叫 create_lead_summary。"
          : "還缺上面這幾項。一次問一到兩個，不要列成清單要他填。",
    });
  },
});

const createLeadSummary = defineTool({
  name: "create_lead_summary",
  tier: "free",
  description:
    "把需求存下來，讓真人可以回覆。**要在對方已經給了信箱或電話、而且他同意留下資料之後才呼叫**，" +
    "一段對話只呼叫一次。沒有聯絡方式的話不要呼叫——存下來也聯絡不到人。",
  input: leadSchema,
  async run(lead) {
    if (!hasContactChannel(lead)) {
      return toolError("沒有聯絡方式（信箱或電話），還不能存。先問到再呼叫一次。");
    }

    const record = await createLead(lead);
    if (!record) return toolError("這次沒有存成功。請對方直接用信箱聯絡，不要說已經記下來了。");

    return toolResult({
      saved: true,
      leadId: record.id,
      hint: "已經存下來了。告訴對方會有真人回覆，不要承諾時間。",
    });
  },
});

const estimatePrice = defineTool({
  name: "estimate_price_range",
  tier: "free",
  description:
    "推估這個需求落在價格階梯的哪一級。問清楚客製程度、有沒有既有品牌規範、" +
    "要不要連策略內容一起做之後呼叫，不要自己判斷落點。回傳的是區間與理由，不是報價。",
  input: z.object({
    needsCustomSections: z
      .boolean()
      .optional()
      .describe("要不要模板沒有的區塊，或版面要照品牌重新調整"),
    needsStrategy: z.boolean().optional().describe("要不要連策略、內容、成效追蹤一起處理"),
    hasBrandGuideline: z.boolean().optional().describe("有沒有既有的品牌規範可以延用"),
  }),
  run(signals) {
    return toolResult(estimatePriceRange(signals));
  },
});

/**
 * 人工接手（Spec §40：❌ Agent 自動簽約）。
 *
 * 這個工具刻意**不做任何自動化的事**——它不寄信、不排時間、不建立專案。
 * 它做的是把「接下來由真人處理」這件事講出來，並確保 lead 已經存在。
 *
 * 讓 Agent 能安排會議或送出合約，就是讓一段對話變成一份承諾，
 * 而承諾的另一端是一間真的工作室與一個真的人的時間。
 */
const requestHumanHandoff = defineTool({
  name: "request_human_handoff",
  tier: "free",
  description:
    "對方想找真人談時呼叫。回傳接下來會怎麼進行。" +
    "呼叫之前要先確定已經用 create_lead_summary 存過需求，否則真人沒有東西可以看。",
  input: z.object({
    leadSaved: z.boolean().describe("是否已經呼叫過 create_lead_summary 並成功"),
    reason: z.string().max(200).optional().describe("對方想找真人的原因"),
  }),
  run({ leadSaved }) {
    if (!leadSaved) {
      return toolError("需求還沒存下來。先呼叫 create_lead_summary，真人才有東西可以看。");
    }

    return toolResult({
      handoff: true,
      // 這幾句是**能承諾的全部**。多一句都不行。
      whatHappensNext: ["需求已經記錄下來，會有真人看過。", "真人會用你留的信箱或電話聯絡。"],
      mustNotSay: [
        "不要承諾回覆時間——那取決於人，不是系統。",
        "不要安排會議、不要說已經排進行程。",
        "不要提到簽約、合約或訂金（Spec §40：Agent 不得自動簽約）。",
      ],
    });
  },
});

/* ------------------------------------------------------------------ */
/* 註冊                                                                */
/* ------------------------------------------------------------------ */

export const AGENT_TOOL_DEFINITIONS = [
  searchPortfolio,
  recommendPortfolio,
  recommendTemplate,
  searchFaqTool,
  collectRequirement,
  createLeadSummary,
  estimatePrice,
  requestHumanHandoff,
  ...WEBSITE_TOOLS,
];

export const AGENT_TOOLS = new AgentToolRegistry(AGENT_TOOL_DEFINITIONS);
