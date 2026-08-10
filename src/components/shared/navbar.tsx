"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Navbar（含 Mobile Nav）
 *
 * V3 Demo 在 900px 以下直接 `display:none` 隱藏導覽列且無任何替代，
 * 手機完全無法瀏覽分頁（Spec §45.1）。此處以原生 <dialog> 實作。
 *
 * 選用原生 <dialog> 而非自行拼裝面板的理由：
 * focus trap、Escape 關閉、背景 inert 都是瀏覽器原生行為，
 * 手刻這三件事很容易做得半殘，而無障礙半殘等同沒做（Spec §35）。
 *
 * 所有站內連結一律用 next/link：`<a>` 會觸發整頁重新載入，
 * 在有多個頁面之後那是實際可感知的退步，不只是 lint 規則。
 */
export function Navbar({
  links,
  cta,
  adminEntry = null,
}: {
  links: NavLink[];
  cta: NavLink;
  /**
   * 後台入口。只有已驗證的後台人員會拿到值，其他人一律 null。
   *
   * ⚠️ 這個 prop 為 null 時，後台路徑完全不會出現在送給瀏覽器的 HTML 裡。
   * 這是密路徑保密的關鍵：入口只渲染給真的有權限的人，
   * 而不是渲染給所有人再用 CSS 藏起來。
   */
  adminEntry?: { href: string; role: string } | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Escape 由瀏覽器處理，但要把 state 同步回來
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <header className="border-brand-line bg-brand-bg/85 sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-page items-center justify-between gap-5 px-gutter lg:px-gutter-lg">
        {/* 品牌回首頁。原本指向 #top，但那個錨點只存在於首頁 */}
        <Link href="/" className="flex items-center gap-3">
          <span className="bg-brand-ink text-brand-on-ink grid h-10 w-10 place-items-center rounded-md text-xl font-black">
            1
          </span>
          <span className="text-heading-2">一頁起家</span>
        </Link>

        <nav aria-label="主要導覽" className="text-body-sm hidden gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand-muted hover:text-brand-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {adminEntry ? (
            <Link
              href={adminEntry.href}
              className="border-brand-ink text-caption hidden rounded-pill border px-4 py-2 font-bold md:inline-flex"
            >
              後台
              <span className="text-brand-muted ml-1.5 font-normal">{adminEntry.role}</span>
            </Link>
          ) : null}

          <Link
            href={cta.href}
            className="bg-brand-accent-strong text-brand-on-accent text-body-sm hidden rounded-pill px-5 py-3 font-bold md:inline-flex"
          >
            {cta.label}
          </Link>

          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="開啟選單"
            onClick={() => {
              dialogRef.current?.showModal();
              setOpen(true);
            }}
            className="border-brand-line text-body-sm rounded-pill border px-4 py-2.5 md:hidden"
          >
            選單
          </button>
        </div>
      </div>

      <dialog
        id="mobile-nav"
        ref={dialogRef}
        aria-label="行動版選單"
        className="bg-brand-paper text-brand-ink backdrop:bg-brand-ink/40 m-0 h-full max-h-none w-full max-w-none p-gutter"
      >
        <div className="flex items-center justify-between">
          <span className="text-heading-2">一頁起家</span>
          <button
            type="button"
            onClick={close}
            aria-label="關閉選單"
            className="border-brand-line rounded-pill border px-4 py-2.5"
          >
            關閉
          </button>
        </div>

        <nav aria-label="行動版導覽" className="mt-10 flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="text-heading-1 border-brand-line border-b py-4"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href={cta.href}
            onClick={close}
            className="bg-brand-accent-strong text-brand-on-accent inline-flex rounded-pill px-6 py-3.5 font-bold"
          >
            {cta.label}
          </Link>

          {adminEntry ? (
            <Link
              href={adminEntry.href}
              onClick={close}
              className="border-brand-ink text-body-sm inline-flex rounded-pill border px-5 py-3 font-bold"
            >
              後台
            </Link>
          ) : null}
        </div>
      </dialog>
    </header>
  );
}
