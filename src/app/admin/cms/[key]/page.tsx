import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { restoreCmsRevision } from "@/features/cms/actions";
import { readCmsDocument } from "@/features/cms/read";
import { CMS_DOCUMENTS, isCmsKey } from "@/features/cms/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CmsEditor } from "./cms-editor";

/**
 * 編輯一份 CMS 文件（CR-004 / Phase B BH）
 */

export default async function AdminCmsDocumentPage({ params }: PageProps<"/admin/cms/[key]">) {
  const { key } = await params;

  // 不認得的 key 直接 404。registry 是唯一的合法清單
  if (!isCmsKey(key)) notFound();

  const definition = CMS_DOCUMENTS[key];
  const current = await readCmsDocument(key);

  const supabase = await createSupabaseServerClient();

  const { data: revisions } = await supabase
    .from("cms_revisions")
    .select("id, saved_at")
    .eq("document_key", key)
    .order("saved_at", { ascending: false })
    .limit(20);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">{definition.label}</h1>
          <p className="text-body-sm text-brand-muted mt-2">影響：{definition.affects}</p>
          <p className="text-caption text-brand-muted mt-1 font-mono">{key}</p>
        </div>

        <Link
          href={toAdminUrl("/admin/cms")}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
        >
          回內容管理
        </Link>
      </div>

      <CmsEditor cmsKey={key} initial={current} />

      {/*
       * 版本清單。
       *
       * 這一段是「沒有草稿狀態」那個決定的另一半：不做發佈流程，
       * 但一定要能回到上一版。少了它，改壞一句文案就只能靠記憶重打。
       */}
      <section className="border-brand-line mt-12 border-t pt-8">
        <h2 className="text-heading-2">版本紀錄</h2>
        <p className="text-body-sm text-brand-muted mt-2">
          每次存檔留一版，最多 20 版（由資料庫的 trigger 修剪）。
        </p>

        {(revisions ?? []).length === 0 ? (
          <p className="text-body-sm text-brand-muted mt-4">還沒有存過任何版本。</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {(revisions ?? []).map((revision, index) => (
              <li
                key={revision.id as string}
                className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <span className="text-body-sm">
                  {new Date(revision.saved_at as string).toLocaleString("zh-TW")}
                  {index === 0 ? (
                    <span className="text-caption text-brand-muted ml-2">（目前這一版）</span>
                  ) : null}
                </span>

                {index > 0 ? (
                  <form action={restoreCmsRevision}>
                    <input type="hidden" name="key" value={key} />
                    <input type="hidden" name="revisionId" value={revision.id as string} />
                    <button
                      type="submit"
                      className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
                    >
                      還原成這一版
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
