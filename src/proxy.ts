import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 兩件事：後台密路徑改寫，以及 Supabase session 續期。
 *
 * ── 後台密路徑 ────────────────────────────────────────────────
 *   /<ADMIN_SEGMENT>/admin/*  → 內部改寫到 /admin/*（瀏覽器網址仍是密路徑）
 *   /admin/*                  → 一律當作不存在
 *
 * `ADMIN_SEGMENT` 沒有 `NEXT_PUBLIC_` 前綴，因此不會被打包進瀏覽器 bundle。
 *
 * ⚠️ 這只是防掃描，不是安全邊界。真正的邊界是 `requireAdmin()` 的身分驗證
 * 與資料庫的 RLS。密路徑外流不該讓網站被攻破。
 *
 * 未設定 ADMIN_SEGMENT 時，後台整個不存在——連 /admin 都是 404。
 */

const ADMIN_SEGMENT = process.env.ADMIN_SEGMENT?.trim();

function notFound(request: NextRequest) {
  // rewrite 而非 redirect：不讓對方從網址變化推論出這條路徑有特殊處理
  return NextResponse.rewrite(new URL("/_not-found", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN_SEGMENT) {
    const secretBase = `/${ADMIN_SEGMENT}/admin`;

    if (pathname === secretBase || pathname.startsWith(`${secretBase}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(`/${ADMIN_SEGMENT}`.length);
      return NextResponse.rewrite(url);
    }
  }

  // 裸 /admin 一律不存在。未設定 ADMIN_SEGMENT 時同樣適用。
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return notFound(request);
  }

  // ── Supabase session 續期 ──────────────────────────────────
  // Server Component 不能寫 cookie，因此 token 續期必須在 proxy（Next 16 之前叫 middleware）做，
  // 否則使用者的登入狀態會在 access token 過期後靜默失效。
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // 續期失敗不該讓整個網站掛掉；後台頁面自己會再驗一次身分
  }

  return response;
}

export const config = {
  matcher: [
    // 排除靜態資源與圖片，避免對每個 asset 都跑一次 session 續期
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
