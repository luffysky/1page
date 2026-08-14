import { SectionBackgroundLayer } from "@/features/website-engine/sections/section-background";
import type { SectionBackground } from "@/features/website-engine/schema";
import { hasVisibleBackground } from "@/features/website-engine/section-background";

/**
 * 官網自己的一塊，可能帶背景（CR-004 / Phase B BJ-2）
 *
 * ── 為什麼與 SiteRenderer 那條路共用背景元件 ──────────────────
 *
 * 背景的規則（遮罩預設、影片遇到「減少動態」怎麼辦、整層 aria-hidden）
 * 兩邊必須一模一樣。各寫一份的話，後台調好的東西在官網上長得不一樣，
 * 而那種差異沒有人會想到要去比對兩個檔案。
 *
 * 所以這裡只做一件事：包一層定位，把 BJ-1 的背景層放進去。
 *
 * ⚠️ 沒有背景時**完全不包**，直接回傳內容。
 *
 * 永遠包一層 `<div class="relative isolate">` 看起來無害，
 * 但 `isolate` 會建立新的 stacking context，而首頁上有幾塊
 * 需要黏在視窗上的東西（預覽的裝置框）。多一層堆疊脈絡足以讓
 * `position: sticky` 停在錯的地方——而那是一個很難查的視覺 bug。
 */
export function PageBlock({
  background,
  children,
}: {
  background?: SectionBackground;
  children: React.ReactNode;
}) {
  if (!hasVisibleBackground(background)) return <>{children}</>;

  return (
    <div className="relative isolate">
      <SectionBackgroundLayer background={background!} />
      {children}
    </div>
  );
}
