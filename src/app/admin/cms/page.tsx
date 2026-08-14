import Link from "next/link";

import { toAdminUrl } from "@/config/admin";
import { CMS_DOCUMENTS, CMS_PAGES, cmsKeysByPage } from "@/features/cms/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 內容管理（CR-004 / Phase B BH + BI）
 *
 * 清單直接讀 registry：能編輯的文件就是程式碼登記過的那幾份。
 * 手寫一份清單的話，加了 key 卻忘了加進清單的表現是
 * 「功能做好了但後台進不去」——這個專案犯過七次的那件事。
 *
 * BI 之後這裡從兩份長到十幾份，所以照**頁面**分組。
 * 「我要改首頁那句話」是編輯的人真正的問法，
 * 而不是「我要改 home.hero」。
 */

export default async function AdminCmsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("cms_documents").select("key, updated_at");
  const savedAt = new Map((data ?? []).map((row) => [row.key as string, row.updated_at as string]));

  return (
    <>
      <h1 className="text-display-2">內容管理</h1>
      <p className="text-body text-brand-muted mt-3">
        網站上的每一段文案。改完存檔，前台立刻生效——不用重新部署。
      </p>

      {/*
       * 這句話要放在最前面。
       *
       * 「為什麼我改不到那個按鈕連到哪裡」是一定會被問的問題，
       * 而答案不是「做不到」，是「刻意不開」。
       * 沒有這句的話，看起來就只像是漏做了。
       */}
      <p className="border-brand-line text-body-sm mt-6 rounded-lg border border-dashed p-4">
        這裡改的是<strong>字</strong>，不是<strong>行為</strong>。
        <span className="text-brand-muted mt-1 block">
          標題、說明、按鈕上的字都可以改；而「選了某個目標要篩哪些作品」「導覽列連到哪裡」
          留在程式碼裡——文案改錯只是難看，行為改錯是壞掉的網站，而這裡不會有人幫你檢查。
        </span>
      </p>

      {cmsKeysByPage().map(({ page, keys }) => {
        if (keys.length === 0) return null;
        const meta = CMS_PAGES[page];

        return (
          <section key={page} className="mt-10">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-heading-2">{meta.label}</h2>
              {meta.path ? (
                <a
                  href={meta.path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-brand-muted underline"
                >
                  看這一頁 ↗
                </a>
              ) : null}
            </div>

            <ul className="mt-4 flex flex-col gap-3">
              {keys.map((key) => {
                const definition = CMS_DOCUMENTS[key];
                const updated = savedAt.get(key);

                return (
                  <li key={key} className="border-brand-line rounded-lg border p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-body font-bold">{definition.label}</p>
                        <p className="text-body-sm text-brand-muted mt-1">
                          影響：{definition.affects}
                        </p>
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
          </section>
        );
      })}
    </>
  );
}
