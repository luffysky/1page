"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { saveCrmDesignAction } from "@/app/crm/actions";
import type { CrmDefinition } from "@/features/crm-builder/schema";

/**
 * 存檔（CR-003-5 / 定價與網站編輯器一致）
 *
 * ── 那條線畫在這裡 ────────────────────────────────────────────
 *
 * 「免費設計、存檔才要帳號」。設計的部分完全不需要登入——
 * 訪客排了十分鐘之後，「要留下來」才是掏錢的理由。
 * 所以這一塊是整個設計器裡唯一會提到帳號的地方。
 *
 * ⚠️ 目前的門檻是**登入**，不是付費：這個專案沒有任何金流。
 * 真的要收費時擋的位置是 `saveCrmDesignAction`，不是這裡的按鈕——
 * 按鈕擋不住直接打端點的人。
 *
 * 匯出 JSON 刻意免費也不需登入：那是使用者自己設計的東西，
 * 把它扣住當人質不會讓人更想付錢，只會讓人覺得被坑。
 */
export function CrmSaveBar({
  signedIn,
  definition,
  savedId,
  onSaved,
}: {
  signedIn: boolean;
  definition: CrmDefinition;
  savedId: string | null;
  onSaved: (id: string) => void;
}) {
  const [state, action, pending] = useActionState(saveCrmDesignAction, null);

  /*
   * 存好之後把 id 記回狀態。
   *
   * 少了這一步，第一次存檔新增一列、第二次存檔又新增一列——
   * 使用者按兩次就有兩份，而畫面上完全看不出為什麼。
   */
  const newId = state?.ok ? state.savedId : undefined;
  useEffect(() => {
    if (newId) onSaved(newId);
  }, [newId, onSaved]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.name || "crm"}.json`;
    link.click();

    // 不撤銷的話這個 blob 會一直佔著記憶體直到關掉分頁
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-brand-line rounded-lg border p-4">
      <h3 className="text-body-sm font-bold">留下來</h3>

      {signedIn ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="definition" value={JSON.stringify(definition)} />
          <input type="hidden" name="savedId" value={savedId ?? ""} />

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-6 py-3 font-bold disabled:opacity-50"
            >
              {savedId ? "更新這一份" : "存到我的帳號"}
            </button>

            {savedId ? (
              <button
                type="submit"
                name="saveAsNew"
                value="1"
                disabled={pending}
                className="border-brand-line text-body-sm rounded-pill border px-6 py-3 disabled:opacity-50"
              >
                另存新的一份
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-caption text-brand-muted">
            設計不用登入，存下來才要。已經設計的東西會留著。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/crm")}`}
            className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill mt-3 inline-flex px-6 py-3 font-bold"
          >
            登入後存檔
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={exportJson}
        className="text-caption text-brand-muted mt-3 block underline underline-offset-4"
      >
        匯出成 JSON（不用登入）
      </button>

      {state ? (
        <p
          role="status"
          className={`text-body-sm mt-3 font-bold ${state.ok ? "" : "text-brand-accent-strong"}`}
        >
          {state.message}
          {state.ok ? (
            <>
              {" "}
              <Link href="/account/crm" className="underline underline-offset-4">
                去我的 CRM 填資料
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
