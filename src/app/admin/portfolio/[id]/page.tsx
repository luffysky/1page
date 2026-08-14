import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import {
  asStringRecord,
  getProjectById,
  getProjectTaxonomy,
  listAllCategories,
  listAllTags,
  listProjectMedia,
} from "@/features/admin/portfolio-repository";

import { MediaManager } from "../media-manager";
import { ProjectForm } from "../project-form";

export default async function EditProjectPage({ params }: PageProps<"/admin/portfolio/[id]">) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) notFound();

  const [media, taxonomy, allCategories, allTags] = await Promise.all([
    listProjectMedia(project.id),
    getProjectTaxonomy(project.id),
    listAllCategories(),
    listAllTags(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">編輯作品</h1>
          <p className="text-caption text-brand-muted mt-2 font-mono">/work/{project.slug}</p>
        </div>

        {project.status === "published" ? (
          <Link
            href={`/work/${project.slug}`}
            className="border-brand-line text-body-sm rounded-pill border px-5 py-2.5"
          >
            檢視公開頁面 ↗
          </Link>
        ) : (
          <p className="text-caption text-brand-muted">草稿尚未公開，訪客看不到。</p>
        )}
      </div>

      <ProjectForm
        listHref={toAdminUrl("/admin/portfolio")}
        allCategories={allCategories}
        allTags={allTags}
        initial={{
          id: project.id,
          slug: project.slug,
          title: project.title,
          kicker: project.kicker ?? "",
          summary: project.summary ?? "",
          project_type: project.project_type,
          featured: project.featured,
          sort_order: project.sort_order,

          industry: project.industry ?? "",
          // 表單欄位是字串；`0` 與空白要分得出來，所以不能用 `?? ""` 之外的簡寫
          year: project.year === null ? "" : String(project.year),
          services: project.services ?? [],
          categories: taxonomy.categories,
          tags: taxonomy.tags,
          caseStudy: asStringRecord(project.case_study_json),
          links: asStringRecord(project.links_json),
          aiUsed:
            typeof project.ai_disclosure_json === "object" &&
            project.ai_disclosure_json !== null &&
            !Array.isArray(project.ai_disclosure_json) &&
            project.ai_disclosure_json.used === true,
          aiDescription: asStringRecord(project.ai_disclosure_json).description ?? "",
        }}
      />

      <MediaManager projectId={project.id} media={media} />
    </>
  );
}
