import Link from "next/link";

import { CRM_FIELD_TYPE_LABELS } from "@/features/crm-builder/schema";
import {
  type EntityStats,
  type FieldSummary,
  type Headline,
  MIN_RECORDS_FOR_CHARTS,
} from "@/features/crm-builder/stats";

/**
 * CRM Dashboard（CR-003-5）
 *
 * ── 這一頁的內容由使用者的定義決定 ────────────────────────────
 *
 * 與記錄表單同一招：**照著資料的形狀長出來**。寫死「客戶數與成交率」
 * 的話，一個拿它記食材庫存的人會看到兩個永遠是 0 的數字。
 *
 * 統計本身在 `features/crm-builder/stats.ts`，是純函式而且有測試。
 * 這支元件只負責畫。
 *
 * ── 兩種排版，使用者自己選 ────────────────────────────────────
 *
 * 卡片：一眼掃過去，適合欄位多的時候。
 * 橫列：左邊名字大字、右邊分布，適合欄位少而且想細看的時候。
 *
 * ⚠️ 選擇存在**網址**裡（`?layout=`），不是 localStorage。
 * 與 Goal Selector 同一個判斷（Spec §6.1）：可分享、重新整理不掉、
 * 而且不需要在 client 補一次狀態（那會有一幀是預設值）。
 * 代價是換一台裝置要再選一次——這個頁面不值得為它加一張表。
 */

export type DashboardLayout = "cards" | "rows";

export const DASHBOARD_LAYOUTS: readonly DashboardLayout[] = ["cards", "rows"];

/** 網址參數是不可信輸入。認不得的一律回預設值，不要讓畫面因為一個字而空掉 */
export const parseDashboardLayout = (raw: unknown): DashboardLayout =>
  raw === "rows" ? "rows" : "cards";

/* ------------------------------------------------------------------ */
/* 共用的小東西                                                        */
/* ------------------------------------------------------------------ */

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  /*
   * 分母是 0 時寬度給 0，不給 NaN。
   *
   * `0/0` 在 CSS 裡是 `NaN%`，瀏覽器會忽略整條寬度宣告——
   * 結果是每一條都變成滿版，看起來像「全部都是 100%」。
   */
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <li className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-body-sm text-brand-muted truncate" title={label}>
        {label}
      </span>
      <span className="bg-brand-line h-1.5 overflow-hidden rounded-pill">
        <span className="bg-brand-ink block h-full" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-caption text-brand-muted tabular-nums">
        {count}
        <span className="opacity-60"> · {percent}%</span>
      </span>
    </li>
  );
}

