import { z } from "zod";

/**
 * Home Goal — 首頁的 Context Controller（Spec §6 / Plan §6.1）
 *
 * Goal Selector 不是六張漂亮墓碑：選定一個 goal 後，Selected Work、
 * Template Experience、Services 與 Agent CTA 四處必須同步反應。
 *
 * 這份對應表是那個同步行為的唯一來源。任何 Section 都不得自行硬寫
 * 「如果 goal 是 X 就顯示 Y」——一律從這裡讀。
 */

export const HOME_GOAL_IDS = ["website", "brand", "marketing", "content", "ai", "unsure"] as const;

export type HomeGoal = (typeof HOME_GOAL_IDS)[number];

/** 未指定或無法辨識時的預設。unsure 代表「不套用任何 filter」 */
export const DEFAULT_HOME_GOAL: HomeGoal = "unsure";

export const homeGoalSchema = z.enum(HOME_GOAL_IDS);

export interface HomeGoalDefinition {
  id: HomeGoal;
  /** Spec §6 指定的顯示文案 */
  label: string;
  description: string;
  /** Selected Work 篩選用的 portfolio category；空陣列 = 不篩選 */
  workCategories: string[];
  /** Template Experience 篩選用的 template category；空陣列 = 不篩選 */
  templateCategories: string[];
  /** Services 需要 highlight 的產品線 id；null = 不 highlight */
  serviceId: string | null;
  /**
   * 開啟 Agent 時帶入的起始意圖（Spec §6 `openAgent({ initialIntent })`）。
   *
   * ⚠️ 這不是 Spec §17 的 `AgentIntent`。§17 是分類器的輸出分類法
   * （service_question / pricing / portfolio ...），此處是對話的起始種子。
   * 兩者恰好都叫 intent，但用途不同，Phase 5 實作 Agent 時不可混用。
   */
  agentInitialIntent: string;
}

export const HOME_GOALS: readonly HomeGoalDefinition[] = [
  {
    id: "website",
    label: "我要一個網站",
    description: "品牌頁、Landing Page、作品集、活動頁。",
    workCategories: ["web"],
    templateCategories: ["web"],
    serviceId: "web",
    agentInitialIntent: "website",
  },
  {
    id: "brand",
    label: "我要建立品牌",
    description: "品牌識別、Logo、視覺方向與商業素材。",
    workCategories: ["brand"],
    templateCategories: [],
    serviceId: "brand-design",
    agentInitialIntent: "brand",
  },
  {
    id: "marketing",
    label: "我要開始行銷",
    description: "社群內容、廣告素材、SEO 與 Campaign 規劃。",
    workCategories: ["content", "social", "advertising"],
    templateCategories: [],
    serviceId: "content-growth",
    agentInitialIntent: "marketing",
  },
  {
    id: "content",
    label: "我要製作內容",
    description: "網站文案、SEO 文章、社群貼文與品牌語氣整理。",
    workCategories: ["content"],
    templateCategories: [],
    serviceId: "content-growth",
    agentInitialIntent: "content",
  },
  {
    id: "ai",
    label: "我要導入 AI",
    description: "流程診斷、Prototype、Workflow 與自動化。",
    workCategories: ["ai", "automation"],
    templateCategories: ["product"],
    serviceId: "ai-automation",
    agentInitialIntent: "ai",
  },
  {
    id: "unsure",
    label: "我還不知道需要什麼",
    description: "先說現在卡在哪，我們一起把需求翻譯成人話。",
    workCategories: [],
    templateCategories: [],
    serviceId: null,
    agentInitialIntent: "unclear",
  },
];

const GOAL_BY_ID = new Map(HOME_GOALS.map((goal) => [goal.id, goal]));

export function getHomeGoal(id: HomeGoal): HomeGoalDefinition {
  const definition = GOAL_BY_ID.get(id);
  if (!definition) {
    // HOME_GOALS 與 HomeGoal 型別同源，理論上不可能發生；
    // 留一個明確錯誤，好過回傳 undefined 讓呼叫端在別處炸掉。
    throw new Error(`Unknown home goal: ${id}`);
  }
  return definition;
}

/**
 * 解析 URL 的 ?goal= 參數（Plan §5「非法值與預設」）。
 *
 *   /?goal=website   → "website"
 *   /?goal=banana    → "unsure"（不拋錯、不 404）
 *   （無參數）        → "unsure"
 *
 * searchParams 的值可能是 string | string[] | undefined，全部吃下來。
 */
export function parseHomeGoal(value: unknown): HomeGoal {
  const raw = Array.isArray(value) ? value[0] : value;
  const result = homeGoalSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_HOME_GOAL;
}

/** unsure 代表不套用任何篩選——各 Section 以此判斷是否顯示全部內容 */
export function isFilteringGoal(goal: HomeGoal): boolean {
  return goal !== DEFAULT_HOME_GOAL;
}
