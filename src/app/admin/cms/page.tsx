import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { CMS_DOCUMENTS, CMS_KEYS } from "@/features/cms/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 內容管理（CR-004 / Phase B BH）
 *
 * 清單直接讀 registry：能編輯的文件就是程式碼登記過的那幾份。
 * 手寫一份清單的話，加了 key 卻忘了加進清單的表現是
 * 「功能做好了但後台進不去」——這個專案犯過七次的那件事。
 */

export default async function AdminCmsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("cms_documents").select("key, updated_at");
  const savedAt = new Map((data ?? []).map((row) => [row.key as string, row.updated_at as string]));

  return (
    <>
      <h1 className="text-display-2">內容管理</h1>
      <p className="text-body text-brand-muted mt-3">
        網站上的文案。改完存檔，前台立刻生效——不用重新部署。
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {CMS_KEYS.map((key) => {
          const definition = CMS_DOCUMENTS[key];
          const updated = savedAt.get(key);

          return (
            <li key={key} className="border-brand-line rounded-lg border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-body font-bold">{definition.label}</p>
                  <p className="text-body-sm text-brand-muted mt-1">影響：{definition.affects}</p>
                  <p className="text-caption text-brand-muted mt-2 font-mono">{key}</p>
                </div>

                <Link
                  href={toAdminUrl(`/admin/cms/${key}`)}
                  className="bg-brand-ink text-brand-on-ink text-body-sm rounded-pill px-5 py-2.5 font-bold"
                >
                  編輯
                </Link>
              </div>

              {/*
               * 「還沒改過」與「改過但沒動」是兩件事。
               *
               * 沒有這一行的話，看到的人不知道現在網站上的內容
               * 是程式碼裡那份還是後台存過的那份——而那兩份可能不一樣。
               */}
              <p className="text-caption text-brand-muted mt-3">
                {updated
                  ? `最後更新 ${new Date(updated).toLocaleString("zh-TW")}`
                  : "還沒在後台改過，目前用的是程式碼裡的預設內容"}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
