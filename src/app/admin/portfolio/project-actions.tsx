"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setProjectFeatured, setProjectStatus } from "@/features/admin/actions";

/**
 * 列表上的狀態操作。
 *
 * 刻意只提供發布 / 下架 / 封存 / 精選——**沒有刪除**。
 * 作品是累積型資產（Spec §44 的飛輪），誤刪的代價遠高於封存；
 * 刪除需進到編輯頁並明確確認。
 *
 * 這些按鈕呼叫 Server Action，而 Server Action 自己會再驗一次身分——
 * 「按鈕只有 admin 看得到」不構成任何保護。
 */
export function ProjectActions({
  id,
  status,
  featured,
}: {
  id: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  const button = "text-caption rounded-pill border px-3 py-1.5 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "published" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setProjectStatus(id, "draft"))}
          className={`${button} border-brand-line`}
        >
          下架
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setProjectStatus(id, "published"))}
          className={`${button} border-brand-ink font-bold`}
        >
          發布
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setProjectFeatured(id, !featured))}
        className={`${button} ${featured ? "border-brand-accent-strong" : "border-brand-line"}`}
      >
        {featured ? "取消精選" : "設為精選"}
      </button>

      {status !== "archived" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setProjectStatus(id, "archived"))}
          className={`${button} border-brand-line text-brand-muted`}
        >
          封存
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-caption text-brand-accent-strong w-full">
          {error}
        </p>
      ) : null}
    </div>
  );
}
