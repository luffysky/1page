import { describe, expect, it } from "vitest";

import { buildEmbed, EMBED_SANDBOX } from "./embeds";

/**
 * 白名單嵌入（CR-003-3 / Spec §36）
 *
 * 這個模組唯一的工作就是**不相信給進來的字串**。
 * 所以測試的重點不是「正常的 id 會不會過」，而是
 * 「想跳出去的字串會不會被擋下來」。
 *
 * 內容的來源是 LLM 與訪客的操作，兩者都不能假設善意。
 */

/** 拿得到 src 才好斷言；失敗時直接讓測試講清楚是哪一筆 */
const src = (variant: string, content: Record<string, unknown>) => {
  const result = buildEmbed(variant, content);
  return result.ok ? result.spec.src : null;
};

describe("YouTube", () => {
  it("合法的 id 組成 nocookie 網址", () => {
    expect(src("youtube", { videoId: "aBcD1234_-x" })).toBe(
      "https://www.youtube-nocookie.com/embed/aBcD1234_-x",
    );
  });

  it("非 11 個字元一律拒絕", () => {
    for (const videoId of ["", "short", "aBcD1234_-xY", "aBcD1234_-"]) {
      expect(buildEmbed("youtube", { videoId }).ok, `「${videoId}」不該通過`).toBe(false);
    }
  });

  it("想跳出路徑或換主機的字串全部拒絕", () => {
    /*
     * 這些就是「只接受網址」會出事的那些形狀。
     * 因為只收 11 個 base64url 字元，它們連長度都不對——
     * 防線不是逐一比對黑名單，是格式本身就容不下它們。
     */
    const attacks = [
      "../../evil.com",
      "a/../../../x",
      "aaaaaaaaaaa?x=1",
      "aaaaaaaaaaa#f",
      'aaaaaaaaaaa"onload=alert(1)',
      "javascript:alert(1)",
      "//evil.com/x",
      "https://evil.com",
    ];

    for (const videoId of attacks) {
      expect(buildEmbed("youtube", { videoId }).ok, `「${videoId}」不該通過`).toBe(false);
    }
  });

  it("不是字串的 videoId 也拒絕", () => {
    for (const videoId of [undefined, null, 12345, {}, ["aBcD1234_-x"]]) {
      expect(buildEmbed("youtube", { videoId }).ok).toBe(false);
    }
  });
});

describe("地圖", () => {
  it("地址被完整編碼進 query", () => {
    const result = src("map", { query: "台北市大安區和平東路二段 100 號" });

    expect(result).toContain("https://www.google.com/maps?q=");
    expect(result).toContain("output=embed");
    // 空白不能原樣留著
    expect(result).not.toContain(" ");
  });

  it("想跳出 query 參數的字元全部被編碼掉", () => {
    /*
     * 地圖收的是自由文字（地址），沒辦法像 videoId 那樣用格式擋，
     * 所以靠的是整串 encodeURIComponent。
     * 這裡驗的是「危險字元沒有以原樣出現在 src 裡」。
     */
    const result = src("map", { query: `台北"><script>alert(1)</script>&key=x#f` });

    expect(result).not.toBeNull();

    /*
     * 只驗**字元**，不驗字眼。
     *
     * 這條原本還斷言 src 裡不能有 "script"，結果紅了——
     * encodeURIComponent 不動英數字，所以 script 這個**字**會留著。
     * 但那沒有問題：留下來的是查詢參數裡的一段純文字，
     * 危險的是 `<`、`>`、`"`、`&`、`#` 這些能跳出參數或閉合標籤的字元，
     * 而它們全部變成了 %XX。
     *
     * 斷言「不准出現某個字」是在防一個不存在的威脅，
     * 而且會讓一個叫做「script 咖啡」的店家永遠加不了地圖。
     */
    for (const dangerous of ["<", ">", '"', "'", "&key", "#f"]) {
      expect(result, `src 裡出現了未編碼的 ${dangerous}`).not.toContain(dangerous);
    }
  });

  it("主機永遠是 google.com，內容改不了它", () => {
    const result = src("map", { query: "@evil.com/x?a=b" });
    expect(new URL(result!).host).toBe("www.google.com");
  });

  it("空白與過長的查詢被拒絕", () => {
    expect(buildEmbed("map", { query: "   " }).ok).toBe(false);
    expect(buildEmbed("map", { query: "" }).ok).toBe(false);
    expect(buildEmbed("map", { query: "台".repeat(200) }).ok).toBe(false);
  });
});

describe("整體", () => {
  it("沒列在白名單裡的提供者一律拒絕", () => {
    // 這是白名單的意思：預設是不行，不是預設可以然後擋壞的。
    for (const variant of ["vimeo", "iframe", "html", "script", ""]) {
      expect(buildEmbed(variant, { videoId: "aBcD1234_-x" }).ok, `${variant} 不該通過`).toBe(false);
    }
  });

  it("組出來的 src 一定是 https，而且只會是那兩個主機", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["youtube", { videoId: "aBcD1234_-x" }],
      ["map", { query: "台北車站" }],
    ];

    for (const [variant, content] of cases) {
      const url = new URL(src(variant, content)!);
      expect(url.protocol).toBe("https:");
      expect(["www.youtube-nocookie.com", "www.google.com"]).toContain(url.host);
    }
  });

  it("sandbox 沒有給 allow-top-navigation 之類的東西", () => {
    /*
     * allow-top-navigation 會讓被嵌入的第三方把訪客整頁導走。
     * allow-forms / allow-modals 也沒有必要——播影片跟看地圖用不到。
     */
    for (const forbidden of [
      "allow-top-navigation",
      "allow-forms",
      "allow-modals",
      "allow-pointer-lock",
      "allow-downloads",
    ]) {
      expect(EMBED_SANDBOX, `sandbox 不該包含 ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("每個提供者都講得出自己是誰，給 facade 用", () => {
    // 訪客要知道按下去會連到哪裡，所以 provider 必須有值。
    for (const [variant, content] of [
      ["youtube", { videoId: "aBcD1234_-x" }],
      ["map", { query: "台北車站" }],
    ] as const) {
      const result = buildEmbed(variant, content);
      expect(result.ok && result.spec.provider.length).toBeGreaterThan(0);
      expect(result.ok && result.spec.title.length).toBeGreaterThan(0);
    }
  });
});
