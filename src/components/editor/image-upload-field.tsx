"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";

import { createSiteImageUploadUrl } from "@/app/edit/media-actions";
import { ALLOWED_MEDIA, formatBytes } from "@/config/media";
import { canEdit } from "@/features/website-engine/image-edit";

import { ImageEditor } from "./image-editor";

/**
 * 圖片上傳欄位（CR-003-4，0815 依三個參考專案重寫）
 *
 * ── 為什麼要重寫 ──────────────────────────────────────────────
 *
 * 第一版是一個裸的 `<input type="file">`：沒有拖放、沒有進度、
 * 一次只能一張、選完之前看不到自己選了什麼。8MB 的照片在手機網路上
 * 傳三十秒，畫面只寫「上傳中…」——使用者不知道是在跑還是卡住了。
 *
 * ── 從三個參考專案抄什麼 ──────────────────────────────────────
 *
 * SnowRealmSpace 的 `library/Uploader.tsx` 是三者裡最完整的：
 *   ✅ 前端先擋 MIME 與大小，省一次往返，而且訊息更具體
 *   ✅ **用 XHR 而不是 fetch**——fetch 沒有上傳進度事件，
 *      要有真的進度條就只能用 XHR。這是整份抄過來最關鍵的一點
 *   ✅ 每個檔案各自的狀態與訊息，不是一個全域的「上傳中」
 *   ✅ 超過批次上限時**誠實說被截斷了**，不是安靜地只傳前幾個
 *
 * ai_island_v3 的 `ImageUploader.tsx` 貢獻了「已有圖片時顯示縮圖 +
 * 換一張／移除」這個形狀。
 *
 * ── 刻意不抄的 ────────────────────────────────────────────────
 *
 * ❌ ai_island 的 `/api/upload`（檔案經過自己的伺服器）
 *    → 1page 一律 presigned 直傳 R2：大檔不佔 serverless 的記憶體與時間，
 *      而且少一個會失敗的環節
 *
 * ❌ ai_island 的「整塊 div 加 onClick」當上傳區
 *    → div 不在 Tab 順序上、沒有 role、按 Enter 沒反應。
 *      鍵盤使用者完全上傳不了。這裡拖放掛在外框上，
 *      真正的控制項是一顆貨真價實的 `<button>`
 *
 * ❌ SnowRealmSpace 的 SHA-256 去重與 intent／complete 兩段式 API
 *    → 那套要多一個 checksum 欄位與第二個端點。我們的簽名網址是一次性的，
 *      而且 content-type / content-length 已經鎖在簽章裡（test:db 實測過
 *      改 Content-Type 會被 R2 拒絕）。訪客自己的相簿裡重複一張圖，
 *      代價遠低於維護那一整套
 */

const IMAGE_KINDS = ALLOWED_MEDIA.filter((kind) => kind.type === "image");
const IMAGE_MIME_TYPES = IMAGE_KINDS.map((kind) => kind.mime);
const MAX_IMAGE_BYTES = Math.max(...IMAGE_KINDS.map((kind) => kind.maxBytes));

/** 一次最多幾張。超過就說出來，不安靜地截斷 */
const MAX_BATCH = 10;

type Status = "uploading" | "failed";

interface Pending {
  id: string;
  filename: string;
  bytes: number;
  progress: number;
  status: Status;
  message?: string;
}

/**
 * 前端先擋一次。
 *
 * ⚠️ 這**不是**安全檢查——真正的把關在 server action（驗身分、驗白名單、
 * 驗副檔名與 MIME 是否相符、驗大小），而簽章又把 content-type 與長度
 * 鎖死在 R2 那一端。這裡只是為了少一次往返，以及給出更具體的訊息。
 *
 * 兩邊讀同一份 `ALLOWED_MEDIA`，所以不會出現「前端說可以、後端說不行」。
 */
function rejectReason(file: File): string | null {
  const kind = IMAGE_KINDS.find((item) => item.mime === file.type);
  if (!kind) {
    return `只能上傳圖片（${IMAGE_KINDS.map((item) => item.label).join("、")}）`;
  }
  if (file.size > kind.maxBytes) {
    return `${kind.label} 最大 ${formatBytes(kind.maxBytes)}，這張是 ${formatBytes(file.size)}`;
  }
  return null;
}

