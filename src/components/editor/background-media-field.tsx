"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { createSiteImageUploadUrl } from "@/app/edit/media-actions";
import type { MediaKind } from "@/config/media";

import { kindsOf, putWithProgress, rejectReasonFor } from "./upload";

/**
 * 背景用的單一檔案上傳（CR-004 / Phase B BJ）
 *
 * ── 與相簿那個欄位刻意分開 ────────────────────────────────────
 *
 * `image-upload-field.tsx` 是一個相簿：多張、可排序、可裁切。
 * 背景要的是**一個**檔案，而且可能是影片。硬塞進同一個元件
 * 會變成一堆 `if (mode === "background")`——那種元件沒有人敢改。
 *
 * 共用的是「怎麼傳」與「先擋什麼」（`upload.ts`），不是 UI。
 *
 * ── 網址欄位留著，而且是可編輯的 ──────────────────────────────
 *
 * 已經傳過一次的檔案要換到另一塊去用時，複製網址比重傳快得多。
 * 而且 schema 會擋掉非本站網域，所以貼錯的下場是明確的錯誤訊息，
 * 不是一個對外洩漏訪客 IP 的請求。
 */

const kindLabels = (kinds: MediaKind[]) => kinds.map((kind) => kind.label).join("、");

export function BackgroundMediaField({
  label,
  hint,
  mediaType,
  value,
  signedIn,
  onChange,
}: {
  label: string;
  hint?: string;
  mediaType: "image" | "video";
  value: string;
  signedIn: boolean;
  onChange: (next: string) => void;
}) {
  const kinds = kindsOf(mediaType);
  const noun = mediaType === "image" ? "圖片" : "影片";

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlId = useId();
  const statusId = useId();

  async function upload(file: File) {
    setError(null);

    const reason = rejectReasonFor(file, kinds, noun);
    if (reason) {
      setError(reason);
      return;
    }

    setProgress(0);

    try {
      const signed = await createSiteImageUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      if (!signed.ok) {
        setError(signed.message);
        setProgress(null);
        return;
      }

      await putWithProgress(signed.uploadUrl, file, setProgress);
      onChange(signed.publicUrl);
      setProgress(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上傳失敗");
      setProgress(null);
    }
  }

  return (
    <div className="mt-4">
      <label htmlFor={urlId} className="text-caption text-brand-muted block">
        {label}
      </label>
      {hint ? <p className="text-caption text-brand-muted mt-1">{hint}</p> : null}

      {/*
       * 網址是一個真的可以打字的框，不是唯讀的顯示。
       *
       * ⚠️ readOnly 的 input 仍然吃 Tab：看得到、聚焦得到、打不了字。
       * axe 不會報這件事，但鍵盤使用者會卡在那裡不知道為什麼。
       */}
      <input
        id={urlId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`貼上網址，或按下面的按鈕上傳`}
        className="border-brand-line bg-brand-bg text-body-sm mt-2 w-full rounded-md border px-3 py-2"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {/*
         * 真正的控制項是一顆 <button>，不是把 onClick 掛在 div 上。
         * div 不在 Tab 順序上、沒有 role、按 Enter 沒反應——
         * 鍵盤使用者完全上傳不了。
         */}
        <button
          type="button"
          disabled={!signedIn || progress !== null}
          onClick={() => inputRef.current?.click()}
          className="border-brand-ink text-caption rounded-pill border px-4 py-1.5 font-bold disabled:opacity-40"
        >
          {progress !== null ? `上傳中 ${progress}%` : `上傳${noun}`}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="border-brand-line text-caption rounded-pill border px-4 py-1.5"
          >
            移除
          </button>
        ) : null}

        <span className="text-caption text-brand-muted">{kindLabels(kinds)}</span>
      </div>

      {!signedIn ? (
        <p className="text-caption text-brand-muted mt-2">
          上傳要先{" "}
          <Link href="/login?next=/edit" className="underline">
            登入
          </Link>
          。排版本身不用登入。
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={kinds.map((kind) => kind.mime).join(",")}
        aria-label={`選擇要上傳的${noun}`}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // 同一個檔案連選兩次也要觸發，所以每次都清掉
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      {/*
       * `aria-live` 讓進度與錯誤被讀出來。
       * 只有視覺上的紅字，看不到畫面的人不知道剛才那次上傳失敗了。
       */}
      <p id={statusId} aria-live="polite" className="text-caption text-brand-muted mt-2">
        {error ? <span className="text-brand-accent-strong font-bold">{error}</span> : null}
      </p>
    </div>
  );
}
