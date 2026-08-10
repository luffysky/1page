import Link from "next/link";
import { notFound } from "next/navigation";

import { toAdminUrl } from "@/config/admin";
import { getProjectById, listProjectMedia } from "@/features/admin/portfolio-repository";

import { MediaManager } from "../media-manager";
import { ProjectForm } from "../project-form";

export default async function EditProjectPage({ params }: PageProps<"/admin/portfolio/[id]">) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) notFound();

  const media = await listProjectMedia(project.id);

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
        initial={{
          id: project.id,
          slug: project.slug,
          title: project.title,
          kicker: project.kicker ?? "",
          summary: project.summary ?? "",
          project_type: project.project_type,
          featured: project.featured,
          sort_order: project.sort_order,
        }}
      />

      <MediaManager projectId={project.id} media={media} />
    </>
  );
}
