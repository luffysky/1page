import { PRICING_GROUPS, PRICING_TIERS } from "@/config/pricing";
import { SERVICE_LINES } from "@/config/services";

/**
 * 永遠相關的知識：產品線與價格階梯（Spec §7 / §26）
 *
 * ── 為什麼這兩樣不做成工具 ────────────────────────────────────
 *
 * Spec §20 的白名單裡有 `search_services`，但把它做成工具是錯的選擇：
 *
 *   - 資料很小（四條產品線、六級價格），塞進提示詞的成本可以忽略
 *   - 內容不隨提問變動，因此可以進 prompt cache，讀取只要約一成價格
 *   - **最重要的**：工具要模型自己決定呼叫。它沒呼叫的時候不會報錯，
 *     只會自己編一組聽起來合理的價格
 *
 * 最後那一點不是假設。5B 對真實模型跑的時候，問「形象網站多少錢」，
 * 它回了「單頁式：幾萬元起／多頁形象站：中間帶」——
 * 全是編的，而 `config/pricing.ts` 裡明明就有完整六級。
 * 對潛在客戶報一個不存在的價格，比不回答糟得多。
 *
 * 查詢才需要的東西（作品、模板、FAQ）留給工具，見 tools.ts。
 *
 * ⚠️ 文字由 config 產生，不手抄。抄一次就會分岔，
 * 而分岔的表現是「網站上寫 8,800、AI 說 8,000」。
 */

export function renderServiceLines(): string {
  const lines = SERVICE_LINES.map((service) => `- **${service.name}**：${service.summary}`).join(
    "\n",
  );

  return `## 四條產品線

${lines}`;
}

export function renderPricingLadder(): string {
  const groups = PRICING_GROUPS.map((group) => {
    const tiers = PRICING_TIERS.filter((tier) => tier.group === group.id)
      .map((tier) => `- **${tier.name}**　${tier.price}${tier.priceSuffix ?? ""}　${tier.summary}`)
      .join("\n");

    return `### ${group.label}（${group.description}）\n\n${tiers}`;
  }).join("\n\n");

  return `## 價格階梯

以下是**實際**的六級價格。談到錢的時候只能用這裡的數字，不可以自己估、自己換算、自己給區間。

${groups}

價格依**責任範圍**而定，不依頁數（Spec §27）。影響落點的是：要做到多深、內容誰提供、有沒有既有品牌可延用、要不要後台自己更新。

正式報價需要真人確認範圍後才會出——你可以說明會落在哪一級與為什麼，但不承諾金額、不出報價單。`;
}
