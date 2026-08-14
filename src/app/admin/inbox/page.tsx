import { listLeads } from "@/features/admin/leads-repository";

/**
 * 收件匣（Phase M 的 MD / CR-004 Phase B BC）
 *
 * ── 這一頁補的是 leads 表的另一半 ─────────────────────────────
 *
 * Phase 5 讓 Agent 把需求寫進 `leads`，寫入端做完了、測過了，
 * 而**沒有任何地方讀它**——訪客留下的需求進了資料庫就沒有人看得到。
 *
 * 那是「宣告了一個東西卻沒有人在讀」最貴的一種：不是一個沒用到的欄位，
 * 是有人真的花了時間填、然後石沉大海。
 *
 * ⚠️ 這一頁看得到聯絡方式，是個人資料。RLS 的 `leads_select_staff`
 * 是唯一的邊界（見 features/admin/leads-repository.ts）。
 */

export default async function AdminInboxPage() {
  const leads = await listLeads();

  return (
    <>
      <h1 className="text-display-2">收件匣</h1>
      <p className="text-body text-brand-muted mt-3">
        訪客透過 AI 顧問或表單留下的需求，新的在最上面。
      </p>

      {leads.length === 0 ? (
        <p className="border-brand-line text-body-sm text-brand-muted mt-8 rounded-lg border border-dashed p-8 text-center">
          目前沒有任何需求。
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {leads.map((lead) => (
            <li key={lead.id} className="border-brand-line bg-brand-paper rounded-lg border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body font-bold">
                  {lead.businessName || lead.contactName || "（沒有填名稱）"}
                </p>
                <p className="text-caption text-brand-muted">
                  {new Date(lead.createdAt).toLocaleString("zh-TW")}
                </p>
              </div>

              {lead.businessDescription ? (
                <p className="text-body-sm mt-3 whitespace-pre-wrap">{lead.businessDescription}</p>
              ) : null}

              <dl className="text-caption text-brand-muted mt-4 flex flex-wrap gap-x-6 gap-y-1">
                {lead.contactName ? (
                  <div className="flex gap-2">
                    <dt>聯絡人</dt>
                    <dd className="text-brand-ink">{lead.contactName}</dd>
                  </div>
                ) : null}
                {lead.contactEmail ? (
                  <div className="flex gap-2">
                    <dt>Email</dt>
                    {/* 可點擊：後台的實際動作就是回信 */}
                    <dd>
                      <a href={`mailto:${lead.contactEmail}`} className="text-brand-ink underline">
                        {lead.contactEmail}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {lead.contactPhone ? (
                  <div className="flex gap-2">
                    <dt>電話</dt>
                    <dd className="text-brand-ink">{lead.contactPhone}</dd>
                  </div>
                ) : null}
                {lead.businessIndustry ? (
                  <div className="flex gap-2">
                    <dt>產業</dt>
                    <dd className="text-brand-ink">{lead.businessIndustry}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt>來源</dt>
                  <dd className="text-brand-ink">
                    {lead.source === "agent" ? "AI 顧問對話" : lead.source}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt>帳號</dt>
                  {/*
                   * 「有沒有綁帳號」會影響怎麼回覆：綁了的話對方在
                   * 「我的詢問」看得到這一筆，之後 MC 做好也能在站內聯繫。
                   */}
                  <dd className="text-brand-ink">{lead.hasAccount ? "已綁定" : "匿名訪客"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-brand-muted mt-6">
        目前只能看與回信。標記處理狀態、指派、站內回覆是 CR-004 的 CRM 那一段。
      </p>
    </>
  );
}
