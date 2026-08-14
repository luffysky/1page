import { describe, expect, it } from "vitest";

import {
  backgroundLayerStyle,
  backgroundWarnings,
  DEFAULT_MEDIA_OVERLAY,
  hasVisibleBackground,
  overlayStyle,
  switchBackgroundType,
} from "./section-background";
import type { SectionBackground } from "./schema";

/**
 * Section 背景（CR-004 / Phase B BJ）
 *
 * 背景壞掉的方式很少是白畫面，多半是「看得到但讀不出來」——
 * 而那件事在自己的螢幕上通常看不出來，因為看的人已經知道字寫什麼。
 * 所以這幾條在單元測試層就先擋一次。
 */

const image: SectionBackground = {
  type: "image",
  imageUrl: "https://media.example.test/a.jpg",
  overlay: 0.4,
};

describe("hasVisibleBackground", () => {
  it("選了型別但還沒挑東西，等於沒有背景", () => {
    /*
     * 不分辨的話，編輯器會顯示「已設定背景」而畫面上什麼都沒有——
     * 使用者會以為壞了，然後開始亂改別的東西。
     */
    expect(hasVisibleBackground({ type: "image" })).toBe(false);
    expect(hasVisibleBackground({ type: "color" })).toBe(false);
    expect(hasVisibleBackground({ type: "gradient", gradientFrom: "#fff" })).toBe(false);
  });

  it("影片還沒挑但有封面圖，仍然畫得出東西", () => {
    expect(
      hasVisibleBackground({ type: "video", imageUrl: "https://media.example.test/a.jpg" }),
    ).toBe(true);
  });

  it("完整的就是有", () => {
    expect(hasVisibleBackground(image)).toBe(true);
    expect(hasVisibleBackground({ type: "color", color: "#000" })).toBe(true);
  });

  it("沒有背景或 none 都是沒有", () => {
    expect(hasVisibleBackground(undefined)).toBe(false);
    expect(hasVisibleBackground({ type: "none" })).toBe(false);
  });
});

describe("switchBackgroundType", () => {
  it("圖片與影片互相保留，比較的時候不用重挑", () => {
    const before: SectionBackground = {
      type: "image",
      imageUrl: "https://media.example.test/a.jpg",
      videoUrl: "https://media.example.test/a.mp4",
      overlay: 0.5,
    };

    const after = switchBackgroundType(before, "video");
    expect(after.imageUrl).toBe(before.imageUrl);
    expect(after.videoUrl).toBe(before.videoUrl);
  });

  it("換成媒體時預設就有遮罩，不是從 0 開始", () => {
    /*
     * ⚠️ 這一條是刻意的預設值，不是隨手填的。
     *
     * 從 0 開始的話，第一眼看到的是「照片很漂亮、字有點看不清楚」，
     * 而那個「有點」在自己的螢幕上通常還讀得出來。
     */
    const after = switchBackgroundType({ type: "none" }, "image");
    expect(after.overlay).toBe(DEFAULT_MEDIA_OVERLAY);
    expect(after.overlay).toBeGreaterThan(0);
  });

  it("顏色不會跟著媒體一起留下來", () => {
    // 留著的話會變成兩層背景，而使用者看到的是他沒設定過的結果
    const after = switchBackgroundType({ type: "color", color: "#123456" }, "image");
    expect(after.color).toBeUndefined();
  });

  it("換成 none 就什麼都不留", () => {
    expect(switchBackgroundType(image, "none")).toEqual({ type: "none" });
  });
});

describe("backgroundLayerStyle", () => {
  it("漸層要兩端都有才畫得出來", () => {
    const half = backgroundLayerStyle({ type: "gradient", gradientFrom: "#fff" });
    expect(half.backgroundImage, "只有一端不該畫成一個看起來正常的漸層").toBeUndefined();

    const full = backgroundLayerStyle({
      type: "gradient",
      gradientFrom: "#fff",
      gradientTo: "#000",
      gradientAngle: 90,
    });
    expect(full.backgroundImage).toBe("linear-gradient(90deg, #fff, #000)");
  });

  it("不安全的色值被丟掉，而不是整個背景消失", () => {
    /*
     * 與 themeToCssVars 同一個判斷：失敗要盡量小。
     * 少一個顏色會退回底色，整塊消失則是一個看不懂的空白。
     */
    const style = backgroundLayerStyle({
      type: "color",
      color: 'red; background-image: url("//evil/x")' as string,
    });
    expect(style.backgroundColor).toBeUndefined();
  });

  it("圖片網址進 url() 之前有逸出", () => {
    const style = backgroundLayerStyle({
      type: "image",
      imageUrl: 'https://media.example.test/a".jpg',
    });
    expect(style.backgroundImage).toBe('url("https://media.example.test/a\\".jpg")');
  });

  it("模糊時會放大一點，不然四周會露出一圈", () => {
    const style = backgroundLayerStyle({ ...image, blur: 10 });
    expect(style.filter).toBe("blur(10px)");
    expect(style.transform).toBe("scale(1.1)");
  });

  it("純色與漸層不吃模糊——那是給照片用的", () => {
    const style = backgroundLayerStyle({ type: "color", color: "#000", blur: 10 });
    expect(style.filter).toBeUndefined();
  });
});

describe("overlayStyle", () => {
  it("沒有遮罩就不要多一層", () => {
    expect(overlayStyle({ ...image, overlay: 0 })).toBeNull();
    expect(overlayStyle({ type: "color", color: "#000", overlay: 0.5 })).toBeNull();
  });

  it("有遮罩就給一層，顏色來自 token、濃度來自使用者", () => {
    /*
     * 顏色寫死在程式碼裡的話，日後想把遮罩調成帶一點暖色
     * 就得回來改程式——而設計數值的唯一歸屬地是 tokens.css。
     */
    expect(overlayStyle(image)).toEqual({
      backgroundColor: "var(--color-brand-scrim-solid)",
      opacity: 0.4,
    });
  });
});

describe("backgroundWarnings", () => {
  it("照片沒有遮罩時要出聲", () => {
    const warnings = backgroundWarnings({ ...image, overlay: 0 });
    expect(warnings.join("")).toContain("遮罩");
  });

  it("影片沒有封面時要出聲", () => {
    /*
     * 影片還在載、或訪客開了「減少動態效果」時，看到的就是封面。
     * 沒有封面的話那一塊是全黑，看起來像網站壞了，而不是像設計。
     */
    const warnings = backgroundWarnings({
      type: "video",
      videoUrl: "https://media.example.test/a.mp4",
      overlay: 0.4,
    });
    expect(warnings.join("")).toContain("封面");
  });

  it("設定完整就不要囉唆", () => {
    expect(
      backgroundWarnings({
        type: "video",
        videoUrl: "https://media.example.test/a.mp4",
        imageUrl: "https://media.example.test/a.jpg",
        overlay: 0.4,
      }),
    ).toEqual([]);
    expect(backgroundWarnings({ type: "none" })).toEqual([]);
    expect(backgroundWarnings(undefined)).toEqual([]);
  });
});
