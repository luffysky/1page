"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  ALL_CATEGORIES,
  ALL_PROJECT_TYPES,
  ALL_SERVICES,
  ALL_TAGS,
  type CategoryFilter,
  type PortfolioCategory,
  type ProjectTypeFilter,
  type ServiceFilter,
  type TagFilter,
} from "@/config/portfolio-categories";
import { SERVICE_LINES } from "@/config/services";
import { PROJECT_TYPE_LABELS, type PortfolioProjectType } from "@/features/portfolio/project-type";
import { track } from "@/lib/analytics/track";

/**
 * Portfolio Filter（Spec §8.7）
 *
 * 沿用 Home Goal 建立的 URL-as-source-of-truth 模式（Plan §5）：
 *   初始渲染   URL → state
 *   互動當下   state → 立即渲染
 *   互動之後   state → URL（可分享、可作為廣告落地頁）
 *
 * 桌機水平排列，行動裝置橫向 scroll chips（Spec §8.7）。
 *
 * ── 四個維度，一份狀態 ────────────────────────────────────────
 *
 * Spec §8.7 的主軸是 Category，另可依 Project Type / Tag / Service 篩。
 *
 * ⚠️ 每個維度各自 useState 的寫法在兩個維度時還好，四個就開始出錯：
 * 每加一個維度，`commit` 的參數就多一個，而每個 `chooseX` 都要記得把
 * 其他三個現值傳進去——漏掉的那一個會在切換時被重設成「不限」，
 * 使用者會覺得篩選器自己跳掉。所以這裡用一份物件。
 */

interface Filters {
  category: CategoryFilter;
  projectType: ProjectTypeFilter;
  tag: TagFilter;
  service: ServiceFilter;
}

interface Props extends Filters {
  /** 目前篩選結果數量，顯示於篩選列旁 */
  resultCount: number;
  /**
   * 可選的分類，由 server 從資料庫讀來。
   *
   * ⚠️ 不在這裡直接讀 PORTFOLIO_CATEGORIES 常數：那份是種子，
   * 資料庫才是現在啟用哪幾個分類的真相。讀常數的話，
   * 停用一個分類之後它還會出現在篩選器上，按下去就是零筆結果。
   */
  categories: readonly PortfolioCategory[];
  /** 目前有作品在用的標籤。同樣由 server 讀 */
  tags: readonly PortfolioCategory[];
}

const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as PortfolioProjectType[];

/** 網址參數名。預設值不進網址（與 Home Goal 的 unsure 同樣處理） */
const PARAM: Record<keyof Filters, { key: string; all: string }> = {
  category: { key: "category", all: ALL_CATEGORIES },
  projectType: { key: "type", all: ALL_PROJECT_TYPES },
  tag: { key: "tag", all: ALL_TAGS },
  service: { key: "service", all: ALL_SERVICES },
};

function Chip({
  active,
  label,
  onClick,
  size = "md",
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  size?: "md" | "sm";
}) {
  const base = size === "md" ? "text-body-sm px-4 py-2" : "text-caption px-3 py-1.5";
  const tone = active
    ? size === "md"
      ? "border-brand-ink bg-brand-ink text-brand-on-ink"
      : "border-brand-ink text-brand-ink"
    : size === "md"
      ? "border-brand-line hover:border-brand-ink"
      : "border-brand-line text-brand-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill border whitespace-nowrap transition-colors ${base} ${tone}`}
    >
      {label}
    </button>
  );
}

