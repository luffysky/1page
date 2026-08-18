"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getAdminIdentity } from "./auth";

/**
 * 後台的寫入操作（Spec §8.8）。
 *
 * ── 三件事每個 action 都必須做 ──────────────────────────────
 *   1. 驗證身分（不能假設呼叫端已經驗過——Server Action 的網址是公開的）
 *   2. 驗證輸入（Zod，Spec §36）
 *   3. 讓 RLS 當最後一道關（用帶 cookie 的 anon client，不是 service role）
 *
 * ⚠️ Server Action 會被編譯成一個可從瀏覽器直接呼叫的端點。
 * 「這個按鈕只有 admin 看得到」完全不構成保護——任何人都能自己組出請求。
 * 因此每一支都獨立驗證，而不是倚賴頁面層的 requireAdmin()。
 */

async function requireStaff() {
  const identity = await getAdminIdentity();
  if (!identity) {
    // 不說明原因：對方若不是後台人員，連「這裡有後台」都不該確認
    throw new Error("Not found");
  }
  return identity;
}

const slugSchema = z
  .string()
  .trim()
  .min(1, "網址代稱不可空白")
  .max(80, "網址代稱過長")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "只能使用小寫英數與連字號，且不可連續或前後有連字號");

/**
 * 選填的長文欄位。
 *
 * 空字串一律當作「沒有」——Spec §8.10 明文要求「沒有完整 Case Study 資料時
 * 只顯示存在的區塊，不要顯示空 Section」。存一個空字串進去的話，
 * 公開頁面會多出一個只有標題的區塊。
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

/**
 * 相關連結。
 *
 * 站內路徑或 https，與 SiteConfig 的 `linkTarget` 同一條規則。
 * 這些網址會被放進公開頁面的 `<a href>`，`javascript:` 之類的東西
 * 不該從後台表單流進去——後台是自己人在用，但「自己人」不是安全模型。
 *
 * ⚠️ 第一版只收 https，而 `interior-studio` 的 demo 連結是
 * `/work/interior-studio`（站內路徑）。那個值合法、也一直在公開頁面上，
 * 但表單存不回去——**打開那件作品、什麼都不改、按儲存就會失敗**。
 * 用真的資料跑一次才問得出來。
 */
const optionalLink = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => !value || /^\/(?![/\\])/.test(value) || /^https:\/\//.test(value),
    "連結必須是站內路徑（/ 開頭）或 https:// 網址",
  )
  .transform((value) => value || undefined)
  .optional();

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().trim().min(1, "標題不可空白").max(200),
  kicker: z.string().trim().max(120).optional().or(z.literal("")),
  summary: z.string().trim().max(500).optional().or(z.literal("")),
  project_type: z.enum(["client", "concept", "demo", "internal"]),
  featured: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),

  industry: optionalText(60),
  /*
   * 年份用 nullable 而不是 optional：欄位清空時要真的把資料庫那格清掉，
   * 而 `undefined` 在 update payload 裡等於「不要動這一欄」。
   */
  year: z.number().int().min(1900).max(2100).nullable().catch(null),
  services: z.array(z.string().max(40)).max(10),
  /*
   * 分類是 slug 清單；標籤是使用者打的名字。
   *
   * 兩者刻意不同型別：分類是一份固定的清單（後台選），
   * 標籤是自由文字（打了就長出來）。用同一種輸入法會讓人以為
   * 分類也能隨手新增，而那會讓篩選器長出一堆一次性的分類。
   */
  categories: z.array(z.string().max(64)).max(10),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),

  // Spec §8.10 的五段。全部選填
  case_study: z.object({
    problem: optionalText(2000),
    goal: optionalText(2000),
    thinking: optionalText(2000),
    solution: optionalText(2000),
    result: optionalText(2000),
  }),

  links: z.object({
    live: optionalLink,
    demo: optionalLink,
    figma: optionalLink,
    github: optionalLink,
  }),

  // Spec §28：AI 揭露。沒有使用 AI 時公開頁面不顯示這個區塊
  ai_disclosure: z.object({
    used: z.boolean(),
    description: optionalText(1000),
  }),
});

