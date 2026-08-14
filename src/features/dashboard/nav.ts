/**
 * 兩個 dashboard 的導覽（CR-004 / Phase B BA）
 *
 * ── 導覽是一份資料，不是散在各頁的連結 ────────────────────────
 *
 * 側邊欄、後台首頁的卡片、以及「每一頁都在導覽裡」那條守衛，
 * 讀的都是這一份。加一頁只改一個地方。
 *
 * ⚠️ 這不只是為了少打字。後台頁面數量會從 4 個長到 30+ 個
 * （CR-004 的 CRM / ERP / CMS），靠人記得加連結一定會漏，
 * 而漏掉的表現是「功能做完了，但畫面上進不去」——這個專案已經犯了七次。
 *
 * `nav.test.ts` 反過來問：**磁碟上有沒有哪一頁不在這份資料裡**。
 *
 * ── 這份檔案不能匯入 server-only ──────────────────────────────
 *
 * 側邊欄是 client component（手機抽屜要 state、目前頁要 usePathname）。
 * 後台的密路徑因此**不在這裡**：`ADMIN_NAV` 存的是內部路徑
 * （`/admin/portfolio`），由後台的 layout 在伺服器端用 `toAdminUrl()`
 * 換成對外網址再傳進元件。密路徑一個字都不會進 bundle。
 */

export interface NavItem {
  label: string;
  /** 會員區是最終網址；後台區是內部路徑，由 layout 轉換 */
  href: string;
  /** 後台首頁的卡片會用到——一句話說明這裡能做什麼 */
  hint?: string;
}

export interface NavGroup {
  /** 分組標題。只有一組時不顯示 */
  title?: string;
  items: NavItem[];
}

/**
 * 會員 dashboard（一般人自己的後台）。
 *
 * ⚠️ 與後台**沒有任何共用的權限判斷**（CR-002 / §47）。
 * 共用的只有外殼的長相。
 */
export const MEMBER_NAV: NavGroup[] = [
  {
    items: [
      { label: "總覽", href: "/account", hint: "你在這裡做過的事" },
      { label: "我的網站", href: "/account/sites", hint: "存下來的排版，可以接著改" },
      { label: "我的詢問", href: "/account/inquiries", hint: "你留給我們的需求" },
      { label: "帳號設定", href: "/account/settings", hint: "顯示名稱與登出" },
    ],
  },
];

/**
 * 網站管理後台（員工用）。
 *
 * href 是**內部路徑**，不是對外網址——見檔頭。
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    items: [{ label: "總覽", href: "/admin", hint: "今天要注意的幾個數字" }],
  },
  {
    title: "內容",
    items: [{ label: "作品", href: "/admin/portfolio", hint: "建立、編輯、發布作品" }],
  },
  {
    title: "客戶",
    items: [{ label: "收件匣", href: "/admin/inbox", hint: "訪客留下的需求" }],
  },
];

export const navItems = (groups: NavGroup[]): NavItem[] => groups.flatMap((group) => group.items);
