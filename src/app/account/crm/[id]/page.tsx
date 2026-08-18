import Link from "next/link";
import { notFound } from "next/navigation";

import { removeCrmRecordAction } from "@/app/crm/actions";
import { requireMember } from "@/features/account/auth";
import {
  CrmDashboard,
  type DashboardLayout,
  parseDashboardLayout,
} from "@/components/crm/crm-dashboard";
import { CRM_LIMITS, type CrmField } from "@/features/crm-builder/schema";
import { headlineStats, recentActivity, summariseEntity } from "@/features/crm-builder/stats";
import { listAllCrmRecords, loadCrmDesign } from "@/features/crm-builder/store";

import { ImportRecords } from "@/components/crm/import-records";

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
  const now = new Date();
  const activity = recentActivity(records, now);
  const headline = headlineStats(stats, all, now);

  const layout = parseDashboardLayout(query.layout);

  /*
   * 切換排版時要保住目前在看哪一類。
   *
   * 少了 entity 的話，切一次排版就跳回第一類——而使用者只是想換個看法。
   */
  const hrefFor = (next: DashboardLayout) => {
    const search = new URLSearchParams();
    if (entityId) search.set("entity", entityId);
    search.set("layout", next);
    return `/account/crm/${id}?${search.toString()}`;
  };

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
        <CrmDashboard
          stats={stats}
          headline={headline}
          activity={activity}
          layout={layout}
          hrefFor={hrefFor}
        />
      </div>

      <section
        aria-labelledby="crm-records-heading"
        className="border-brand-line mt-12 border-t pt-10"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="crm-records-heading" className="text-heading-1">
            已經記下來的
          </h2>
          <span className="text-caption text-brand-muted">
            {records.length} / {CRM_LIMITS.recordsPerDefinition}
          </span>
        </div>

        <div className="mt-6">
          {records.length === 0 ? (
            <p className="border-brand-line text-body-sm text-brand-muted rounded-lg border border-dashed p-6">
              還沒有資料。下面填一筆就會出現在這裡。
            </p>
          ) : (
            /*
             * ── 橫向捲動的兩件事 ──────────────────────────────
             *
             * 1. **捲的是表格，不是整塊。**
             *    `overflow-x-auto` 在這個 div 上，所以圓角邊框、
             *    上面的「已經記下來的」與筆數都固定不動——
             *    只有表格在框裡面左右移。
             *    捲軸長在更外層的話，整頁會跟著晃，
             *    手機上連讀一段文字都要左右滑。
             *
             * 2. **第一欄釘住。**
             *    往右捲到第五欄時，如果第一欄跟著捲走，
             *    畫面上就只剩一排值而不知道是誰的——
             *    使用者得往回捲一次才對得起來。
             *    見下面 `sticky left-0` 的說明。
             *
             * 3. **`contain:paint` —— 捲動不要漏出去。**
             *    只有 `overflow-x-auto` 的話，整頁在 390px 下**仍然推得動
             *    39px**：表格的溢出寬度會傳到 documentElement 上
             *    （`html.scrollWidth` 429、`body` 390），而把這個 div 改成
             *    `overflow-x: hidden` 也擋不住——只有 `contain: paint` 擋得住。
             *
             *    ⚠️ 這件事本來有一條測試在守，但那條測試是假的：
             *    它用 `window.scrollTo(9999, 0)` 然後立刻讀 `scrollX`，
             *    而站台的 `<html>` 有 `scroll-behavior: smooth`——
             *    捲動是動畫的，讀到的永遠是 0。改成 `behavior: "instant"`
             *    之後才看見這 39px（0818 收尾稽核）。
             */
            <div className="border-brand-line overflow-x-auto rounded-lg border [contain:paint]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-brand-line border-b">
                    {entity.fields.map((field, index) => (
                      <th
                        key={field.id}
                        scope="col"
                        /*
                         * ⚠️ 釘住的那一欄要有**不透明**的底色。
                         *
                         * sticky 只是不跟著捲，不會擋住後面的東西——
                         * 沒有底色的話，捲過去的文字會直接透在它下面，
                         * 兩層字疊在一起。
                         * 用 `bg-brand-paper` 而不是寫死顏色（tokens.css 是唯一來源）。
                         */
                        className={`text-caption text-brand-muted px-4 py-3 text-left font-bold whitespace-nowrap ${
                          index === 0 ? "bg-brand-paper sticky left-0 z-10" : ""
                        }`}
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
                      {entity.fields.map((field, index) => (
                        <td
                          key={field.id}
                          className={`text-body-sm px-4 py-3 align-top ${
                            index === 0
                              ? "bg-brand-paper sticky left-0 z-10 font-bold whitespace-nowrap"
                              : ""
                          }`}
                        >
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
        </div>

        {/*
         * ⚠️ 表單在表格**下面**，而且收在原生的 `<details>` 裡。
         *
         * 兩次調整：
         *   1. 原本表單佔掉左半欄，把表格擠成半寬——而表格才是這一頁的
         *      主體（那是他的資料）。實測 5 個欄位就會直排成三行
         *      還加一條橫向捲軸。
         *   2. 改成整行寬之後表單跑到表格上面，結果要捲過一整個表單
         *      才看得到自己的資料。所以表單移到表格後面——
         *      **先給他看資料，再給他工具。**
         *
         * 用 `<details>` 而不是自己做開合：鍵盤、螢幕閱讀器、
         * 「上一頁回來時的展開狀態」全部是瀏覽器原生行為，
         * 不需要任何 JS，也不會有 hydration 的那一幀。
         *
         * ⚠️ `open` **不依賴筆數**。
         *
         * 第一版寫成 `open={records.length === 0}`，結果存完第一筆之後
         * 筆數從 0 變 1，server action 重繪時把 `open` 拿掉——
         * 表單自己收起來，而「記下來了」那句確認**跟著消失**。
         * 使用者看到的是表單憑空不見，沒有任何回饋。
         *
         * 固定展開之後：手動收起來會一直收著（沒有重繪就不會被覆蓋），
         * 而收起來的時候本來就存不了東西，所以「存完會重新展開」
         * 這件事不會讓任何人意外——那正是他要看確認的時刻。
         */}
        <details open className="mt-10">
          {/*
           * ⚠️ 標籤**不隨展開狀態改變**。
           *
           * 第一版用兩個 span 加 `group-open:hidden` 互換，結果
           * `<summary>` 的可及名稱把兩段串在一起——螢幕閱讀器唸出來是
           * 「＋ 新增一筆「客戶」收起表單」。`hidden` 的那一個仍然在
           * 可及性樹裡（Tailwind 的 `hidden` 是 display:none，
           * 這裡確實會被排除——但 `group-open:hidden` 在關閉時
           * 不套用，所以兩段同時存在）。
           *
           * 而且本來就不需要換：`<details>` 原生就會播報展開／收合，
           * 三角形也看得見。標籤跟著換只會讓兩邊講不一樣的話。
           */}
          <summary className="border-brand-ink text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink inline-flex cursor-pointer border px-5 py-2.5 font-bold transition-colors">
            新增一筆「{entity.name}」
          </summary>

          <div className="mt-6 max-w-xl">
            <RecordForm definitionId={id} entity={entity} />
          </div>
        </details>

        {/*
         * 匯入收在另一個 `<details>`，而且預設收起來。
         *
         * 與新增一筆分開：兩件事的步驟數差很多（一步 vs 選檔案、對應、確認），
         * 擺在同一個框裡會讓「填一筆」看起來很複雜。
         *
         * 預設收起來的理由與上面那個相反——這是偶爾做一次的事，
         * 而上面那個是每天都要做的事。
         */}
        <details className="mt-6">
          <summary className="border-brand-line text-body-sm rounded-pill hover:bg-brand-ink hover:text-brand-on-ink inline-flex cursor-pointer border px-5 py-2.5 font-bold transition-colors">
            用 Excel／CSV 匯入「{entity.name}」
          </summary>

          <div className="max-w-2xl">
            <ImportRecords definitionId={id} entity={entity} />
          </div>
        </details>
      </section>
    </>
  );
}
