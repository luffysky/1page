import { SITE_URL, absoluteUrl } from "@/config/site";

/**
 * 結構化資料（Spec §32）
 *
 * ── 為什麼可以用 dangerouslySetInnerHTML ──────────────────────
 *
 * 全站禁止 arbitrary HTML（Spec §36），這裡是唯一的例外，
 * 而例外成立的條件很嚴格：
 *
 *   1. 內容不是 HTML，是 JSON——瀏覽器不會把 ld+json 的內容當標記解析
 *   2. 內容**完全由我們產生**，沒有任何一個欄位來自訪客或模型
 *   3. 仍然做逸出：`<` 換成 `<`，讓 `</script>` 不可能出現在字串裡
 *
 * 第三點是關鍵。作品標題是後台輸入的，理論上可信，但「理論上可信」
 * 在 2E 已經被推翻過一次——admin 也是人，也會貼進奇怪的東西。
 */

/** JSON 字串放進 <script> 時唯一真正危險的字元 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"

      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
    />
  );
}

/**
 * 首頁：這是誰、叫什麼、網址是什麼、屬於誰。
 *
 * ⚠️ `parentOrganization` 是後補的。原本這裡只說「一頁起家是一個組織」，
 * 而它其實是**斯諾瑞姆企業社（SnowRealm）旗下的產品**。
 *
 * 對機器來說那是兩件不同的事：少了 parentOrganization，
 * 搜尋引擎不會把這個站與 SnowRealm 其他產品視為同一個實體的一部分，
 * 品牌累積的信任也就不會互相加成。
 */
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "一頁起家",
        alternateName: "1page",
        url: SITE_URL,
        description: "AI 輔助的數位工作室。網站、品牌、內容、設計與 AI 自動化。",
        parentOrganization: {
          "@type": "Organization",
          name: "斯諾瑞姆企業社",
          alternateName: "SnowRealm",
        },
      }}
    />
  );
}

/**
 * 作品詳細頁。
 *
 * ⚠️ 用 `CreativeWork` 而不是 `Product` 或 `Service`。
 * Spec §29 不准把 Demo 講成客戶案例，而結構化資料是講給機器聽的同一句話——
 * 標成產品或服務等於宣稱它是我們賣過的東西。
 */
export function ProjectJsonLd({
  title,
  summary,
  href,
  year,
}: {
  title: string;
  summary?: string;
  href: string;
  year?: number;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: title,
        ...(summary ? { description: summary } : {}),
        url: absoluteUrl(href),
        ...(year ? { dateCreated: String(year) } : {}),
        creator: { "@type": "Organization", name: "一頁起家", url: SITE_URL },
      }}
    />
  );
}