/**
 * 直傳 R2，帶進度。
 *
 * ⚠️ 用 XMLHttpRequest，不是 fetch。
 * fetch 沒有上傳進度事件（`ReadableStream` 的上傳串流在瀏覽器支援度還不夠），
 * 而 8MB 的照片在手機網路上要傳很久——沒有進度條的話，
 * 使用者分不出「在跑」與「卡住了」。
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    /*
     * Content-Type 一定要與簽名時一致：presigner 把它列進了 signableHeaders，
     * 不一樣的話 R2 會直接拒絕。那正是這條規則存在的意義
     * （test:db 實測過：拿「image/png」的簽名網址上傳 text/html 會被擋）。
     */
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`儲存服務回應 ${xhr.status}`)),
    );
    xhr.addEventListener("error", () => reject(new Error("網路中斷")));
    xhr.addEventListener("abort", () => reject(new Error("上傳已取消")));

    xhr.send(file);
  });
}

export function ImageUploadField({
  images,
  signedIn,
  onChange,
}: {
  images: string[];
  signedIn: boolean;
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  /*
   * 等著被編輯的檔案。
   *
   * 一次只編輯一張：同時開三個裁切介面，使用者分不出自己在改哪一張。
   * 其餘的排在後面，一張處理完才輪到下一張。
   */
  const [queue, setQueue] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();

  const patch = useCallback((id: string, next: Partial<Pending>) => {
    setPending((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  const uploadOne = useCallback(
    async (file: File) => {
      const id = `${file.name}-${file.size}-${file.lastModified}`;

      const reason = rejectReason(file);
      if (reason) {
        setPending((current) => [
          ...current,
          {
            id,
            filename: file.name,
            bytes: file.size,
            progress: 0,
            status: "failed",
            message: reason,
          },
        ]);
        return;
      }

      setPending((current) => [
        ...current,
        { id, filename: file.name, bytes: file.size, progress: 0, status: "uploading" },
      ]);

      try {
        const presigned = await createSiteImageUploadUrl({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        if (!presigned.ok) {
          patch(id, { status: "failed", message: presigned.message });
          return;
        }

        await putWithProgress(presigned.uploadUrl, file, (percent) =>
          patch(id, { progress: percent }),
        );

        /*
         * 成功之後把這一筆從清單移除，圖片改由縮圖列表呈現。
         *
         * 留著「✓ 完成」那一行看起來比較有交代，但那份清單會越積越長，
         * 而且與下面的縮圖是同一件事的兩種說法。圖片出現在上面就是完成了。
         */
        setPending((current) => current.filter((item) => item.id !== id));
        onChange([...images, presigned.publicUrl]);
      } catch (error) {
        patch(id, {
          status: "failed",
          message: error instanceof Error ? error.message : "上傳失敗",
        });
      }
    },
    [images, onChange, patch],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const list = Array.from(files).slice(0, MAX_BATCH);

      if (files.length > MAX_BATCH) {
        // 誠實說明被截斷了，不是安靜地只處理前 10 個
        setPending((current) => [
          ...current,
          {
            id: `truncated-${files.length}`,
            filename: `一次最多 ${MAX_BATCH} 張`,
            bytes: 0,
            progress: 0,
            status: "failed",
            message: `你選了 ${files.length} 張，只會處理前 ${MAX_BATCH} 張。`,
          },
        ]);
      }

      /*
       * 能編輯的先進編輯佇列，不能編輯的（GIF）直接上傳。
       *
       * GIF 擋掉編輯是刻意的：畫進 canvas 只會留下第一格，
       * 而使用者不會預期「裁切一下」順便把動畫弄不見了。
       */
      const editable = list.filter((file) => canEdit(file.type));
      const asIs = list.filter((file) => !canEdit(file.type));

      if (editable.length > 0) setQueue((current) => [...current, ...editable]);

      /*
       * 一張一張傳，不是全部同時。
       *
       * 同時發十個請求會互相搶頻寬，每一條的進度都走走停停——
       * 十張都在 30% 卡著，比一張一張跑完更像壞掉。
       */
      void asIs.reduce((chain, file) => chain.then(() => uploadOne(file)), Promise.resolve());
    },
    [uploadOne],
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  };

  return (
    <fieldset>
      <legend className="text-body-sm font-bold">圖片</legend>

      {images.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {images.map((url, index) => (
            <li key={`${url}-${index}`} className="flex flex-wrap items-center gap-2">
              {/* 縮圖用原生 img，理由與 GalleryGrid 相同（容器寬度會即時變形） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-12 w-16 rounded-md object-cover" />
              <span className="text-caption text-brand-muted flex-1">第 {index + 1} 張</span>

              {/*
               * 排序按鈕。拖曳排序在這個小清單裡不划算，而且
               * WCAG 2.1 §2.5.7 要求拖曳一定要有替代路徑——
               * 只做按鈕就不必做兩套。
               */}
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`把第 ${index + 1} 張往前移`}
                className="border-brand-line text-caption rounded-pill border px-3 py-1 font-bold disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === images.length - 1}
                aria-label={`把第 ${index + 1} 張往後移`}
                className="border-brand-line text-caption rounded-pill border px-3 py-1 font-bold disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, at) => at !== index))}
                aria-label={`刪除第 ${index + 1} 張圖片`}
                className="border-brand-line text-caption rounded-pill border px-3 py-1 font-bold"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
       * 編輯器：一次一張，處理完（或跳過）才換下一張。
       *
       * 放在上傳區**上面**：使用者剛選完檔案，視線在這附近，
       * 而編輯是接下來要做的事。放在下面的話它會被縮圖列表推走。
       */}
      {queue[0] ? (
        <ImageEditor
          key={`${queue[0].name}-${queue[0].lastModified}`}
          file={queue[0]}
          onCancel={() => setQueue((current) => current.slice(1))}
          onConfirm={(edited) => {
            setQueue((current) => current.slice(1));
            void uploadOne(edited);
          }}
        />
      ) : null}

      {signedIn ? (
        <div
          /*
           * 拖放掛在外框上，但真正的控制項是下面那顆 <button>。
           *
           * ⚠️ 參考專案有一個版本是「整塊 div 加 onClick」——
           * div 不在 Tab 順序上、沒有 role、按 Enter 也沒反應，
           * 鍵盤使用者完全上傳不了。拖放本來就只有滑鼠做得到，
           * 所以它只能是**額外的**路徑，不能是唯一的。
           */
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={`mt-3 rounded-lg border border-dashed p-4 text-center transition-colors ${
            dragging ? "border-brand-ink bg-brand-paper" : "border-brand-line"
          }`}
        >
          <p className="text-body-sm text-brand-muted">把圖片拖進來，或</p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-brand-ink text-body-sm rounded-pill mt-2 inline-flex border px-5 py-2 font-bold"
          >
            選擇圖片
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={IMAGE_MIME_TYPES.join(",")}
            aria-label="選擇要上傳的圖片"
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files);
              // 清掉 value，否則同一個檔案選第二次不會觸發 change
              event.target.value = "";
            }}
          />

          <p className="text-caption text-brand-muted mt-2">
            {IMAGE_KINDS.map((kind) => kind.label).join(" / ")}，單張最大{" "}
            {formatBytes(MAX_IMAGE_BYTES)}
          </p>
        </div>
      ) : (
        /*
         * 沒登入時說清楚為什麼，不要放一個按了會失敗的上傳框。
         *
         * 這條線與存檔那條不一樣：存檔是定價（免費編輯、存檔才付費），
         * 上傳是安全——不檢查身分的 presign 端點等於開放公開寫入，
         * 而 R2 沒有 RLS。
         */
        <p className="text-body-sm text-brand-muted mt-3">
          上傳圖片需要帳號（檔案要放在你名下才算得出用量）——
          <Link href="/login?next=%2Fedit" className="underline">
            登入
          </Link>
          。其他編輯都不用登入。
        </p>
      )}

      {/*
       * 進度與錯誤都放在同一個 live region。
       * 沒有 aria-live 的話，螢幕閱讀器使用者按下「選擇圖片」之後
       * 完全不知道發生了什麼——包括失敗。
       */}
      <ul
        id={statusId}
        aria-live="polite"
        aria-busy={pending.some((item) => item.status === "uploading")}
        className="mt-3 flex flex-col gap-2"
      >
        {pending.map((item) => (
          <li key={item.id} className="text-caption">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-brand-ink">{item.filename}</span>
              {item.bytes > 0 ? (
                <span className="text-brand-muted">{formatBytes(item.bytes)}</span>
              ) : null}
            </div>

            {item.status === "uploading" ? (
              <>
                {/* 原生 progress：語意、鍵盤與螢幕閱讀器行為全部由瀏覽器保證 */}
                <progress max={100} value={item.progress} className="mt-1 w-full">
                  {item.progress}%
                </progress>
                <p className="text-brand-muted">上傳中 {item.progress}%</p>
              </>
            ) : (
              <p className="text-brand-accent-strong font-bold">✕ {item.message}</p>
            )}

            {item.status === "failed" ? (
              <button
                type="button"
                onClick={() => setPending((current) => current.filter((x) => x.id !== item.id))}
                className="border-brand-line rounded-pill mt-1 border px-3 py-1"
              >
                清除
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
