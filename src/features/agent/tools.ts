import "server-only";

import { z } from "zod";

import { searchFaq } from "@/config/faq";
import { ALL_CATEGORIES, PORTFOLIO_CATEGORIES } from "@/config/portfolio-categories";
import { HOME_GOAL_IDS, homeGoalSchema } from "@/config/home-goals";
import { createLead } from "@/features/leads/repository";
import { hasContactChannel, leadSchema, missingLeadFields } from "@/features/leads/schema";
import { getPortfolioRepository } from "@/features/portfolio";
import type { PortfolioListItem } from "@/features/portfolio/repository";
import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";
import { listTemplates } from "@/features/website-engine/templates";

import { estimatePriceRange } from "./estimate";

/**
 * Agent 知識工具（Spec §20 白名單 / §8.12）
 *
 * ⚠️ 白名單的意思是**只有這裡列出的工具存在**。
 * 模型拿不到「查資料庫」這種泛用能力，只拿得到這幾個問過的問題。
 *
 * 產品線與價格不在這裡——它們小、穩定、而且永遠相關，
 * 放進被快取的系統提示比做成工具好（理由見 knowledge.ts，
 * 包含 5B 實測到的「模型自己編價格」）。
 */

/* ------------------------------------------------------------------ */
/* Spec §8.12：Demo 不可講成客戶案例                                   */
/* ------------------------------------------------------------------ */

/**
 * 依實際回傳的資料產生揭露指示。
 *
 * ⚠️ 這是 5C 最重要的一段，也是唯一一段規格點名要有測試的。
 *
 * 系統提示裡已經寫了「Demo 不可講成客戶案例」，但那是一句通則，
 * 隔了十幾輪對話之後它的份量會被稀釋。這裡讓指示**跟著資料一起送達**：
 * 查出來的東西裡沒有客戶案例時，工具回傳的內容本身就帶著那句話，
 * 而且是程式算出來的，不是模型自己判斷的。
 *
 * 差別在於：模型可以忽略一句遠處的通則，但很難忽略貼在資料上的一行字。
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

/* ------------------------------------------------------------------ */
/* 工具定義                                                            */
/* ------------------------------------------------------------------ */

const categorySlugs = PORTFOLIO_CATEGORIES.map((category) => category.slug);

const searchPortfolioInput = z.object({
  category: z.enum([ALL_CATEGORIES, ...categorySlugs]).optional(),
});

const recommendPortfolioInput = z.object({
  goal: homeGoalSchema.optional(),
});

const recommendTemplateInput = z.object({
  category: z.string().max(40).optional(),
});

const searchFaqInput = z.object({
  query: z.string().min(1).max(200),
});

const estimateInput = z.object({
  needsCustomSections: z.boolean().optional(),
  needsStrategy: z.boolean().optional(),
  hasBrandGuideline: z.boolean().optional(),
});

/**
 * 送給模型的工具定義。
 *
 * description 要寫清楚**什麼時候該叫它**，不是只寫它做什麼——
 * 只說功能的話，模型傾向自己回答而不呼叫工具，
 * 而自己回答的內容就是編的（5B 的價格就是這樣來的）。
 */