export type ActionResult = { ok: true } | { ok: false; message: string };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function readForm(formData: FormData) {
  const year = text(formData, "year").trim();

  return projectSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    kicker: formData.get("kicker") ?? "",
    summary: formData.get("summary") ?? "",
    project_type: formData.get("project_type"),
    featured: formData.get("featured") === "on",
    sort_order: Number(formData.get("sort_order") ?? 0),

    industry: text(formData, "industry"),
    // 空字串轉 null（清掉年份），不是 NaN——NaN 會讓整份表單驗證失敗，
    // 而使用者只是想把年份留白
    year: year === "" ? null : Number(year),
    services: formData.getAll("services").map(String),
    categories: formData.getAll("categories").map(String),
    /*
     * 標籤是一個文字欄位，用逗號或頓號分隔。
     *
     * 多選清單在這裡不好用：標籤會長到幾十個，而一件作品只掛兩三個。
     * 打字 + 既有標籤的建議清單（datalist）比捲一份長清單快得多。
     */
    tags: text(formData, "tags")
      .split(/[,、]/)
      .map((tag) => tag.trim())
      .filter(Boolean),

    case_study: {
      problem: text(formData, "case_study.problem"),
      goal: text(formData, "case_study.goal"),
      thinking: text(formData, "case_study.thinking"),
      solution: text(formData, "case_study.solution"),
      result: text(formData, "case_study.result"),
    },

    links: {
      live: text(formData, "links.live"),
      demo: text(formData, "links.demo"),
      figma: text(formData, "links.figma"),
      github: text(formData, "links.github"),
    },

    ai_disclosure: {
      used: formData.get("ai_disclosure.used") === "on",
      description: text(formData, "ai_disclosure.description"),
    },
  });
}

