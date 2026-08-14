import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server 端的 Supabase client（Server Component / Route Handler / Server Action）。
 *
 * 與 `client.ts` 的差別：這一支帶 cookie，因此認得目前登入的使用者，
 * RLS 會以該使用者的身分套用。`client.ts` 是無身分的公開讀取用。
 *
 * ⚠️ 仍然使用 anon key。登入後的權限來自 JWT 中的身分 + RLS policy，
 * 不是因為換了一把更大的鑰匙。後台之所以能寫入，是因為 `is_admin()` 為真。
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 在 Server Component 內呼叫 set() 會拋錯（只有 Route Handler /
          // Server Action 能寫 cookie）。session 更新由 proxy 負責，
          // 這裡忽略是安全的。
        }
      },
    },
  });
}
