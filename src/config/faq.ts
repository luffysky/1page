/**
 * FAQ（Spec §20 `search_faq`）
 *
 * ⚠️ 這裡**只放網站上已經講過、或封版規格明文寫著的事**。
 *
 * 一個 FAQ 條目就是一句對外承諾。我不知道的事——工期幾天、含幾次修改、
 * 付不付訂金、要不要簽約、維護怎麼收——不會出現在這個檔案裡，
 * 因為編一條看起來合理的答案，等於替這間工作室承諾了一件沒人答應過的事。
 *
 * 缺的那幾題列在 `docs/todo/` 裡等 Luffy 補。在補上之前，
 * Agent 遇到那些問題會照系統提示說「這題我不確定，可以留下聯絡方式由真人回覆」——
 * 那是正確的行為，不是缺陷。
 *
 * ── 為什麼答案裡沒有數字 ──────────────────────────────────────
 *
 * 價格數字只有一個來源：`config/pricing.ts`。FAQ 裡再抄一次就會分岔，
 * 而分岔的表現是「網站上寫 8,800、AI 說 8,000」。
 * 需要金額時由價格階梯那段提供，這裡只講規則。
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** 給檢索用的關鍵詞，含同義說法 */
  keywords: string[];
}

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    id: "process",
    question: "合作流程是什麼？",
    answer:
      "四步：需求（告訴我們想完成什麼）→ 方向與報價（確認範圍、工期與費用）→ 製作與 Review（設計、開發、測試與修改）→ 上線（正式交付，後續需要再進維護）。",
    keywords: ["流程", "怎麼開始", "步驟", "合作方式", "第一步"],
  },
  {
    id: "pricing-basis",
    question: "價格怎麼算？依頁數嗎？",
    answer:
      "依**責任範圍**，不依頁數。同樣是五頁，只做版面調整跟從策略到內容一起處理，投入完全不同。影響落點的是要做到多深、內容誰提供、有沒有既有品牌可以延用、要不要後台自己更新。",
    keywords: ["價格", "報價", "多少錢", "費用", "頁數", "怎麼算"],
  },
  {
    id: "advisor-free",
    question: "AI 顧問要錢嗎？",
    answer:
      "免費。需求探索、方案推薦、價格區間與基礎的網站試穿都在免費範圍。要我實際排 Section、寫文案並操作網站，才會進入付費的 Website Workshop。",
    keywords: ["免費", "顧問", "要錢", "收費", "試用"],
  },
  {
    id: "workshop-credit",
    question: "Website Workshop 的費用可以折抵嗎？",
    answer: "可以。之後正式建站時可折抵。",
    keywords: ["折抵", "workshop", "抵扣", "退費"],
  },
  {
    id: "service-scope",
    question: "可以只做品牌、不做網站嗎？",
    answer:
      "可以。四條產品線是獨立的：Web、Brand & Design、Content & Growth、AI & Automation，依專案組合，不強迫綁在一起。",
    keywords: ["只做", "分開", "單獨", "品牌", "不做網站"],
  },
  {
    id: "ai-disclosure",
    question: "你們會用 AI 嗎？品質怎麼確保？",
    answer:
      "會，而且我們把這件事講明：AI 協助研究、內容整理、設計探索與程式開發，正式交付一律經過人工判斷與品質確認。揭露不是免責聲明，是承諾。",
    keywords: ["AI", "人工智慧", "品質", "誰做的", "是不是 AI 生成"],
  },
  {
    id: "project-types",
    question: "作品集裡的 Demo 和 Client Project 差在哪？",
    answer:
      "Client Project 是真實客戶的案子。Concept Project 與 Demo 是我們自己做的方向示範，沒有客戶。Internal Product 是自家產品。每件作品都會標示來源類型，我們不會把 Demo 講成客戶案例。",
    keywords: ["demo", "concept", "案例", "客戶", "真的假的", "作品"],
  },
];

/**
 * 關鍵詞檢索。
 *
 * 刻意保持簡單：條目只有個位數，語意檢索在這個量級沒有意義，
 * 而且會多一層看不見的失敗（embedding 服務掛掉時整個 FAQ 靜靜地變空）。
 * 條目多到需要語意檢索時再換，那時它會是一個真的問題而不是想像的問題。
 */
/**
 * 檢索 FAQ。
 *
 * ⚠️ 條目由呼叫端傳進來，不在這裡讀 `FAQ_ENTRIES`。
 *
 * FAQ 現在的真相是 CMS（`cms_documents` 的 `faq.list`），
 * 而這個常數退成「資料庫沒有那一列時的預設值」。
 * 若這裡直接讀常數，後台改了 FAQ、網站上顯示新的、**AI 顧問卻還在
 * 用舊的回答**——而那件事沒有任何地方會報錯。
 */
export function searchFaq(entries: readonly FaqEntry[], query: string, limit = 3): FaqEntry[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];

  const scored = entries
    .map((entry) => {
      const haystack = [entry.question, ...entry.keywords].join(" ").toLowerCase();
      // 雙向包含：使用者可能問「流程」，也可能整句「你們的合作流程是什麼」。
      const score = entry.keywords.reduce(
        (total, keyword) =>
          total + (needle.includes(keyword.toLowerCase()) || haystack.includes(needle) ? 1 : 0),
        0,
      );
      return { entry, score };
    })
    .filter((item) => item.score > 0);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
