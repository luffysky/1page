import Link from "next/link";
import { notFound } from "next/navigation";

import { removeCrmRecordAction } from "@/app/crm/actions";
import { requireMember } from "@/features/account/auth";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CRM_LIMITS, type CrmField } from "@/features/crm-builder/schema";
import { recentActivity, summariseEntity } from "@/features/crm-builder/stats";
import { listAllCrmRecords, loadCrmDesign } from "@/features/crm-builder/store";

import { RecordForm } from "./record-form";

/**
 * 照著自己設計的 CRM 填資料（CR-003-5）
 *
 * ⚠️ 這一頁是 `crm_records` 的**讀取端與寫入端**。
 * 只做設計器而不做這一頁的話，`crm_records` 就是一張 migration 跑了
 * 但沒有任何程式碼的孤兒表——而 0815 的 `audit:wiring【3a】`
 * 就是為了抓這件事才改寫的（當時抓到三張）。
 */

/** 顯示成人看得懂的字。undefined 與空字串在畫面上是同一件事：沒填 */
function present(field: CrmField, value: unknown): string {
  if (field.type === "checkbox") return value ? "是" : "否";
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

export default async function CrmRecordsPage({
  params,
  searchParams,
}: PageProps<"/account/crm/[id]">) {
  await requireMember("/account/crm");

  const { id } = await params;
  const query = await searchParams;

  const design = await loadCrmDesign(id);
  // 「找不到」與「不是你的」在 RLS 之後是同一件事，都走 404。
  // 區分等於告訴對方「這個 id 存在，只是不給你看」
  if (!design.ok) notFound();

  const entityId = typeof query.entity === "string" ? query.entity : null;
  const entity =
    design.definition.entities.find((item) => item.id === entityId) ??
    design.definition.entities[0]!;

  /*
   * 一次撈全部，統計與下面的清單共用同一份資料。
   *
   * ⚠️ 分兩次查的話，中間有人新增一筆，dashboard 的數字就會與
   * 清單的筆數對不起來——而那種不一致沒有人解釋得了。
   * 每份設計最多 500 筆（資料庫的 trigger 擋著），一次查完最省。
   */
  const all = await listAllCrmRecords(id);
  const records = all.filter((record) => record.entity === entity.id);

  const stats = summariseEntity(entity, all);
  /*
   * 「今天」在這裡取，不在 `recentActivity` 裡面——
   * 那支函式要保持純的，測試才寫得出來（見它的檔頭）。
   */
  const activity = recentActivity(records, new Date());

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-display-2">{design.definition.name}</h1>
        <Link
          href={`/crm?id=${id}`}
          className="text-body-sm text-brand-muted underline underline-offset-4"
        >
          改設計
        </Link>
      </div>

      {design.definition.entities.length > 1 ? (
        <nav aria-label="切換類別" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {design.definition.entities.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/account/crm/${id}?entity=${item.id}`}
                  aria-current={item.id === entity.id ? "page" : undefined}
                  className={`text-body-sm rounded-pill border px-4 py-2 ${
                    item.id === entity.id
                      ? "border-brand-ink bg-brand-ink text-brand-on-ink font-bold"
                      : "border-brand-line"
                  }`}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-10">
        <CrmDashboard stats={stats} activity={activity} />
      </div>

      <div className="border-brand-line mt-12 grid gap-8 border-t pt-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <RecordForm definitionId={id} entity={entity} />

        <section aria-labelledby="crm-records-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="crm-records-heading" className="text-heading-1">
              已經記下來的
            </h2>
            <span className="text-caption text-brand-muted">
              {records.length} / {CRM_LIMITS.recordsPerDefinition}
            </span>
          </div>

          {records.length === 0 ? (
            <p className="border-brand-line text-body-sm text-brand-muted mt-4 rounded-lg border border-dashed p-6">
              還沒有資料。左邊填一筆就會出現在這裡。
            </p>
          ) : (
            /*
             * 表格用橫向捲動包起來，欄位多的時候不會把整頁撐寬。
             * 頁面本身橫向捲動的話，手機上連讀一段文字都要左右滑。
             */
            <div className="border-brand-line mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-brand-line border-b">
                    {entity.fields.map((field) => (
                      <th
                        key={field.id}
                        scope="col"
                        className="text-caption text-brand-muted px-4 py-3 text-left font-bold whitespace-nowrap"
                      >
                        {field.label}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-brand-line border-b last:border-b-0">
                      {entity.fields.map((field) => (
                        <td key={field.id} className="text-body-sm px-4 py-3 align-top">
                          {present(field, record.data[field.id])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right align-top">
                        <form action={removeCrmRecordAction}>
                          <input type="hidden" name="id" value={record.id} />
                          <input type="hidden" name="definitionId" value={id} />
                          <button
                            type="submit"
                            className="text-caption text-brand-muted underline underline-offset-4"
                          >
                            刪除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
