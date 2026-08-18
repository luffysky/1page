import { CRM_FIELD_TYPE_LABELS } from "@/features/crm-builder/schema";
import type { EntityStats, FieldSummary } from "@/features/crm-builder/stats";

/**
 * CRM Dashboard（CR-003-5）
 *
 * ── 這一頁的內容由使用者的定義決定 ────────────────────────────
 *
 * 與記錄表單同一招：**照著資料的形狀長出來**。寫死「客戶數與成交率」
 * 的話，一個拿它記食材庫存的人會看到兩個永遠是 0 的數字——
 * 而那比沒有 dashboard 更糟。
 *
 * ── ⚠️ 不畫看起來像分析、實際上什麼都沒說的東西 ───────────────
 *
 * 文字欄位只給填寫率，不做分組：分組會得到一堆各 1 筆的「分類」，
 * 長條圖畫出來很專業，看的人要花時間才發現它什麼都沒說。
 *
 * 統計本身在 `features/crm-builder/stats.ts`，是純函式而且有測試。
 * 這支元件只負責畫。
 */

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  /*
   * 分母是 0 時寬度給 0，不給 NaN。
   *
   * `0/0` 在 CSS 裡是 `NaN%`，瀏覽器會忽略整條寬度宣告——
   * 結果是每一條都變成滿版，看起來像「全部都是 100%」。
   */
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <li className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-body-sm text-brand-muted truncate" title={label}>
        {label}
      </span>
      <span className="bg-brand-line h-2 overflow-hidden rounded-pill">
        <span className="bg-brand-ink block h-full" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-caption text-brand-muted tabular-nums">
        {count}
        <span className="opacity-60"> · {percent}%</span>
      </span>
    </li>
  );
}

function FieldCard({ summary }: { summary: FieldSummary }) {
  const { field, filled, total, buckets, numeric, range } = summary;

  return (
    <li className="border-brand-line rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-body font-bold">{field.label}</h4>
        <span className="text-caption text-brand-muted">{CRM_FIELD_TYPE_LABELS[field.type]}</span>
      </div>

      {/*
       * checkbox 不顯示填寫率——沒勾也是一個答案，那個比例沒有意義
       * （見 stats.ts 的同一段說明）。
       */}
      {field.type !== "checkbox" ? (
        <p className="text-caption text-brand-muted mt-2">
          {total === 0
            ? "還沒有資料"
            : `${filled} / ${total} 筆有填${filled < total ? `（${total - filled} 筆空白）` : ""}`}
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
        <p className="text-body-sm mt-4">
          {range.earliest} — {range.latest}
        </p>
      ) : null}

      {/*
       * ⚠️ 這句話只給文字欄位，用型別判斷而不是用「沒有其他統計」判斷。
       *
       * 第一版寫成 `buckets.length === 0 && !numeric && !range`——
       * 而一個還沒有人填的**日期**欄位也滿足那個條件，
       * 結果畫面上出現「最後聯絡（日期）：文字欄位不做分組」。
       * 那不是壞掉，是說錯話，而說錯話的圖表比沒有圖表更糟。
       *
       * 其他型別沒有資料時什麼都不說——上面的「0 / 2 筆有填」
       * 已經把該說的說完了。
       */}
      {(field.type === "text" || field.type === "textarea") && total > 0 ? (
        <p className="text-caption text-brand-muted mt-3">
          文字欄位不做分組——每一筆幾乎都不一樣，分了也看不出什麼。
        </p>
      ) : null}
    </li>
  );
}

export function CrmDashboard({
  stats,
  activity,
}: {
  stats: EntityStats;
  activity: { date: string; count: number }[];
}) {
  const busiest = Math.max(...activity.map((day) => day.count), 0);

  return (
    <section aria-labelledby="crm-dashboard-heading" className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="crm-dashboard-heading" className="text-heading-1">
          「{stats.entity.name}」的概況
        </h2>
        <p className="text-body-sm text-brand-muted">共 {stats.total} 筆</p>
      </div>

      {stats.total === 0 ? (
        /*
         * ⚠️ 沒有資料時不畫一整排 0。
         *
         * 一個全部都是 0 的 dashboard 看起來像壞掉，而它只是還沒開始。
         * 說出下一步比展示空數字有用。
         */
        <p className="border-brand-line text-body-sm text-brand-muted rounded-lg border border-dashed p-6">
          這一類還沒有任何資料。下面填一筆，這裡就會開始有東西。
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
                   * 柱子的高度是**百分比**，容器的高度是 class。
                   *
                   * ⚠️ 刻意不寫成 `height: Npx`——那個 N 會是一個
                   * 只存在於這個檔案裡的設計數值，而 tokens.css 是唯一來源。
                   * inline 的只剩「這一天佔最忙那天的幾成」，
                   * 與上傳進度條同一類：類別表達不了連續變化的值。
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
            <p className="text-caption text-brand-muted mt-2">
              最忙的一天 {busiest} 筆。滑過去看是哪一天。
            </p>
          </div>

          <ul className="grid gap-4 md:grid-cols-2">
            {stats.fields.map((summary) => (
              <FieldCard key={summary.field.id} summary={summary} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