export function PortfolioFilter({
  category,
  projectType,
  tag,
  service,
  resultCount,
  categories,
  tags,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const fromProps: Filters = { category, projectType, tag, service };
  const [active, setActive] = useState<Filters>(fromProps);

  /*
   * 上一頁／下一頁或外部連結進入時，server 會以新的 searchParams 重新渲染。
   * 在 render 期間由 props 校正 state，比 useEffect 少一次多餘 paint。
   */
  const signature = `${category}|${projectType}|${tag}|${service}`;
  const [synced, setSynced] = useState(signature);
  if (synced !== signature) {
    setSynced(signature);
    setActive(fromProps);
  }

  const commit = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );

      for (const [name, { key, all }] of Object.entries(PARAM)) {
        const value = next[name as keyof Filters];
        if (value === all) params.delete(key);
        else params.set(key, value);
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });

      track("portfolio_filtered", {
        category: next.category,
        projectType: next.projectType,
        tag: next.tag,
        service: next.service,
      });
    },
    [pathname, router],
  );

  const choose = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const next = { ...active, [key]: value };
    setActive(next);
    commit(next);
  };

  /*
   * 「更多篩選」的展開狀態。
   *
   * ⚠️ 直接寫 `open={extraFiltered}` 是不行的：那讓 details 變成受控元件，
   * 使用者手動展開之後，下一次 router.push 觸發的重新渲染會把它關回去
   * ——按一個標籤，整組篩選器就自己收起來。
   *
   * 所以初始值來自網址（帶 ?tag= 的連結進來時要看得見那個條件），
   * 之後由使用者自己決定。
   */
  const [extraOpen, setExtraOpen] = useState(tag !== ALL_TAGS || service !== ALL_SERVICES);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="sr-only">依分類篩選</h2>
        {/*
         * 行動裝置橫向捲動（Spec §8.7）。
         * -mx + px 讓 chips 可捲到螢幕邊緣，同時保留內容區的左右留白。
         */}
        <ul className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 lg:-mx-gutter-lg lg:flex-wrap lg:px-gutter-lg lg:overflow-visible">
          {[{ slug: ALL_CATEGORIES, name: "All" }, ...categories].map((item) => (
            <li key={item.slug} className="shrink-0">
              <Chip
                active={item.slug === active.category}
                label={item.name}
                onClick={() => choose("category", item.slug)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-caption text-brand-muted">來源</h2>
          {[
            { id: ALL_PROJECT_TYPES as ProjectTypeFilter, label: "不限" },
            ...PROJECT_TYPES.map((id) => ({
              id: id as ProjectTypeFilter,
              label: PROJECT_TYPE_LABELS[id],
            })),
          ].map((item) => (
            <Chip
              key={item.id}
              size="sm"
              active={item.id === active.projectType}
              label={item.label}
              onClick={() => choose("projectType", item.id)}
            />
          ))}
        </div>

        {/* 結果數以 aria-live 播報，鍵盤與螢幕閱讀器使用者才知道篩選生效了 */}
        <p className="text-caption text-brand-muted" aria-live="polite">
          共 {resultCount} 件
        </p>
      </div>

      {/*
       * 服務與標籤收在「更多篩選」裡。
       *
       * 四排 chips 全部攤開的話，篩選器會比第一件作品還高——手機上尤其明顯。
       * 用原生 details/summary：展開收合、鍵盤操作與 aria-expanded
       * 全部由瀏覽器負責，不必自己做一個會漏掉鍵盤的版本。
       *
       * `defaultOpen` 跟著網址走：從一個帶 ?tag= 的連結進來時，
       * 那個條件必須看得見——收起來的話使用者會以為篩選器壞了。
       */}
      <details
        open={extraOpen}
        onToggle={(event) => setExtraOpen(event.currentTarget.open)}
        className="border-brand-line rounded-lg border p-4"
      >
        <summary className="text-caption text-brand-muted cursor-pointer">更多篩選</summary>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-caption text-brand-muted w-12">服務</h2>
            {[
              { id: ALL_SERVICES as ServiceFilter, label: "不限" },
              ...SERVICE_LINES.map((line) => ({ id: line.id as ServiceFilter, label: line.name })),
            ].map((item) => (
              <Chip
                key={item.id}
                size="sm"
                active={item.id === active.service}
                label={item.label}
                onClick={() => choose("service", item.id)}
              />
            ))}
          </div>

          {/*
           * 沒有任何標籤時整組不顯示。
           * 一個只有「不限」可以按的篩選器，看起來像壞掉。
           */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-caption text-brand-muted w-12">標籤</h2>
              {[{ slug: ALL_TAGS, name: "不限" }, ...tags].map((item) => (
                <Chip
                  key={item.slug}
                  size="sm"
                  active={item.slug === active.tag}
                  label={item.name}
                  onClick={() => choose("tag", item.slug)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
