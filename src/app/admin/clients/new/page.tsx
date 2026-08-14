import { toAdminUrl } from "@/config/admin";

import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <>
      <h1 className="text-display-2">新增客戶</h1>
      <p className="text-body-sm text-brand-muted mt-2">
        從詢問轉過來的客戶不用在這裡建——到收件匣按「建立客戶」，聯絡方式會一起帶過來。
      </p>

      <ClientForm
        listHref={toAdminUrl("/admin/clients")}
        detailHrefPrefix={toAdminUrl("/admin/clients")}
        initial={{
          name: "",
          kind: "company",
          // 新建的一律從「潛在」開始。預設「合作中」會讓還沒談成的
          // 案子混進正在進行的清單裡
          status: "prospect",
          industry: "",
          source: "",
          note: "",
        }}
      />
    </>
  );
}
