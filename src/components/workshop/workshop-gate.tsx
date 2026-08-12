"use client";

import { useEffect, useRef } from "react";

import {
  WORKSHOP,
  WORKSHOP_BOUNDARY,
  WORKSHOP_CREDIT_NOTE,
  WORKSHOP_DELIVERABLES,
} from "@/config/workshop";
import { track } from "@/lib/analytics/track";

/**
 * Workshop Gate（Spec §23 / §24 / §25）
 *
 * ── 用原生 <dialog> ───────────────────────────────────────────
 *
 * 焦點管理、Escape 關閉、背景不可 tab——原生 modal dialog 全都內建，
 * 而自己刻一份的話那三件事會各壞一次。行動版導覽已經用同一個做法，
 * 相關的鍵盤行為在 primitives.spec.ts 有測試守著。
 *
 * ── 這道門刻意不像付款頁 ──────────────────────────────────────
 *
 * V1 不串金流（Spec §25），最後一步是留下需求由真人接手。
 * 做成假的結帳流程會讓第一批真的想付錢的人卡在半路，
 * 而那是最貴的一種挫折——他們已經決定要買了。
 */
export function WorkshopGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Spec §31。在真的顯示之後才記，不是在「打算顯示」時記——
      // 兩者會在某些失敗路徑上分岔，而分岔的方向是高估。
      track("workshop_gate_shown");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="workshop-gate-title"
      className="bg-brand-paper text-brand-ink max-w-2xl rounded-xl p-0 backdrop:bg-black/50"
    >
      <div className="p-6 sm:p-8">
        <p className="text-kicker text-brand-accent-strong uppercase">Website Workshop</p>

        <h2 id="workshop-gate-title" className="text-display-2 mt-3">
          聊天免費，
          <br />
          開始產生成果時收費。
        </h2>

        <p className="text-body text-brand-muted mt-4">
          不是按訊息數計價——你可以一直問。{WORKSHOP.name} 從 {WORKSHOP.price}，
          {WORKSHOP_CREDIT_NOTE}
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-heading-2">免費就能做的</h3>
            <ul className="text-body-sm text-brand-muted mt-3 flex flex-col gap-1.5">
              {WORKSHOP_BOUNDARY.free.map((item) => (
                <li key={item}>・{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-heading-2">Workshop 才有的</h3>
            <ul className="text-body-sm text-brand-muted mt-3 flex flex-col gap-1.5">
              {WORKSHOP_BOUNDARY.paid.map((item) => (
                <li key={item}>・{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-brand-line mt-8 border-t pt-6">
          <h3 className="text-heading-2">你會拿到什麼</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {WORKSHOP_DELIVERABLES.map((item) => (
              <div key={item.title}>
                <dt className="text-body-sm font-bold">{item.title}</dt>
                <dd className="text-caption text-brand-muted mt-0.5">{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/start"
            onClick={() => track("workshop_cta_clicked")}
            className="bg-brand-accent-strong text-brand-on-accent text-body-sm rounded-pill px-5 py-3 font-bold"
          >
            說說你的專案 ↗
          </a>

          <button
            type="button"
            onClick={onClose}
            className="border-brand-line text-body-sm rounded-pill border px-5 py-3"
          >
            先繼續聊
          </button>
        </div>

        <p className="text-caption text-brand-muted mt-4">
          目前還沒有線上付款。留下需求之後會有真人跟你確認範圍再開始。
        </p>
      </div>
    </dialog>
  );
}
