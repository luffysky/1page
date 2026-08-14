import type { HomeGoal } from "@/config/home-goals";
import { ALL_CATEGORIES, ALL_PROJECT_TYPES } from "@/config/portfolio-categories";
import { keyFromPublicUrl } from "@/lib/storage/r2";
import { getSupabasePublicClient } from "@/lib/supabase/client";
import type { Json, PortfolioProjectsRow } from "@/types/database";

import type { PortfolioCaseStudy, PortfolioDetail, PortfolioLinks, PortfolioMedia } from "./detail";
import {
  filterByGoal,
  filterForList,
  type PortfolioListFilter,
  type PortfolioListItem,
  type PortfolioRepository,
} from "./repository";

/**
 * Supabase 實作（2D）。
 *
 * 介面與型別完全沿用 1D 立下的 `PortfolioRepository`——
 * `/work`、`/work/[slug]` 與首頁一行都不用改，這就是當初立介面的用意。
 *
 * ⚠️ 一律使用 anon client。未發布作品讀不到不是因為查詢加了 `status = published`，
 * 而是因為 RLS 不給（Spec §41）。因此即使這裡的查詢寫錯，草稿也不會外流。
 */

/** PostgREST 的巢狀選取：一次把分類與標籤帶回來，避免 N+1 */
const LIST_SELECT = `
  id, slug, title, kicker, summary, project_type, featured, sort_order, services,
  portfolio_project_categories ( portfolio_categories ( slug ) ),
  portfolio_project_tags ( portfolio_tags ( slug ) ),
  portfolio_media ( url, alt, role )
`;

const DETAIL_SELECT = `
  id, slug, title, kicker, summary, project_type, industry, year, services,
  case_study_json, links_json, ai_disclosure_json,
  portfolio_project_categories ( portfolio_categories ( slug ) ),
  portfolio_project_tags ( portfolio_tags ( name ) ),
  portfolio_media ( id, type, url, thumbnail_url, alt, caption, role, sort_order )
`;

type CategoryJoin = { portfolio_categories: { slug: string } | null }[] | null;
type TagJoin = { portfolio_tags: { name: string } | null }[] | null;
/** 列表只需要 slug（比對用），詳細頁要 name（顯示用）——兩者刻意不共用型別 */
type TagSlugJoin = { portfolio_tags: { slug: string } | null }[] | null;

interface ListRow extends Pick<
  PortfolioProjectsRow,
  | "id"
  | "slug"
  | "title"
  | "kicker"
  | "summary"
  | "project_type"
  | "featured"
  | "sort_order"
  | "services"
> {
  portfolio_project_categories: CategoryJoin;
  portfolio_project_tags: TagSlugJoin;
  portfolio_media: { url: string; alt: string | null; role: string }[] | null;
}

function categoriesOf(join: CategoryJoin): string[] {
  return (join ?? [])
    .map((row) => row.portfolio_categories?.slug)
    .filter((slug): slug is string => Boolean(slug));
}

/**
 * 沒有封面圖時的佔位色調。
 *
 * 由 slug 決定而非存成欄位：這是「還沒有真實封面」才需要的過渡呈現，
 * 2F 接上 R2 之後就不再用到。存成欄位等於為暫時狀態增加 schema 負擔。
 * 用 slug 雜湊而非隨機，是為了同一件作品每次都得到同樣的顏色。
 */
const TONES = ["cream", "accent", "ink"] as const;

function toneOf(slug: string): (typeof TONES)[number] {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
}

function toListItem(row: ListRow): PortfolioListItem {
  // 封面來自 role = cover 的媒體。沒有封面時退回佔位色塊——
  // 寧可顯示色塊，也不要在頁面上放一張破圖。
  //
  // alt 為空的封面一律當作沒有封面：Spec §35 要求圖片必須有替代文字，
  // 而 PortfolioCard.cover 的型別也讓「有圖沒 alt」不可能成立。
  // 只接受指向自家 R2 的網址。
  //
  // 這不只是潔癖：next/image 遇到未設定的主機名會直接拋錯，
  // 一筆殘留的舊網址就能讓整個作品頁 500。降級成佔位色塊是正確的失敗方式——
  // 少一張圖，而不是整頁掛掉。
  const cover = (row.portfolio_media ?? []).find(
    (media) =>
      media.role === "cover" && media.alt && media.alt.trim() && keyFromPublicUrl(media.url),
  );

  return {
    cover: cover ? { url: cover.url, alt: cover.alt! } : undefined,
    id: row.slug,
    title: row.title,
    kicker: row.kicker ?? "",
    projectType: row.project_type,
    href: `/work/${row.slug}`,
    placeholderTone: toneOf(row.slug),
    categories: categoriesOf(row.portfolio_project_categories),
    tags: (row.portfolio_project_tags ?? [])
      .map((join) => join.portfolio_tags?.slug)
      .filter((slug): slug is string => Boolean(slug)),
    services: row.services ?? [],
  };
}

