import Link from "next/link";

import { requireMember } from "@/features/account/auth";
import { listMyInquiries } from "@/features/account/inquiries";

/**
 * 我留過的需求（CR-004 / Phase B BB）
 *
 * ── 這一頁讓 `leads.profile_id` 終於有讀取端 ──────────────────
 *
 * CR-002 讓登入者留下的 lead 綁上帳號，migration 的註解寫著
 * 「之後可以在自己的頁面看到」。那個「之後」一直沒有到。
 *
 * ⚠️ 這裡只顯示「你留了什麼」，不顯示我們的回覆——
 * 帳號內聯繫（Phase M 的 MC）還沒做，而做一個看起來能對話、
 * 實際上沒有人會回的介面，比沒有那個介面更糟。
 * 這與「不做一顆按了會 422 的註冊按鈕」是同一條判斷。
 */

export default async function AccountInquiriesPage() {
  const member = await requireMember("/account/inquiries");
  const inquiries = await listMyInquiries(member.userId);

  return (
    <>
      <h1 className="text-display-2">我的詢問</h1>
      <p className="text-body text-brand-muted mt-3">
        你透過 AI 顧問或表單留下的需求。我們會用 Email 回覆。
      </p>

      {inquiries.length === 0 ? (
        <div className="border-brand-line mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-body">還沒有留過需求。</p>
          <p className="text-body-sm text-brand-muted mt-3">
            不確定要做什麼也可以直接問——說明你想完成什麼就好。
          </p>
          <Link
            href="/start"
            className="border-brand-ink text-body-sm rounded-pill mt-6 inline-flex border px-6 py-3 font-bold"
          >
            開始一個專案
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="border-brand-line rounded-lg border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body font-bold">{inquiry.businessName || "（沒有填名稱）"}</p>
                <p className="text-caption text-brand-muted">
                  {new Date(inquiry.createdAt).toLocaleString("zh-TW")}
                </p>
              </div>

              <dl className="text-body-sm text-brand-muted mt-3 flex flex-wrap gap-x-6 gap-y-1">
                {inquiry.businessIndustry ? (
                  <div className="flex gap-2">
                    <dt>產業</dt>
                    <dd className="text-brand-ink">{inquiry.businessIndustry}</dd>
                  </div>
                ) : null}
                {inquiry.contactEmail ? (
                  <div className="flex gap-2">
                    <dt>回覆到</dt>
                    <dd className="text-brand-ink">{inquiry.contactEmail}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt>來源</dt>
                  <dd className="text-brand-ink">
                    {inquiry.source === "agent" ? "AI 顧問對話" : inquiry.source}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-brand-muted mt-6">
        想補充或修改需求，直接回覆我們寄給你的信就可以。
      </p>
    </>
  );
}
