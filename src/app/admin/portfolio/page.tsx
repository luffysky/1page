import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { listAllProjects } from "@/features/admin/portfolio-repository";
import { PROJECT_TYPE_LABELS } from "@/features/portfolio/project-type";

import { ProjectActions } from "./project-actions";

const STATUS_LABEL = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存",
} as const;

export default async function AdminPortfolioPage() {
  const projects = await listAllProjects();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-2">作品</h1>
          <p className="text-body-sm text-brand-muted mt-2">
            共 {projects.length} 件，其中 {projects.filter((p) => p.status === "published").length}{" "}
            件已發布。
          </p>
        </div>

        <Link
          href={toAdminUrl("/admin/portfolio/new")}
          className="bg-brand-accent-strong text-brand-on-accent text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          新增作品
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-10 rounded-lg border border-dashed p-12 text-center">
          還沒有任何作品。
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="border-brand-line bg-brand-paper rounded-lg border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={toAdminUrl(`/admin/portfolio/${project.id}`)}
                      className="text-heading-2 underline-offset-4 hover:underline"
                    >
                      {project.title}
                    </Link>

                    <span
                      className={`text-caption rounded-pill border px-2.5 py-0.5 ${
                        project.status === "published"
                          ? "border-brand-ink"
                          : "border-brand-line text-brand-muted"
                      }`}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>

                    <span className="text-caption text-brand-muted border-brand-line rounded-pill border px-2.5 py-0.5">
                      {PROJECT_TYPE_LABELS[project.project_type]}
                    </span>

                    {project.featured ? (
                      <span className="text-caption text-brand-accent-strong border-brand-accent-strong rounded-pill border px-2.5 py-0.5 font-bold">
                        精選
                      </span>
                    ) : null}
                  </div>

                  <p className="text-caption text-brand-muted mt-2 font-mono">
                    /work/{project.slug}
                  </p>
                  {project.kicker ? (
                    <p className="text-caption text-brand-muted mt-1">{project.kicker}</p>
                  ) : null}
                </div>

                <ProjectActions
                  id={project.id}
                  status={project.status}
                  featured={project.featured}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
