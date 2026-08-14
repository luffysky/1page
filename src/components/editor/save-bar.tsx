"use client";

import Link from "next/link";
import { useActionState, useEffect, useId } from "react";

import { saveCurrentSite } from "@/app/edit/actions";
import { useSitePreview } from "@/features/website-engine/preview-context";

/**
 * 存檔與匯出（CR-003-4 / 定價 B）
 *
 * ── 定價 B 的那條線畫在這裡 ───────────────────────────────────
 *
 * 「免費編輯、存檔才付費」。編輯的部分完全不需要登入——訪客排了十分鐘
 * 之後，「要留下來」才是掏錢的理由。所以這一條 bar 是整個編輯器裡
 * 唯一會提到帳號的地方。
 *
 * ⚠️ 目前的門檻是**登入**，不是付費：這個專案還沒有任何金流。
 * 真的要收費時，擋的位置是 saveCurrentSite 這個 action，
 * 不是這裡的按鈕（按鈕擋不住直接打端點的人）。
 *
 * 匯出 JSON 刻意免費也不需登入：那是訪客自己做的東西，
 * 把它扣住當人質不會讓人更想付錢，只會讓人覺得被坑。
 */
export function SaveBar({ signedIn, savedName }: { signedIn: boolean; savedName?: string }) {
  const { config, editorState, savedSiteId, setSavedSite } = useSitePreview();
  const [state, action, pending] = useActionState(saveCurrentSite, null);
  const nameId = useId();

  /*
   * 存好之後把 id 記回狀態。
   *
   * 少了這一步，第一次存檔會新增一列、第二次存檔又新增一列——
   * 使用者按兩次就有兩份，而畫面上完全看不出為什麼。
   */
  const newId = state?.ok ? state.savedSiteId : undefined;
  useEffect(() => {
    if (newId) setSavedSite(newId);
  }, [newId, setSavedSite]);

  const exportJson = () => {
    /*
     * 用 Blob + object URL，不打伺服器。
     * 這份設定已經完整存在瀏覽器記憶體裡，繞一趟後端只是多一個
     * 會失敗的環節（而且要多開一個端點）。
     */
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.brand.name || "website"}.json`;
    link.click();

    // 不撤銷的話這個 blob 會一直佔著記憶體直到關掉分頁
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-brand-line rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-3">
        {signedIn ? (
          <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
            {/*
             * 整份編輯器狀態用 hidden input 帶過去。
             * Server Action 拿得到的只有 FormData，而這份設定是 client 狀態。
             *
             * 帶的是**輸入**（模板/主題/區塊覆寫），不是算出來的 SiteConfig——
             * 成品推不回輸入，存成品的那個版本就是因此載不回編輯器的。
             */}
            <input type="hidden" name="draft" value={JSON.stringify(editorState)} />
            <input type="hidden" name="savedSiteId" value={savedSiteId ?? ""} />

            <div className="min-w-[12rem] flex-1">
              <label htmlFor={nameId} className="text-body-sm block font-bold">
                幫這份網站取個名字
              </label>
              <input
                id={nameId}
                name="name"
                type="text"
                maxLength={80}
                defaultValue={savedName ?? config.brand.name}
                className="border-brand-line bg-brand-paper text-body-sm mt-2 w-full rounded-md border px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-3 font-bold disabled:opacity-50"
            >
              {pending ? "存檔中…" : savedSiteId ? "更新這一份" : "存到我的帳號"}
            </button>

            {/*
             * 「另存新的一份」只在已經有一份的時候出現。
             *
             * 還沒存過的時候「存檔」與「另存新檔」是同一件事，
             * 擺兩顆一樣的按鈕只會讓人停下來想哪一顆才對。
             */}
            {savedSiteId ? (
              <button
                type="submit"
                name="saveAsNew"
                value="1"
                disabled={pending}
                className="border-brand-line text-body-sm rounded-pill border px-5 py-3 font-bold disabled:opacity-50"
              >
                另存新的一份
              </button>
            ) : null}
          </form>
        ) : (
          <p className="text-body-sm text-brand-muted flex-1">
            排版與修改都是免費的，不用登入。要把它{" "}
            <strong className="text-brand-ink">留下來</strong> 才需要帳號——
            <Link href="/login?next=%2Fedit" className="underline">
              登入
            </Link>
            。
          </p>
        )}

        <button
          type="button"
          onClick={exportJson}
          className="border-brand-line text-body-sm rounded-pill border px-5 py-3 font-bold"
        >
          匯出 JSON
        </button>
      </div>

      {state ? (
        <p
          role="status"
          className={`text-body-sm mt-3 ${state.ok ? "text-brand-muted" : "text-brand-accent-strong font-bold"}`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
