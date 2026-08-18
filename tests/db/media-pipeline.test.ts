import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { supabasePortfolioRepository as repo } from "@/features/portfolio/supabase-repository";
import { buildObjectKey, createUploadUrl, publicUrlFor } from "@/lib/storage/r2";

/**
 * 媒體從上傳到公開呈現的完整鏈路（2F）。
 *
 * 這是 2F 真正要證明的事：檔案傳上 R2 之後，公開頁面確實會顯示它，
 * 而且是以正確的替代文字與角色呈現。
 *
 * 種子資料刻意不含媒體（早期版本放假網址，結果 2F 接上封面後讓整頁 500），
 * 因此本測試自己上傳、自己清乾淨。
 */

const SLUG = "interior-studio";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** 1×1 透明 PNG，最小的合法圖片 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sql(query: string) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`SQL 失敗：${await response.text()}`);
  return response.json() as Promise<Record<string, string>[]>;
}

let objectKey: string;
let projectId: string;

beforeAll(async () => {
  const rows = await sql(`select id from public.portfolio_projects where slug = '${SLUG}'`);
  projectId = rows[0]!.id!;

  objectKey = buildObjectKey(projectId, "png");

  // 走真正的簽名流程上傳，而不是用管理權限直接塞——
  // 這樣測到的才是使用者實際會走的那條路
  const uploadUrl = await createUploadUrl({
    key: objectKey,
    contentType: "image/png",
    contentLength: PNG.byteLength,
  });

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: PNG,
  });
  if (put.status !== 200) throw new Error(`上傳失敗 HTTP ${put.status}`);

  await sql(`
    insert into public.portfolio_media (project_id, type, url, alt, role, sort_order)
    values ('${projectId}', 'image', '${publicUrlFor(objectKey)}', '端到端測試用的封面圖', 'cover', 0)
  `);
});

afterAll(async () => {
  await sql(`delete from public.portfolio_media where project_id = '${projectId}'`).catch(() => {});
  await s3
    .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: objectKey }))
    .catch(() => {});
});

describe("上傳後的媒體出現在公開端", () => {
  it("物件確實公開可讀", async () => {
    const response = await fetch(publicUrlFor(objectKey));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("列表卡片帶出封面與替代文字", async () => {
    const items = await repo.listFeatured();
    const target = items.find((item) => item.id === SLUG);

    expect(target?.cover?.url).toBe(publicUrlFor(objectKey));
    expect(target?.cover?.alt).toBe("端到端測試用的封面圖");
  });

  it("詳細頁帶回媒體", async () => {
    const project = await repo.getBySlug(SLUG);
    expect(project?.media).toHaveLength(1);
    expect(project?.media[0]?.alt).toBe("端到端測試用的封面圖");
    expect(project?.media[0]?.role).toBe("cover");
  });
});

describe("非自家儲存的網址不會讓頁面崩潰", () => {
  it("外部網址的封面會被忽略，降級為佔位塊", async () => {
    // next/image 遇到未設定的主機名會直接拋錯，一筆殘留的舊網址
    // 就能讓整個作品頁 500。正確的失敗方式是少一張圖，不是整頁掛掉。
    await sql(`
      update public.portfolio_media
      set url = 'https://example.invalid/old-cover.png'
      where project_id = '${projectId}'
    `);

    const items = await repo.listFeatured();
    const target = items.find((item) => item.id === SLUG);
    expect(target?.cover).toBeUndefined();

    const project = await repo.getBySlug(SLUG);
    expect(project?.media).toHaveLength(0);

    await sql(`
      update public.portfolio_media
      set url = '${publicUrlFor(objectKey)}'
      where project_id = '${projectId}'
    `);
  });
});

describe("圖片尺寸（0818：取代 thumbnail_url）", () => {
  /*
   * ── 這一組在守什麼 ────────────────────────────────────────────
   *
   * `thumbnail_url` 從 0810 建表起就兩端都沒有：沒有人寫，也沒有人畫。
   * 待辦上原本寫「要接一條產生縮圖的路徑」，但真的接了會疊出第二套
   * 更差的機制——next/image 的最佳化器本來就會依 sizes 產出對的尺寸。
   *
   * 它掩蓋掉的真問題是相簿沒有留位置（CLS）。所以改存原始尺寸。
   *
   * 尺寸**必須成對**：只有一邊的話長寬比算不出來，next/image 會依一個
   * 錯的比例留位置，圖片載入後再跳一次——那比完全不給更糟，
   * 因為不給的時候渲染端知道要走 fallback。
   */

  it("只給寬不給高，資料庫直接擋下來", async () => {
    await expect(
      sql(`
        update public.portfolio_media
        set width = 1200, height = null
        where project_id = '${projectId}'
      `),
    ).rejects.toThrow(/media_dimensions_paired/);
  });

  it("成對寫入之後，公開端拿得到那組尺寸", async () => {
    await sql(`
      update public.portfolio_media
      set width = 1200, height = 800
      where project_id = '${projectId}'
    `);

    const project = await repo.getBySlug(SLUG);
    expect(project?.media[0]?.width).toBe(1200);
    expect(project?.media[0]?.height).toBe(800);
  });

  it("沒有尺寸的舊資料照樣讀得回來——不是把它濾掉", async () => {
    // 0818 之前上傳的媒體沒有尺寸。把它們當成壞資料濾掉的話，
    // 升級的當下所有既有作品的相簿會一起消失
    await sql(`
      update public.portfolio_media
      set width = null, height = null
      where project_id = '${projectId}'
    `);

    const project = await repo.getBySlug(SLUG);
    expect(project?.media).toHaveLength(1);
    expect(project?.media[0]?.width).toBeUndefined();
  });
});
