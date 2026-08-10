import { describe, expect, it } from "vitest";

import { ALLOWED_MEDIA, extensionMatchesMime, findMediaKind, sanitizeFilename } from "./media";

/**
 * 上傳驗證（Spec §36）。
 *
 * 這組測試的重點不是「正常檔案能過」，而是「偽裝的檔案過不了」——
 * 那才是驗證存在的理由。
 */

describe("MIME 白名單", () => {
  it("名單內的類型可辨識", () => {
    expect(findMediaKind("image/png")?.type).toBe("image");
    expect(findMediaKind("video/mp4")?.type).toBe("video");
    expect(findMediaKind("application/pdf")?.type).toBe("pdf");
  });

  it("名單外的一律拒絕，不嘗試猜測", () => {
    for (const mime of [
      "text/html",
      "application/javascript",
      "application/x-msdownload",
      "image/svg+xml",
      "",
      "image/png; charset=utf-8",
    ]) {
      expect(findMediaKind(mime), mime).toBeNull();
    }
  });

  it("SVG 刻意不在白名單內（Spec §36：停用 raw inline rendering）", () => {
    // SVG 是可執行的 XML。要開放必須先接上伺服器端 sanitizer。
    expect(ALLOWED_MEDIA.some((kind) => kind.mime === "image/svg+xml")).toBe(false);
  });
});

describe("副檔名必須與 MIME 相符", () => {
  const png = findMediaKind("image/png")!;

  it("相符時回傳副檔名", () => {
    expect(extensionMatchesMime("photo.png", png)).toBe("png");
    expect(extensionMatchesMime("PHOTO.PNG", png)).toBe("png");
  });

  it("把可執行檔改名成圖片仍會被擋下", () => {
    // 只驗 MIME 不夠（瀏覽器提供的可偽造），只驗副檔名也不夠（可隨便改）
    expect(extensionMatchesMime("payload.html", png)).toBeNull();
    expect(extensionMatchesMime("payload.exe", png)).toBeNull();
    expect(extensionMatchesMime("payload.php", png)).toBeNull();
  });

  it("雙重副檔名以最後一個為準", () => {
    expect(extensionMatchesMime("evil.png.html", png)).toBeNull();
    expect(extensionMatchesMime("safe.html.png", png)).toBe("png");
  });

  it("沒有副檔名一律拒絕", () => {
    expect(extensionMatchesMime("noextension", png)).toBeNull();
    expect(extensionMatchesMime("trailing.", png)).toBeNull();
  });

  it("jpeg 的兩種副檔名都接受", () => {
    const jpeg = findMediaKind("image/jpeg")!;
    expect(extensionMatchesMime("a.jpg", jpeg)).toBe("jpg");
    expect(extensionMatchesMime("a.jpeg", jpeg)).toBe("jpeg");
  });
});

describe("檔名淨化", () => {
  it("移除路徑分隔字元，阻止路徑穿越", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFilename("..\..\windows\system32")).not.toContain("\\");
  });

  it("壓縮連續句點", () => {
    expect(sanitizeFilename("a..b...c")).toBe("a.b.c");
  });

  it("移除控制字元", () => {
    expect(sanitizeFilename("a\u0000b\u001fc")).toBe("abc");
  });

  it("限制長度", () => {
    expect(sanitizeFilename("x".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe("大小上限", () => {
  it("每一種類型都有明確上限", () => {
    for (const kind of ALLOWED_MEDIA) {
      expect(kind.maxBytes, kind.label).toBeGreaterThan(0);
    }
  });

  it("影片上限高於圖片——但兩者都有限制", () => {
    const image = findMediaKind("image/png")!;
    const video = findMediaKind("video/mp4")!;
    expect(video.maxBytes).toBeGreaterThan(image.maxBytes);
    expect(video.maxBytes).toBeLessThanOrEqual(200 * 1024 * 1024);
  });
});
