import Link from "next/link";

import { removeCrmDesignAction } from "@/app/crm/actions";
import { requireMember } from "@/features/account/auth";
import { listCrmDesigns } from "@/features/crm-builder/store";

/**
 * 我設計的 CRM（CR-003-5）
 *
 * ⚠️ 這一頁是「存到我的帳號」的**讀取端**。
 * 沒有它的話存檔就是一個只寫不讀的功能——存得進去、再也打不開，
 * 而那正是這個專案反覆踩到的第一種毛病（saved_sites 已經犯過一次）。
 */

export default async function AccountCrmPage() {
  await requireMember("/account/crm");
  const designs = await listCrmDesigns();

  return (
    <>
      <h1 className="text-display-2">我的 CRM</h1>
      <p className="text-body text-brand-muted mt-3">你設計的結構，以及照著它填的資料。</p>

      {designs.length === 0 ? (
        <div className="border-brand-line mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-body">還沒有設計過。</p>
          <p className="text-body-sm text-brand-muted mt-3">
            從一份客戶清單開始就好，之後隨時可以加欄位。
          </p>
          <Link
            href="/crm"
            className="border-brand-ink text-body-sm rounded-pill mt-6 inline-flex border px-6 py-3 font-bold"
          >
            開始設計
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {designs.map((design) => (
            <li
              key={design.id}
              className="border-brand-line flex flex-wrap items-center gap-4 rounded-lg border p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-body font-bold">{design.name}</p>
                <p className="text-caption text-brand-muted mt-1">
                  {/*
                   * 先講筆數再講時間：「有沒有東西」比「什麼時候改的」
                   * 更能決定要不要點進去。
                   *
                   * 0 筆的時候說「還沒有資料」而不是「0 筆」——
                   * 後者讀起來像一個統計數字，前者才是下一步。
                   */}
                  {design.records > 0 ? `${design.records} 筆資料` : "還沒有資料"}
                  {" · "}
                  最後更新 {new Date(design.updatedAt).toLocaleString("zh-TW")}
                </p>
              </div>

              <Link
                href={`/account/crm/${design.id}`}
                className="border-brand-ink text-body-sm rounded-pill border px-5 py-2 font-bold"
              >
                填資料
              </Link>
              <Link
                href={`/crm?id=${design.id}`}
                className="text-body-sm text-brand-muted underline underline-offset-4"
              >
                改設計
              </Link>

              <form action={removeCrmDesignAction}>
                <input type="hidden" name="id" value={design.id} />
                <button
                  type="submit"
                  // 刪掉設計會連著記錄一起走（on delete cascade）。
                  // 不說的話，使用者以為只是收掉一份結構
                  className="text-caption text-brand-muted underline underline-offset-4"
                >
                  刪掉（連同裡面的資料）
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
