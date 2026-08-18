import type { NavLink } from "@/components/shared/navbar";

/**
 * 公開頁面的導覽（CR-006）
 *
 * ── 為什麼要收成一份 ──────────────────────────────────────────
 *
 * 在此之前，六個公開頁面各自宣告一份 `NAV_LINKS`，而且**內容都不一樣**：
 * `/work` 有七條、`/work/[slug]` 只有五條、`/edit` 與 `/crm` 是另一組四條。
 *
 * 那不是設計，是漂移。加一條路由要記得改六個地方，
 * 而漏掉的那一頁不會報錯——它只是少一個入口。
 * 這個專案已經七次做完功能卻沒有入口，而這正是最容易再犯的形狀。
 *
 * 後台那邊 0815 就收成 `features/dashboard/nav.ts` 了，公開頁一直沒有。
 *
 * ── 首頁用純錨點，其他頁用絕對路徑 ────────────────────────────
 *
 * `#advisor` 在首頁是「捲到那一段」；在 `/work` 上它會變成
 * 「捲到 /work 的 #advisor」——而那裡沒有那一段。所以其他頁必須是 `/#advisor`。
 *
 * 兩份各寫一次的話遲早分岔，所以只寫絕對路徑那一份，
 * 首頁用 `homeNav()` 把開頭的 `/` 去掉。
 */

/**
 * 唯一的一份。
 *
 * ⚠️ 順序就是畫面上的順序：先是「看得到的東西」（作品、價格），
 * 再是「自己動手的東西」（試穿、排版、CRM），最後才是「聊」。
 * 那是 CR-005／CR-006 的同一個判斷——先給證據，再給工具。
 */
export const PUBLIC_NAV: readonly NavLink[] = [
  { label: "作品", href: "/work" },
  { label: "服務", href: "/#services" },
  { label: "價格", href: "/pricing" },
  { label: "試穿", href: "/playground" },
  { label: "自己排版", href: "/edit" },
  { label: "設計 CRM", href: "/crm" },
  { label: "AI 顧問", href: "/#advisor" },
];

/**
 * 首頁用的版本：站內錨點去掉開頭的 `/`。
 *
 * 不去掉也能運作，但那會讓首頁上的每一次「捲到某一段」都經過一次
 * 路由跳轉——網址列閃一下、捲動位置由 Next 決定而不是瀏覽器。
 * 純錨點是瀏覽器原生就做得好的事。
 */
export const homeNav = (): NavLink[] =>
  PUBLIC_NAV.map((link) =>
    link.href.startsWith("/#") ? { ...link, href: link.href.slice(1) } : { ...link },
  );

/**
 * 那些**刻意不放進導覽列**的公開路由，以及理由。
 *
 * ⚠️ `nav.test.ts` 反過來問：磁碟上有沒有哪一條公開路由
 * 既不在 `PUBLIC_NAV` 裡、也不在這份清單裡。
 *
 * 「忘了加」與「刻意不加」在畫面上長得一模一樣，
 * 差別只在有沒有人寫下理由——所以這裡要求寫下理由。
 */
export const NOT_IN_PUBLIC_NAV: ReadonlyArray<readonly [string, string]> = [
  ["/", "導覽列左上角的品牌標誌就是回首頁"],
  ["/start", "它是右上角的主要 CTA（開始一個專案），不重複放進選單"],
  ["/login", "登入入口在導覽列右側，與這幾條的性質不同"],
  ["/work/[slug]", "動態路由，從 /work 的卡片進去"],
  /*
   * ⚠️ 用前綴而不是逐一列出。
   *
   * 逐一列的話，每加一個開發頁都要記得補一行——而那正是
   * 「反過來問」要避免的形狀。實際上 0818 加這條守衛時就漏了
   * `/_dev/templates` 與 `/_dev/tokens`（守衛自己抓到的）。
   */
  ["/_dev/*", "開發用頁面，不對外"],
];

/** 例外比對。結尾 `/*` 表示前綴，其餘要完全相同 */
export function isExcusedFromNav(route: string): boolean {
  return NOT_IN_PUBLIC_NAV.some(([pattern]) =>
    pattern.endsWith("/*") ? route.startsWith(pattern.slice(0, -1)) : route === pattern,
  );
}
