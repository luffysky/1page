"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { measureImage } from "@/components/editor/upload";
import { ACCEPT_ATTRIBUTE, ALLOWED_MEDIA, formatBytes } from "@/config/media";
import {
  createMediaUploadUrl,
  deleteMedia,
  reorderMedia,
  saveMediaRecord,
} from "@/features/admin/media-actions";

export interface MediaItem {
  id: string;
  type: "image" | "video" | "pdf" | "embed" | "external";
  url: string;
  alt: string | null;
  role: string;
  sort_order: number;
}

/**
 * 媒體管理（Spec §8.9）
 *
 * 上傳流程刻意用 XMLHttpRequest 而非 fetch：
 * 只有前者能回報上傳進度。大型影片上傳沒有進度條，使用者會以為當掉了。
 *
 * 檔案直接 PUT 到 R2，不經過我們的伺服器——因此不必讓 100MB 的影片
 * 流經 Node 行程。代價是無法在伺服器端檢查檔案內容（magic bytes），
 * 這個取捨記在 config/media.ts。
 */

type UploadState = {
  name: string;
  progress: number;
  error?: string;
};

const ROLE_OPTIONS = [
  { value: "gallery", label: "圖廊" },
  { value: "cover", label: "封面（每件作品限一張）" },
  { value: "desktop", label: "桌機截圖" },
  { value: "mobile", label: "行動版截圖" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "document", label: "文件" },
] as const;

export function MediaManager({ projectId, media }: { projectId: string; media: MediaItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [role, setRole] = useState<string>("gallery");
  const [dragId, setDragId] = useState<string | null>(null);

  function putToR2(url: string, file: File, onProgress: (percent: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", url);
      request.setRequestHeader("Content-Type", file.type);

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error(`上傳失敗（HTTP ${request.status}）`));
      request.onerror = () => reject(new Error("網路錯誤"));
      request.send(file);
    });
  }

  async function uploadOne(file: File, index: number) {
    const update = (patch: Partial<UploadState>) =>
      setUploads((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    const presigned = await createMediaUploadUrl({
      projectId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });

    if (!presigned.ok) {
      update({ error: presigned.message });
      return;
    }

    try {
      await putToR2(presigned.uploadUrl, file, (percent) => update({ progress: percent }));
    } catch (uploadError) {
      update({ error: uploadError instanceof Error ? uploadError.message : "上傳失敗" });
      return;
    }

    /*
     * 尺寸在上傳成功之後才量，而不是之前。
     *
     * 量不出來只是「這張圖沒有尺寸資料」（公開頁面有 fallback），
     * 而上傳失敗是真的失敗——先量的話，一個 measureImage 的意外
     * 會擋掉一次本來會成功的上傳。
     */
    const size = await measureImage(file);

    const saved = await saveMediaRecord({
      projectId,
      url: presigned.publicUrl,
      type: presigned.mediaType,
      alt,
      role,
      filename: file.name,
      ...(size ?? {}),
    });

    if (!saved.ok) {
      update({ error: saved.message });
      return;
    }

    update({ progress: 100 });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const list = Array.from(files);
    setUploads(list.map((file) => ({ name: file.name, progress: 0 })));

    // 逐一上傳而非同時：同時上傳多個大檔會互相搶頻寬，
    // 進度條會一起卡在中間，看起來像壞掉了
    for (const [index, file] of list.entries()) {
      await uploadOne(file, index);
    }

    setAlt("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;

    const ordered = [...media];
    const from = ordered.findIndex((item) => item.id === dragId);
    const to = ordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved!);
    setDragId(null);

    startTransition(async () => {
      const result = await reorderMedia(ordered.map((item) => item.id));
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  const failed = uploads.filter((item) => item.error);

  return (
    <section className="border-brand-line mt-12 border-t pt-8">
      <h2 className="text-heading-1">媒體</h2>
      <p className="text-caption text-brand-muted mt-2">
        支援 {ALLOWED_MEDIA.map((k) => k.label).join(" / ")}。 圖片上限{" "}
        {formatBytes(8 * 1024 * 1024)}、影片 {formatBytes(100 * 1024 * 1024)}。 SVG
        目前不開放上傳（需先接上伺服器端 sanitizer）。
      </p>

      <div className="border-brand-line bg-brand-paper mt-6 rounded-lg border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-body-sm block font-bold">替代文字</span>
            <span className="text-caption text-brand-muted mt-1 block">
              圖片必填。描述畫面內容，不要寫「圖片」或檔名。
            </span>
            <input
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              maxLength={300}
              className="border-brand-line bg-brand-bg text-body mt-2 w-full rounded-md border px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-body-sm block font-bold">用途</span>
            <span className="text-caption text-brand-muted mt-1 block">
              封面用於列表卡片，不會重複出現在圖廊。
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="border-brand-line bg-brand-bg text-body mt-2 w-full rounded-md border px-4 py-3"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          onChange={(event) => void handleFiles(event.target.files)}
          className="text-body-sm mt-4 block w-full"
        />

        {uploads.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {uploads.map((item, index) => (
              <li key={`${item.name}-${index}`} className="text-caption">
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate">{item.name}</span>
                  <span className={item.error ? "text-brand-accent-strong" : "text-brand-muted"}>
                    {item.error ?? `${item.progress}%`}
                  </span>
                </div>
                {!item.error ? (
                  <div className="bg-brand-line mt-1 h-1 w-full overflow-hidden rounded-pill">
                    <div
                      className="bg-brand-ink h-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {failed.length > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-brand-line text-caption mt-4 rounded-pill border px-4 py-2"
          >
            重新選擇檔案再試一次
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-body-sm text-brand-accent-strong mt-4 font-bold">
          {error}
        </p>
      ) : null}

      {media.length > 0 ? (
        <>
          <p className="text-caption text-brand-muted mt-8">
            拖曳可調整順序。順序會反映在公開頁面的圖廊上。
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {media.map((item) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className={`border-brand-line bg-brand-paper flex flex-wrap items-center gap-4 rounded-lg border p-3 ${
                  dragId === item.id ? "opacity-50" : ""
                }`}
              >
                <span className="text-caption text-brand-muted cursor-grab select-none">⠿</span>

                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.alt ?? ""}
                    className="border-brand-line h-16 w-24 rounded-md border object-cover"
                  />
                ) : (
                  <span className="border-brand-line text-caption grid h-16 w-24 place-items-center rounded-md border">
                    {item.type}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-caption">
                    <span className="border-brand-line rounded-pill border px-2 py-0.5">
                      {item.role}
                    </span>
                  </p>
                  <p className="text-caption text-brand-muted mt-1 truncate">
                    {item.alt || "（無替代文字）"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteMedia(item.id);
                      if (!result.ok) setError(result.message);
                      router.refresh();
                    })
                  }
                  className="text-caption text-brand-muted underline underline-offset-4"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
