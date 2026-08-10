/**
 * 作品來源類型（Spec §8.2 / §29）
 *
 * > 不得將 Demo / Concept 冒充真實客戶案例。
 *
 * 這條規則在 Phase 1 就必須成立：即使目前是假資料，
 * 也要標示為 demo / internal，並在 UI 顯示對應標籤。
 */

export type PortfolioProjectType = "client" | "concept" | "demo" | "internal";

/** Spec §8.2 指定的顯示名稱 */
export const PROJECT_TYPE_LABELS: Record<PortfolioProjectType, string> = {
  client: "Client Project",
  concept: "Concept Project",
  demo: "Demo",
  internal: "Internal Product",
};
