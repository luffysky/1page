import "server-only";

import type { SiteConfig } from "@/features/website-engine/types";

/**
 * 模板內的 AI 客服體驗（CR-003 / Spec §40 部分解禁）
 *
 * ── 這是什麼 ──────────────────────────────────────────────────
 *
 * 訪客在首頁的模板預覽裡看到一個客服對話框，可以真的跟它講話。
 * 它扮演的是**被預覽的那間店**，不是一頁起家。
 *
 * 用途是讓潛在客戶知道「我的網站可以有這個」——講一百句不如讓他打一句試試。
 *
 * ── 兩件結構上就守住的事 ──────────────────────────────────────
 *
 * 1. **零工具。** 它拿不到 search_portfolio、create_lead_summary 或任何東西。
 *    不是提示詞裡叮嚀它別用，是根本沒給。一個扮演別人的角色，
 *    不該碰得到我們的作品集、價格或 Lead。
 *
 * 2. **知識來源只有那份 SiteConfig。** 系統提示由預覽的內容產生，
 *    沒有寫進網站的東西它就是不知道。這也正好示範了真實部署時
 *    該有的行為：客服不會編造營業時間。
 */

/** 把 SiteConfig 攤成模型讀得懂的一份店家資料 */
function describeSections(config: SiteConfig): string {
  return config.sections
    .map((section) => {
      const lines = Object.entries(section.content)
        .map(([key, value]) => {
          if (typeof value === "string") return `${key}：${value}`;
          if (Array.isArray(value)) {
            return `${key}：${value
              .map((item) =>
                typeof item === "string"
                  ? item
                  : [item.label, item.text].filter(Boolean).join(" — "),
              )
              .join("；")}`;
          }
          return null;
        })
        .filter(Boolean);

      return lines.length > 0 ? `[${section.type}]\n${lines.join("\n")}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildDemoSystemPrompt(config: SiteConfig): string {
  const brand = config.brand.name;
  const industry = config.brand.industry ?? "";

  return `你是「${brand}」網站上的客服助理。${industry ? `這是一間${industry}。` : ""}

## 你只知道這些

以下是這個網站上寫的全部內容。**沒有寫在這裡的事情，你就是不知道。**

${describeSections(config)}

## 規則

被問到網站上沒寫的事（例如確切的營業時間、價格、是否有停車位），
就直說「這個網站上沒有寫，我幫你留言給店家」——不要猜、不要編。

這一點不是限制，是你被設計成這樣：一個會編造營業時間的客服，
比沒有客服糟糕得多。

回答簡短，兩三句話。用繁體中文。像店裡的人在講話，不是說明書。

## 你不是誰

你不是「一頁起家」的顧問，也不知道一頁起家的服務、價格或作品。
被問到那些，就說你只負責「${brand}」的事。

回覆會以純文字呈現，不要用星號粗體或 Markdown 標題——那些符號會原樣出現在畫面上。`;
}