/** 一個欄位能說的話。兩種排版共用，只有外框不一樣 */
function FieldBody({ summary }: { summary: FieldSummary }) {
  const { field, filled, total, buckets, numeric, range } = summary;

  return (
    <>
      {/*
       * checkbox 不顯示填寫率——沒勾也是一個答案，那個比例沒有意義
       * （見 stats.ts 的同一段說明）。
       */}
      {field.type !== "checkbox" ? (
        <p className="text-caption text-brand-muted">
          {filled} / {total} 筆有填
          {filled < total ? `（${total - filled} 筆空白）` : ""}
        </p>
      ) : null}

      {buckets.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {buckets.map((bucket) => (
            <Bar key={bucket.label} label={bucket.label} count={bucket.count} total={total} />
          ))}
        </ul>
      ) : null}

      {numeric ? (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-caption text-brand-muted">總計</dt>
            <dd className="text-heading-1 tabular-nums">{numeric.sum.toLocaleString("zh-TW")}</dd>
          </div>
          <div>
            <dt className="text-caption text-brand-muted">平均</dt>
            <dd className="text-heading-1 tabular-nums">
              {/* 平均不四捨五入到整數：一筆 1 元一筆 2 元的平均是 1.5，寫成 2 是錯的 */}
              {numeric.average.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}
            </dd>
          </div>
        </dl>
      ) : null}

      {range ? (
        <p className="text-body-sm mt-3 tabular-nums">
          {range.earliest} — {range.latest}
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 頂部的數字帶                                                        */
/* ------------------------------------------------------------------ */

function NumberBand({ headline, entityName }: { headline: Headline; entityName: string }) {
  /*
   * ⚠️ 深色。
   *
   * 整頁在米色底上放米色卡，對比很低、也沒有節奏。首頁的 DarkCtaBlock
   * 已經有這個語彙，這裡沿用同一個 token（`--color-brand-ink`）——
   * 不引進任何新顏色，只是把一頁分成兩個色階。
   *
   * 數字放在最上面而且最大，是因為那才是他打開這一頁想知道的事。
   * 原本「共 N 筆」是右上角的小字。
   */
  return (
    <div className="bg-brand-ink text-brand-on-ink rounded-2xl p-8 md:p-10">
      <p className="text-kicker uppercase opacity-70">{entityName}</p>

      <dl className="mt-5 flex flex-wrap gap-x-14 gap-y-6">
        <div>
          <dt className="text-caption opacity-70">總共</dt>
          <dd className="text-display-2 tabular-nums">{headline.total}</dd>
        </div>

        <div>
          <dt className="text-caption opacity-70">最近七天</dt>
          <dd className="text-display-2 tabular-nums">
            {/* 0 的時候不寫「+0」——那讀起來像有進度，實際上沒有 */}
            {headline.thisWeek > 0 ? `+${headline.thisWeek}` : "—"}
          </dd>
        </div>

        {/*
         * 「最多的 X」只有在真的有 select 欄位、而且有人選過時才出現。
         * 沒有就少一格——不編造一個看起來像洞察的東西（見 stats.ts）。
         */}
        {headline.top ? (
          <div className="min-w-0">
            <dt className="text-caption opacity-70">最多的{headline.top.fieldLabel}</dt>
            <dd className="text-display-2 truncate">{headline.top.label}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 排版切換                                                            */
/* ------------------------------------------------------------------ */

const LAYOUT_LABELS: Record<DashboardLayout, string> = { cards: "卡片", rows: "橫列" };

function LayoutSwitch({
  current,
  hrefFor,
}: {
  current: DashboardLayout;
  hrefFor: (layout: DashboardLayout) => string;
}) {
  return (
    /*
     * ⚠️ 用連結而不是按鈕。
     *
     * 換排版是導覽行為（網址會變），瀏覽器原生就會做——含上一頁、
     * 含中鍵開新分頁。做成按鈕再自己 router.push 只是多一個會壞的環節。
     */
    <nav aria-label="統計的排版" className="flex items-center gap-1">
      {DASHBOARD_LAYOUTS.map((layout) => (
        <Link
          key={layout}
          href={hrefFor(layout)}
          aria-current={layout === current ? "true" : undefined}
          className={`text-caption rounded-pill border px-3 py-1.5 transition-colors ${
            layout === current
              ? "border-brand-ink bg-brand-ink text-brand-on-ink font-bold"
              : "border-brand-line hover:border-brand-ink"
          }`}
        >
          {LAYOUT_LABELS[layout]}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 本體                                                                */
/* ------------------------------------------------------------------ */

export function CrmDashboard({
  stats,
  headline,
  activity,
  layout,
  hrefFor,
}: {
  stats: EntityStats;
  headline: Headline;
  activity: { date: string; count: number }[];
  layout: DashboardLayout;
  hrefFor: (layout: DashboardLayout) => string;
}) {
  const busiest = Math.max(...activity.map((day) => day.count), 0);
  const enough = stats.total >= MIN_RECORDS_FOR_CHARTS;

  // 那句「文字欄位不做分組」只講一次，而且是整區的註腳
  const hasTextField = stats.fields.some(
    (summary) => summary.field.type === "text" || summary.field.type === "textarea",
  );

  return (
    <section aria-labelledby="crm-dashboard-heading" className="flex flex-col gap-8">
      <h2 id="crm-dashboard-heading" className="sr-only">
        「{stats.entity.name}」的概況
      </h2>

      <NumberBand headline={headline} entityName={stats.entity.name} />

      {stats.total === 0 ? (
        /*
         * 沒有資料時不畫一整排 0——那看起來像壞掉，而它只是還沒開始。
         * 說出下一步比展示空數字有用。
         */
        <p className="border-brand-line text-body-sm text-brand-muted rounded-lg border border-dashed p-6">
          這一類還沒有任何資料。下面填一筆，這裡就會開始有東西。
        </p>
      ) : !enough ? (
        /*
         * ⚠️ 資料太少時**不畫圖表**，而不是畫一堆 100% / 0%。
         *
         * 一筆資料時每根長條不是滿版就是空的——數學上對，
         * 而使用者的第一個反應是「圖表壞了嗎」，不是「我資料太少」。
         * 硬畫出來的圖表在說一件它證明不了的事。
         */
        <p className="border-brand-line text-body-sm text-brand-muted rounded-lg border border-dashed p-6">
          已經記了 {stats.total} 筆。再多記幾筆（{MIN_RECORDS_FOR_CHARTS} 筆以上），
          這裡就會開始看得出比例與趨勢——現在的資料還畫不出有意義的分布。
        </p>
      ) : (
        <>
          {/* 最近的活動 */}
          <div>
            <h3 className="text-body-sm font-bold">最近 {activity.length} 天</h3>
            <ul
              className="mt-3 flex items-end gap-1"
              aria-label={`最近 ${activity.length} 天每天新增的筆數`}
            >
              {activity.map((day) => (
                <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  {/*
                   * 柱子的高度是百分比，容器的高度是 class。
                   * 寫成 `height: Npx` 的話那個 N 會是一個只存在於這個檔案的
                   * 設計數值，而 tokens.css 是唯一來源。
                   *
                   * 最低 2%：0 筆的那天要留一條細線，不然那一格會消失，
                   * 看起來像「那天不存在」而不是「那天沒動」。
                   */}
                  <span
                    className="flex h-12 w-full items-end"
                    title={`${day.date}：${day.count} 筆`}
                  >
                    <span
                      className="bg-brand-ink w-full rounded-sm"
                      style={{
                        height: `${busiest > 0 ? Math.max(2, (day.count / busiest) * 100) : 2}%`,
                      }}
                    />
                  </span>
                  <span className="text-caption text-brand-muted hidden sm:block">
                    {day.date.slice(8)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-brand-muted mt-2">最忙的一天 {busiest} 筆。</p>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-body-sm font-bold">每一個欄位</h3>
            <LayoutSwitch current={layout} hrefFor={hrefFor} />
          </div>

          {layout === "cards" ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {stats.fields.map((summary) => (
                <li key={summary.field.id} className="border-brand-line rounded-lg border p-5">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-body font-bold">{summary.field.label}</h4>
                    <span className="text-caption text-brand-muted">
                      {CRM_FIELD_TYPE_LABELS[summary.field.type]}
                    </span>
                  </div>
                  <FieldBody summary={summary} />
                </li>
              ))}
            </ul>
          ) : (
            /*
             * 橫列：左邊名字大字、右邊分布，用橫線分隔。
             * 與首頁 services 那一改同一個語彙（Spec §3.1 的解藥之一）。
             */
            <ul className="flex flex-col">
              {stats.fields.map((summary) => (
                <li
                  key={summary.field.id}
                  className="border-brand-line grid gap-3 border-t py-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-10"
                >
                  <div>
                    <h4 className="text-heading-1">{summary.field.label}</h4>
                    <p className="text-caption text-brand-muted mt-1">
                      {CRM_FIELD_TYPE_LABELS[summary.field.type]}
                    </p>
                  </div>
                  <div>
                    <FieldBody summary={summary} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/*
           * ⚠️ 這句話整區只講一次。
           *
           * 原本每一張文字欄位的卡片都印一次，三個欄位就講三遍——
           * 整頁讀起來像在道歉。
           */}
          {hasTextField ? (
            <p className="text-caption text-brand-muted">
              文字欄位只算填寫率，不做分組——每一筆幾乎都不一樣，分了也看不出什麼。
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