function revalidateAll(slug?: string) {
  // 公開頁面全部是動態渲染，但 revalidate 仍會清掉 Next 的 Router Cache，
  // 讓管理者存檔後立刻在前台看到結果，而不是等快取自然過期
  revalidatePath("/");
  revalidatePath("/work");
  if (slug) revalidatePath(`/work/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function saveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "輸入有誤" };
  }

  const {
    id,
    kicker,
    summary,
    industry,
    case_study,
    links,
    ai_disclosure,
    categories,
    tags,
    ...rest
  } = parsed.data;

  /*
   * 三個 jsonb 欄位一律整份覆寫，而且把空的鍵拿掉。
   *
   * 留著 `{ problem: undefined }` 的話，JSON 序列化會把它丟掉——
   * 那剛好是對的。但留著空字串就不對了：公開頁面的
   * `presentCaseStudySections` 過濾的是「有沒有內容」，而空字串
   * 會通過 `Boolean(section.body)` 之前的那一關嗎？不會——
   * 它有 trim 判斷。即使如此還是不要存：資料庫裡一堆空字串會讓
   * 「這件作品有沒有寫 case study」這個問題查不出答案。
   */
  const compact = (source: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));

  const payload = {
    ...rest,
    kicker: kicker || null,
    summary: summary || null,
    industry: industry ?? null,
    case_study_json: compact(case_study),
    links_json: compact(links),
    /*
     * 沒有使用 AI 就整份存空物件，不是 `{ used: false }`。
     *
     * 公開頁面判斷的是 `aiJson.used === true`，兩種寫法在畫面上一樣。
     * 但存 `{ used: false, description: "…" }` 會把一段沒有人看得到的
     * 文字留在資料庫裡——之後有人把 used 打開，那段舊文字就會突然出現。
     */
    ai_disclosure_json: ai_disclosure.used ? compact(ai_disclosure) : {},
  };

  const supabase = await createSupabaseServerClient();

  /*
   * 新增時要把 id 拿回來——分類與標籤是 join 表，沒有 id 就寫不進去。
   *
   * RLS 的 `portfolio_projects_admin_all` 允許後台人員讀，所以這裡回得來。
   * （Phase 5 的 leads 踩過相反的情況：insert 成功但 select 被擋，
   *  看起來像新增失敗。這裡不會，因為權限是全開的。）
   */
  const saved = id
    ? await supabase.from("portfolio_projects").update(payload).eq("id", id).select("id").single()
    : await supabase
        .from("portfolio_projects")
        .insert({ ...payload, status: "draft" })
        .select("id")
        .single();

  if (saved.error) {
    // 唯一鍵衝突給出可讀訊息，而不是把資料庫錯誤原文丟給使用者
    if (saved.error.code === "23505") return { ok: false, message: "這個網址代稱已經有人用了" };
    return { ok: false, message: `儲存失敗：${saved.error.message}` };
  }

  const taxonomyError = await saveTaxonomy(saved.data.id, categories, tags);
  if (taxonomyError) return { ok: false, message: taxonomyError };

  revalidateAll(payload.slug);
  return { ok: true };
}

/** 標籤名 → slug。與種子資料同一種形式（小寫、連字號） */
function toTagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9一-鿿-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 寫回分類與標籤。
 *
 * ── 為什麼是「整組刪掉再寫回」 ────────────────────────────────
 *
 * 算差集（哪些要加、哪些要刪）在這個規模下只是多一份會寫錯的邏輯。
 * 一件作品最多十個分類，刪掉重寫的成本可以忽略，而且它天然是冪等的——
 * 存兩次的結果一定一樣。
 *
 * ⚠️ 順序是先刪後寫。反過來的話中間會有一瞬間出現重複，
 * 而 join 表若有唯一鍵就會直接失敗。
 */
async function saveTaxonomy(
  projectId: string,
  categorySlugs: string[],
  tagNames: string[],
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // ── 分類 ──
  const { data: categoryRows } = await supabase
    .from("portfolio_categories")
    .select("id, slug")
    .in("slug", categorySlugs.length > 0 ? categorySlugs : ["__none__"]);

  await supabase.from("portfolio_project_categories").delete().eq("project_id", projectId);

  if ((categoryRows ?? []).length > 0) {
    const { error } = await supabase
      .from("portfolio_project_categories")
      .insert((categoryRows ?? []).map((row) => ({ project_id: projectId, category_id: row.id })));

    if (error) return `分類儲存失敗：${error.message}`;
  }

  // ── 標籤：不存在的先建立 ──
  const wanted = [
    ...new Set(
      tagNames.map((name) => ({ name, slug: toTagSlug(name) })).map((t) => JSON.stringify(t)),
    ),
  ]
    .map((json) => JSON.parse(json) as { name: string; slug: string })
    .filter((tag) => tag.slug.length > 0);

  await supabase.from("portfolio_project_tags").delete().eq("project_id", projectId);

  if (wanted.length === 0) return null;

  /*
   * upsert 而不是「先查再決定要不要插」：兩個人同時存檔時，
   * 「查到沒有 → 插入」中間會撞在一起。onConflict 交給資料庫判斷。
   */
  const { error: tagError } = await supabase
    .from("portfolio_tags")
    .upsert(wanted, { onConflict: "slug" });

  if (tagError) return `標籤儲存失敗：${tagError.message}`;

  const { data: tagRows } = await supabase
    .from("portfolio_tags")
    .select("id")
    .in(
      "slug",
      wanted.map((tag) => tag.slug),
    );

  if ((tagRows ?? []).length > 0) {
    const { error } = await supabase
      .from("portfolio_project_tags")
      .insert((tagRows ?? []).map((row) => ({ project_id: projectId, tag_id: row.id })));

    if (error) return `標籤儲存失敗：${error.message}`;
  }

  return null;
}

/**
 * 發布 / 下架。
 *
 * `published_at` 由此處一併設定：資料庫有 `published_has_timestamp` 約束
 * （已發布必有時間、未發布必無），漏設會被資料庫擋下來。
 */
export async function setProjectStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, message: `狀態更新失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}

export async function setProjectFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .update({ featured })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, message: `更新失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}

/**
 * 刪除。
 *
 * 刻意不提供「一鍵刪除」的快捷入口——Spec §8.8 雖然列了 Delete，
 * 但作品是累積型資產（Spec §44 的飛輪），誤刪的代價遠高於封存。
 * 因此後台列表只提供封存，刪除需進到編輯頁並明確確認。
 */
export async function deleteProject(id: string): Promise<ActionResult> {
  await requireStaff();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
  if (error) return { ok: false, message: `刪除失敗：${error.message}` };

  revalidateAll(data?.slug);
  return { ok: true };
}
