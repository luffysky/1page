import { ALLOWED_MEDIA, formatBytes, type MediaKind } from "@/config/media";

/**
 * 上傳的共用部分（CR-004 / Phase B BJ）
 *
 * 從 `image-upload-field.tsx` 抽出來，因為背景那一塊也要上傳，
 * 而它要的是**單一檔案、可能是影片**。
 *
 * ⚠️ 抽的是「怎麼傳」與「先擋什麼」，不是整個 UI。
 * 兩邊的介面差很多（一個是相簿、一個是單一背景），
 * 硬共用一個元件會變成一堆 `if (mode === …)`——那種元件沒有人敢改。
 */

export function kindsOf(type: MediaKind["type"]): MediaKind[] {
  return ALLOWED_MEDIA.filter((kind) => kind.type === type);
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
export function rejectReasonFor(file: File, kinds: MediaKind[], noun: string): string | null {
  const kind = kinds.find((item) => item.mime === file.type);
  if (!kind) {
    return `只能上傳${noun}（${kinds.map((item) => item.label).join("、")}）`;
  }
  if (file.size > kind.maxBytes) {
    return `${kind.label} 最大 ${formatBytes(kind.maxBytes)}，這個是 ${formatBytes(file.size)}`;
  }
  return null;
}

/**
 * 直傳 R2，帶進度。
 *
 * ⚠️ 用 XMLHttpRequest，不是 fetch。
 * fetch 沒有上傳進度事件（`ReadableStream` 的上傳串流在瀏覽器支援度還不夠），
 * 而一支 40MB 的影片在手機網路上要傳很久——沒有進度條的話，
 * 使用者分不出「在跑」與「卡住了」。
 */
export function putWithProgress(
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