/** jsonb 欄位在型別上是 Json，取用前先確認它真的是物件 */
function asRecord(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export const supabasePortfolioRepository: PortfolioRepository = {
  async listCategories() {
    /*
     * 這裡**不**寫 `.eq("active", true)`。
     *
     * ⚠️ 我原本加了那一行，理由是「`active` 欄位沒有任何讀取端」。
     * 那是錯的——RLS policy 就是它的讀取端：
     *
     *   portfolio_categories_public_read  using (active or is_admin())
     *
     * 而這支查詢走的是**沒有 session 的 anon client**，所以停用的分類
     * 在資料庫那一層就已經看不到了。多寫的那一行不會擋掉任何東西，
     * 只會讓下一個人以為是應用層在擋——然後在別的地方忘記寫它。
     *
     * 發現方式：把那一行拿掉，測試照樣綠。刻意改壞才問得出來
     * 「到底是誰在擋」。
     *
     * （順帶：`audit:wiring`【3】把 `portfolio_categories.active` 列為
     *  「未接線欄位」，那是誤報——它只掃 TypeScript，看不到 SQL policy。）
     */
    const { data, error } = await getSupabasePublicClient()
      .from("portfolio_categories")
      .select("slug, name")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(`listCategories 失敗：${error.message}`);
    return (data ?? []).map((row) => ({ slug: row.slug, name: row.name }));
  },

  async listTags() {
    /*
     * 只回「有作品在用的」標籤。
     *
     * 走 join 表往回撈而不是整張 portfolio_tags：列出沒有任何作品的標籤，
     * 訪客按下去就是一片空白——一個永遠篩不出東西的按鈕比沒有更糟。
     *
     * ⚠️ 這裡看得到的作品受 RLS 限制（未發布的讀不到），所以只被草稿
     * 使用的標籤自然不會出現。那是對的：它對訪客而言確實不存在。
     */
    const { data, error } = await getSupabasePublicClient()
      .from("portfolio_project_tags")
      .select("portfolio_tags ( slug, name ), portfolio_projects!inner ( slug )")
      .returns<{ portfolio_tags: { slug: string; name: string } | null }[]>();

    if (error) throw new Error(`listTags 失敗：${error.message}`);

    const seen = new Map<string, string>();
    for (const row of data ?? []) {
      if (row.portfolio_tags) seen.set(row.portfolio_tags.slug, row.portfolio_tags.name);
    }

    return [...seen]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async listFeatured() {
    const { data, error } = await getSupabasePublicClient()
      .from("portfolio_projects")
      .select(LIST_SELECT)
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .returns<ListRow[]>();

    if (error) throw new Error(`listFeatured 失敗：${error.message}`);
    return (data ?? []).map(toListItem);
  },

  async listByGoal(goal: HomeGoal) {
    // 精選作品數量很少，取回後在記憶體篩選即可；
    // 且與 client 端使用同一支 filterByGoal，規則不會分岔。
    const featured = await supabasePortfolioRepository.listFeatured();
    return filterByGoal(featured, goal);
  },

  async listPublished(filter: PortfolioListFilter) {
    let query = getSupabasePublicClient()
      .from("portfolio_projects")
      .select(LIST_SELECT)
      .order("sort_order", { ascending: true });

    if (filter.projectType !== ALL_PROJECT_TYPES) {
      query = query.eq("project_type", filter.projectType);
    }

    const { data, error } = await query.returns<ListRow[]>();
    if (error) throw new Error(`listPublished 失敗：${error.message}`);

    const items = (data ?? []).map(toListItem);

    /*
     * 分類／標籤／服務的篩選在記憶體完成。
     *
     * PostgREST 對「巢狀關聯的條件」需要 inner join 語法，而那會連帶影響
     * 回傳的關聯資料（只剩符合條件的那幾筆），導致卡片上顯示的分類不完整。
     * 作品數量在此規模下不值得為此犧牲正確性。
     *
     * ⚠️ 用 `filterForList` 而不是在這裡自己寫條件：那支函式同時被
     * in-memory 實作使用，兩邊各寫一份的話，「Web + Logo」在有沒有資料庫
     * 的環境下會得到不同結果——而那種差異只會在正式環境出現。
     */
    return filterForList(items, filter);
  },

  async getBySlug(slug: string) {
    const { data, error } = await getSupabasePublicClient()
      .from("portfolio_projects")
      .select(DETAIL_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`getBySlug 失敗：${error.message}`);
    if (!data) return null; // 不存在與未發布走同一條路徑，不從差異洩漏草稿存在

    // 詳細查詢帶回更多媒體欄位，因此排除 ListRow 較窄的 portfolio_media 定義
    const row = data as unknown as Omit<ListRow, "portfolio_media" | "portfolio_project_tags"> & {
      industry: string | null;
      year: number | null;
      services: string[] | null;
      case_study_json: Json | null;
      links_json: Json | null;
      ai_disclosure_json: Json | null;
      portfolio_project_tags: TagJoin;
      portfolio_media: {
        id: string;
        type: PortfolioMedia["type"];
        url: string;
        thumbnail_url: string | null;
        alt: string | null;
        caption: string | null;
        role: PortfolioMedia["role"];
        sort_order: number;
      }[];
    };

    const caseStudyJson = asRecord(row.case_study_json);
    const caseStudy: PortfolioCaseStudy = {
      problem: pickString(caseStudyJson, "problem"),
      goal: pickString(caseStudyJson, "goal"),
      thinking: pickString(caseStudyJson, "thinking"),
      solution: pickString(caseStudyJson, "solution"),
      result: pickString(caseStudyJson, "result"),
    };

    const linksJson = asRecord(row.links_json);
    const links: PortfolioLinks = {
      live: pickString(linksJson, "live"),
      demo: pickString(linksJson, "demo"),
      figma: pickString(linksJson, "figma"),
      github: pickString(linksJson, "github"),
    };

    const aiJson = asRecord(row.ai_disclosure_json);
    const aiUsed = aiJson.used === true;

    const detail: PortfolioDetail = {
      id: row.slug,
      slug: row.slug,
      title: row.title,
      kicker: row.kicker ?? "",
      summary: row.summary ?? undefined,
      projectType: row.project_type,
      categories: categoriesOf(row.portfolio_project_categories),
      tags: (row.portfolio_project_tags ?? [])
        .map((entry) => entry.portfolio_tags?.name)
        .filter((name): name is string => Boolean(name)),
      services: row.services ?? [],
      industry: row.industry ?? undefined,
      year: row.year ?? undefined,
      caseStudy,
      links,
      placeholderTone: toneOf(row.slug),
      media: (row.portfolio_media ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        // 資料庫的 image_requires_alt 已保證圖片有 alt；
        // 其他型別若缺 alt 則跳過，寧可不顯示也不產生無替代文字的內容（Spec §35）
        // 同上：非自家儲存的網址一律不顯示，避免整頁因單一壞連結而崩潰
        .filter((media) => Boolean(media.alt) && Boolean(keyFromPublicUrl(media.url)))
        .map((media) => ({
          id: media.id,
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnail_url ?? undefined,
          alt: media.alt!,
          caption: media.caption ?? undefined,
          role: media.role,
        })),
      aiDisclosure: aiUsed
        ? { used: true, description: pickString(aiJson, "description") }
        : undefined,
    };

    return detail;
  },

  async listRelated(slug: string, limit: number) {
    const current = await supabasePortfolioRepository.getBySlug(slug);
    if (!current) return [];

    const all = await supabasePortfolioRepository.listPublished({
      category: ALL_CATEGORIES,
      projectType: ALL_PROJECT_TYPES,
    });

    const categories = new Set(current.categories);
    const others = all.filter((item) => item.id !== current.slug);

    // 同分類優先，不足時以其餘作品補滿，避免相關作品區時有時無
    const sameCategory = others.filter((item) =>
      item.categories.some((category) => categories.has(category)),
    );
    const rest = others.filter(
      (item) => !item.categories.some((category) => categories.has(category)),
    );

    return [...sameCategory, ...rest].slice(0, limit);
  },
};
