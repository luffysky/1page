import Link from "next/link";

import { removeSavedSite } from "@/app/edit/actions";
import { listSavedSites } from "@/features/website-engine/saved-sites";

/**
 * 存下來的網站（CR-004 / Phase B BB）
 *
 * 沒有這一段的話，「存到我的帳號」就是又一個「做好了但畫面上進不去」——
 * 存進資料庫，然後永遠找不到。
 */

export default async function AccountSitesPage() {
  const sites = await listSavedSites();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-2">我的網站</h1>
          <p className="text-body text-brand-muted mt-3">
            排好存下來的版型。點「編輯」就能接著改。
          </p>
        </div>

        <Link
          href="/edit"
          className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold"
        >
          排一個新的
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          還沒有。到{" "}
          <Link href="/edit" className="underline">
            自己排版
          </Link>{" "}
          排一個，排好可以存下來。
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {sites.map((site) => (
            <li
              key={site.id}
              className="border-brand-line flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <p className="text-body font-bold">{site.name}</p>
                <p className="text-caption text-brand-muted mt-0.5">
                  最後更新 {new Date(site.updatedAt).toLocaleString("zh-TW")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/*
                 * 「編輯」是這一頁唯一讓存檔功能有意義的東西。
                 * 沒有它，這份清單只證明資料存進去了，打不開。
                 */}
                <Link
                  href={`/edit?draft=${site.id}`}
                  className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-4 py-2 font-bold"
                >
                  編輯
                </Link>

                <form action={removeSavedSite}>
                  <input type="hidden" name="id" value={site.id} />
                  <button
                    type="submit"
                    className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold"
                  >
                    刪除
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-brand-muted mt-6">
        每個帳號最多存 20 份。上限由資料庫擋，不是只有畫面上擋。
      </p>
    </>
  );
}
