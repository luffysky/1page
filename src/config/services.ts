/**
 * 四大產品線（Spec §7）
 *
 * > 我們把服務收斂成四條產品線，依專案組合，不讓首頁變成數位菜市場。
 *
 * id 與 home-goals.ts 的 serviceId 對應，Goal Selector 靠它決定 highlight 哪一條。
 */

export interface ServiceLine {
  id: string;
  name: string;
  summary: string;
}

export const SERVICE_LINES: readonly ServiceLine[] = [
  {
    id: "web",
    name: "Web",
    summary: "一頁式網站、Landing Page、UI/UX、網站優化與部署。",
  },
  {
    id: "brand-design",
    name: "Brand & Design",
    summary: "品牌識別、Logo、商業視覺、社群與廣告素材。",
  },
  {
    id: "content-growth",
    name: "Content & Growth",
    summary: "品牌文案、SEO、社群內容、廣告文案與 Campaign。",
  },
  {
    id: "ai-automation",
    name: "AI & Automation",
    summary: "流程診斷、Prototype、Workflow、Agent 與自動化。",
  },
];
