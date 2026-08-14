import { toAdminUrl } from "@/config/admin";

import { ProjectForm } from "../project-form";

export default function NewProjectPage() {
  return (
    <>
      <h1 className="text-display-2">新增作品</h1>
      <p className="text-body-sm text-brand-muted mt-2">建立後預設為草稿，確認內容無誤再發布。</p>

      <ProjectForm
        listHref={toAdminUrl("/admin/portfolio")}
        initial={{
          slug: "",
          title: "",
          kicker: "",
          summary: "",
          // 預設 demo 而非 client：新增時若不小心略過這一欄，
          // 錯誤的方向應該是「低估自己」，而不是宣稱有客戶案例（Spec §29）
          project_type: "demo",
          featured: false,
          sort_order: 0,

          // 新作品一律留白。預設文字會被原封不動地留在公開頁面上
          industry: "",
          year: "",
          services: [],
          caseStudy: {},
          links: {},
          aiUsed: false,
          aiDescription: "",
        }}
      />
    </>
  );
}