export const AGENT_TOOLS = [
  {
    name: "search_portfolio",
    description:
      "查作品集。對方問「你們做過什麼」「有沒有類似的案例」「有做過某某產業嗎」時呼叫，不要憑印象回答。" +
      `可依分類篩選：${categorySlugs.join("、")}。回傳結果會標明每件作品是客戶案例還是 Concept／Demo。`,
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: [ALL_CATEGORIES, ...categorySlugs],
          description: "作品分類；不確定時省略",
        },
      },
    },
  },
  {
    name: "recommend_portfolio",
    description:
      "依對方的目標推薦作品。已經知道他想做什麼類型（網站／品牌／行銷／內容／AI）時呼叫。" +
      `goal 可為：${HOME_GOAL_IDS.join("、")}。`,
    input_schema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", enum: [...HOME_GOAL_IDS], description: "對方的目標" },
      },
    },
  },
  {
    name: "recommend_template",
    description:
      "推薦網站模板。對方在談版型、風格或想看看網站長什麼樣子時呼叫。" +
      "回傳的模板名稱與首頁那個預覽區的是同一批，講出來對方可以直接去點。",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "模板分類，例如 web 或 product；不確定時省略" },
      },
    },
  },
  {
    name: "collect_requirement",
    description:
      "整理目前為止問到的需求。對方講出他的狀況、目標、時程或預算之後呼叫，" +
      "會回傳「還缺什麼」，讓你知道下一句該問什麼。這個工具不會存檔，只是幫你整理。",
    input_schema: {
      type: "object" as const,
      properties: {
        contact: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
        business: {
          type: "object",
          properties: {
            name: { type: "string" },
            industry: { type: "string" },
            description: { type: "string" },
          },
        },
        requirement: {
          type: "object",
          properties: {
            service: { type: "array", items: { type: "string" } },
            goal: { type: "string" },
            deadline: { type: "string" },
            budgetRange: { type: "string" },
          },
        },
        assets: {
          type: "object",
          properties: {
            logo: { type: "boolean" },
            photos: { type: "boolean" },
            copy: { type: "boolean" },
            instagram: { type: "string" },
            existingWebsite: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "create_lead_summary",
    description:
      "把需求存下來，讓真人可以回覆。**要在對方已經給了信箱或電話、而且他同意留下資料之後才呼叫**，" +
      "一段對話只呼叫一次。沒有聯絡方式的話不要呼叫——存下來也聯絡不到人。",
    input_schema: {
      type: "object" as const,
      properties: {
        contact: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
        business: {
          type: "object",
          properties: {
            name: { type: "string" },
            industry: { type: "string" },
            description: { type: "string" },
          },
        },
        requirement: {
          type: "object",
          properties: {
            service: { type: "array", items: { type: "string" } },
            goal: { type: "string" },
            deadline: { type: "string" },
            budgetRange: { type: "string" },
          },
        },
        assets: {
          type: "object",
          properties: {
            logo: { type: "boolean" },
            photos: { type: "boolean" },
            copy: { type: "boolean" },
            instagram: { type: "string" },
            existingWebsite: { type: "string" },
          },
        },
        website: {
          type: "object",
          properties: {
            // 兩個欄位很容易互填。實測時模型把模板名「Local Business」
            // 放進了 preferredTheme——不會壞，但後台看到的分類就錯了。
            selectedTemplate: {
              type: "string",
              description: "模板名稱，例如 Studio、Local Business、Personal、Product",
            },
            preferredTheme: {
              type: "string",
              description: "風格，只有三種：暖一點、精品一點、更極簡",
            },
          },
        },
      },
    },
  },
  {
    name: "estimate_price_range",
    description:
      "推估這個需求落在價格階梯的哪一級。問清楚客製程度、有沒有既有品牌規範、" +
      "要不要連策略內容一起做之後呼叫，不要自己判斷落點。回傳的是區間與理由，不是報價。",
    input_schema: {
      type: "object" as const,
      properties: {
        needsCustomSections: {
          type: "boolean",
          description: "要不要模板沒有的區塊，或版面要照品牌重新調整",
        },
        needsStrategy: { type: "boolean", description: "要不要連策略、內容、成效追蹤一起處理" },
        hasBrandGuideline: { type: "boolean", description: "有沒有既有的品牌規範可以延用" },
      },
    },
  },
  {
    name: "search_faq",
    description:
      "查常見問題。對方問流程、價格怎麼算、免費範圍、折抵、AI 使用方式、作品來源類型時呼叫。" +
      "查不到就是沒有這條資料——那時要說不確定，不要自己補一個答案。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "對方問題的關鍵詞" },
      },
      required: ["query"],
    },
  },
] as const;

export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((tool) => tool.name);

/* ------------------------------------------------------------------ */
/* 執行                                                                */
/* ------------------------------------------------------------------ */

function toPortfolioPayload(items: PortfolioListItem[]) {
  return {
    disclosure: portfolioDisclosure(items),
    projects: items.map((item) => ({
      title: item.title,
      kicker: item.kicker,
      // 同時給代碼與中文標籤：代碼用於判斷，標籤用於直接引述，
      // 兩者都給就不需要模型自己翻譯，也就不會翻錯。
      projectType: item.projectType,
      projectTypeLabel: PROJECT_TYPE_LABELS[item.projectType],
      categories: item.categories,
      href: item.href,
    })),
  };
}

export interface AgentToolResult {
  content: string;
  isError: boolean;
}

/**
 * 執行一個工具。
 *
 * ⚠️ 任何失敗都回傳 `isError` 的結果，**不拋例外**。
 * 拋出去的話整輪對話會斷在半路，而使用者看到的是回覆突然停住。
 * 讓模型知道「這個工具這次沒查到」，它至少能說出來。
 */
export async function executeAgentTool(name: string, input: unknown): Promise<AgentToolResult> {
  const fail = (message: string): AgentToolResult => ({
    content: JSON.stringify({ error: message }),
    isError: true,
  });

  try {
    switch (name) {
      case "search_portfolio": {
        const parsed = searchPortfolioInput.safeParse(input);
        if (!parsed.success) return fail("參數不正確");

        const items = await getPortfolioRepository().listPublished({
          category: parsed.data.category ?? ALL_CATEGORIES,
          projectType: "all",
        });

        return { content: JSON.stringify(toPortfolioPayload(items)), isError: false };
      }

      case "recommend_portfolio": {
        const parsed = recommendPortfolioInput.safeParse(input);
        if (!parsed.success) return fail("參數不正確");

        const repository = getPortfolioRepository();
        const items = parsed.data.goal
          ? await repository.listByGoal(parsed.data.goal)
          : await repository.listFeatured();

        return { content: JSON.stringify(toPortfolioPayload(items)), isError: false };
      }

      case "recommend_template": {
        const parsed = recommendTemplateInput.safeParse(input);
        if (!parsed.success) return fail("參數不正確");

        const templates = listTemplates(parsed.data.category ? [parsed.data.category] : []);

        return {
          content: JSON.stringify({
            templates: templates.map((template) => ({
              name: template.name,
              description: template.description,
              recommendedIndustries: template.recommendedIndustries,
            })),
            hint: "訪客可以在首頁的模板區直接切換這些模板，不需要註冊或付費。",
          }),
          isError: false,
        };
      }

      case "search_faq": {
        const parsed = searchFaqInput.safeParse(input);
        if (!parsed.success) return fail("參數不正確");

        const entries = searchFaq(parsed.data.query);

        return {
          content: JSON.stringify({
            entries: entries.map((entry) => ({
              question: entry.question,
              answer: entry.answer,
            })),
            hint:
              entries.length === 0
                ? "沒有這條資料。要說不確定，並提議留下聯絡方式由真人回覆——不要自己補一個答案。"
                : "照這裡的內容回答，不要加上沒寫的細節。",
          }),
          isError: false,
        };
      }

      case "collect_requirement": {
        const parsed = leadSchema.safeParse(input);
        if (!parsed.success) return fail("需求格式不正確");

        const missing = missingLeadFields(parsed.data);

        return {
          content: JSON.stringify({
            collected: parsed.data,
            missing,
            hint:
              missing.length === 0
                ? "資訊夠了。問對方願不願意留下來讓真人回覆，他同意再呼叫 create_lead_summary。"
                : "還缺上面這幾項。一次問一到兩個，不要列成清單要他填。",
          }),
          isError: false,
        };
      }

      case "create_lead_summary": {
        const parsed = leadSchema.safeParse(input);
        if (!parsed.success) return fail("需求格式不正確");

        if (!hasContactChannel(parsed.data)) {
          // 沒有聯絡方式的 lead 是一段無法回覆的獨白。
          // 直接告訴模型缺什麼，它才問得下去。
          return fail("沒有聯絡方式（信箱或電話），還不能存。先問到再呼叫一次。");
        }

        const record = await createLead(parsed.data);
        if (!record) return fail("這次沒有存成功。請對方直接用信箱聯絡，不要說已經記下來了。");

        return {
          content: JSON.stringify({
            saved: true,
            leadId: record.id,
            hint: "已經存下來了。告訴對方會有真人回覆，不要承諾時間。",
          }),
          isError: false,
        };
      }

      case "estimate_price_range": {
        const parsed = estimateInput.safeParse(input);
        if (!parsed.success) return fail("參數不正確");

        return {
          content: JSON.stringify(estimatePriceRange(parsed.data)),
          isError: false,
        };
      }

      default:
        // 白名單之外的名字。模型偶爾會發明工具名，
        // 那時要讓它知道那個工具不存在，而不是靜靜地什麼都沒發生。
        return fail(`沒有名為 ${name} 的工具`);
    }
  } catch {
    return fail("查詢時發生問題，這次沒有資料");
  }
}
