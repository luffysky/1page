import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findDuplicateSectionIds, validateSiteConfig, type SiteConfig } from "./schema";

/**
 * SiteConfig 是不可信輸入（Spec §44：Agent 生成與修改 SiteConfig）。
 *
 * 這組測試的重點不是「合法設定能過」，而是**惡意或畸形的設定過不了**——
 * 那才是這層 schema 存在的理由。
 */

const VALID: SiteConfig = {
  id: "preview-1",
  brand: { name: "暮光甜室", tagline: "手作甜點", industry: "餐飲" },
  theme: {
    colors: {
      background: "#f4e6d5",
      surface: "#ffffff",
      text: "#2a211c",
      muted: "rgb(120, 110, 100)",
      accent: "#b65d43",
    },
    typography: { heading: "Noto Serif TC", body: "Inter" },
    radius: "16px",
    spacingScale: "1rem",
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "editorial",
      content: { title: "把今天的甜，留久一點。", cta: "看看今日甜點" },
    },
  ],
  settings: { language: "zh-Hant" },
};

function expectRejected(config: unknown, pathFragment?: string) {
  const result = validateSiteConfig(config);
  expect(result.ok).toBe(false);
  if (!result.ok && pathFragment) {
    expect(result.errors.some((error) => error.path.includes(pathFragment))).toBe(true);
  }
}

describe("合法設定", () => {
  it("通過驗證並回傳解析後的物件", () => {
    const result = validateSiteConfig(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.brand.name).toBe("暮光甜室");
  });

  it("錯誤以清單回傳，不拋例外——Agent 需要知道哪裡不對才能重試", () => {
    expect(() => validateSiteConfig({ nonsense: true })).not.toThrow();
    const result = validateSiteConfig({ nonsense: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("CSS 注入（3B 會把色彩注入 --site-* 自訂屬性）", () => {
  it.each([
    "red; background-image: url(//evil/x)",
    "#fff; --site-text: black",
    "expression(alert(1))",
    "url(javascript:alert(1))",
    "var(--something)",
    "#fff}/*",
  ])("拒絕可跳出屬性值的色彩：%s", (color) => {
    expectRejected(
      { ...VALID, theme: { ...VALID.theme, colors: { ...VALID.theme.colors, accent: color } } },
      "accent",
    );
  });

  it("接受一般寫法", () => {
    for (const color of [
      "#fff",
      "#ffffff",
      "#ffffffaa",
      "rgb(1,2,3)",
      "rgba(1,2,3,0.5)",
      "hsl(200,50%,50%)",
      "rebeccapurple",
    ]) {
      const result = validateSiteConfig({
        ...VALID,
        theme: { ...VALID.theme, colors: { ...VALID.theme.colors, accent: color } },
      });
      expect(result.ok, color).toBe(true);
    }
  });

  it("字型名稱不得含引號、分號或括號", () => {
    for (const font of ['Inter"; color: red', "Inter; }", "url(evil)"]) {
      expectRejected(
        {
          ...VALID,
          theme: { ...VALID.theme, typography: { ...VALID.theme.typography, body: font } },
        },
        "body",
      );
    }
  });

  it("圓角與間距只接受長度值", () => {
    expectRejected({ ...VALID, theme: { ...VALID.theme, radius: "16px; color: red" } }, "radius");
    expectRejected(
      { ...VALID, theme: { ...VALID.theme, spacingScale: "calc(100% - 1px)" } },
      "spacingScale",
    );
  });
});

describe("Spec §36：禁止 arbitrary HTML / script injection", () => {
  it("文字欄位拒絕 HTML 標籤", () => {
    expectRejected(
      { ...VALID, brand: { ...VALID.brand, name: "<script>alert(1)</script>" } },
      "name",
    );
    expectRejected(
      { ...VALID, brand: { ...VALID.brand, tagline: "<img src=x onerror=alert(1)>" } },
      "tagline",
    );
  });

  it("section 內容同樣拒絕 HTML", () => {
    expectRejected({
      ...VALID,
      sections: [{ ...VALID.sections[0]!, content: { title: "<iframe src=//evil>" } }],
    });
  });

  it("允許一般標點與全形符號——不能因為防注入就讓正常文案過不了", () => {
    const result = validateSiteConfig({
      ...VALID,
      brand: { ...VALID.brand, tagline: "5 < 10 且 a > b，這是正常文案！" },
    });
    expect(result.ok).toBe(true);
  });
});

describe("Spec §36：URL / image source validation", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==",
    "http://insecure.example.com/logo.png",
    "//protocol-relative.example.com/x.png",
    "vbscript:msgbox(1)",
  ])("拒絕不安全的 logo 來源：%s", (logo) => {
    expectRejected({ ...VALID, brand: { ...VALID.brand, logo } }, "logo");
  });

  /*
   * ⚠️ 這一條原本是「接受 https」，拿 `https://example.com/logo.png` 當例子。
   *
   * 而 schema 的註解寫的是「logo 走與其他媒體相同的來源限制」——
   * 那句話在程式上從來沒有成立過：它用的是 externalUrl，也就是
   * **任何 https 都收**。測試釘住了實作，不是釘住宣稱要做的那件事，
   * 所以那個綠燈證明的是「協定對」，不是「來源對」。
   *
   * 現在圖片只認我們自己的媒體網域（見 config/image-sources.ts）。
   * 媒體網域是部署設定，所以這裡要把它設起來——不設的話下面兩條
   * 會一起通過，而其中一條是靠「什麼都不准」通過的。
   */
  const MEDIA_HOST = "media.example.test";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL", MEDIA_HOST);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("接受自己媒體網域上的圖片", () => {
    const result = validateSiteConfig({
      ...VALID,
      brand: { ...VALID.brand, logo: `https://${MEDIA_HOST}/sites/x/y.png` },
    });
    expect(result.ok).toBe(true);
  });

  it("拒絕別人網域上的 https 圖片", () => {
    /*
     * 協定對不代表來源對。允許任意 https 的話，對方的伺服器拿得到
     * 每一位訪客的 IP 與 Referer，而用了 next/image 時去代抓那張圖的
     * 是**我們的伺服器**。
     */
    expectRejected({ ...VALID, brand: { ...VALID.brand, logo: "https://example.com/logo.png" } });
  });

  it("section 的 images 欄位同樣只認自己的網域", () => {
    const withImages = (images: string[]) => ({
      ...VALID,
      sections: [{ ...VALID.sections[0]!, content: { images } }],
    });

    expect(validateSiteConfig(withImages([`https://${MEDIA_HOST}/sites/a/b.jpg`])).ok).toBe(true);
    expect(validateSiteConfig(withImages(["https://example.com/a.jpg"])).ok).toBe(false);
  });

  it("section 內的連結同樣受限", () => {
    expectRejected({
      ...VALID,
      sections: [
        {
          ...VALID.sections[0]!,
          content: { links: [{ label: "點我", href: "javascript:alert(1)" }] },
        },
      ],
    });
  });
});

describe("結構限制", () => {
  it("section 數量有上限——失控的 tool call 不該耗盡渲染資源", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      ...VALID.sections[0]!,
      id: `section-${index}`,
    }));
    expectRejected({ ...VALID, sections: many }, "sections");
  });

  it("未知的 section type 被拒絕", () => {
    expectRejected({ ...VALID, sections: [{ ...VALID.sections[0]!, type: "arbitrary-html" }] });
  });

  it("section id 與 variant 只接受小寫英數與連字號", () => {
    expectRejected({ ...VALID, sections: [{ ...VALID.sections[0]!, id: "Hero Section!" }] });
    expectRejected({ ...VALID, sections: [{ ...VALID.sections[0]!, variant: "../etc" }] });
  });

  it("content 不接受任意巢狀物件", () => {
    expectRejected({
      ...VALID,
      sections: [{ ...VALID.sections[0]!, content: { nested: { deep: { deeper: true } } } }],
    });
  });

  it("語言代碼格式受限", () => {
    expectRejected({ ...VALID, settings: { language: "not-a-language-code" } }, "language");
    expect(validateSiteConfig({ ...VALID, settings: { language: "en" } }).ok).toBe(true);
  });
});

describe("重複的 section id", () => {
  it("找得出來——重複會讓後續的更新／刪除指向錯誤對象", () => {
    const config: SiteConfig = {
      ...VALID,
      sections: [VALID.sections[0]!, { ...VALID.sections[0]! }],
    };
    expect(findDuplicateSectionIds(config)).toEqual(["hero"]);
  });

  it("正常情況回傳空陣列", () => {
    expect(findDuplicateSectionIds(VALID)).toEqual([]);
  });
});

describe("原型污染", () => {
  it("__proto__ 之類的鍵不會污染結果物件", () => {
    const payload = JSON.parse(
      JSON.stringify({ ...VALID, sections: [{ ...VALID.sections[0]!, content: { title: "ok" } }] }),
    );
    payload.sections[0].content.__proto__ = "polluted";

    const result = validateSiteConfig(payload);
    // 無論通過與否，都不該讓 Object.prototype 被改動
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.ok || !result.ok).toBe(true);
  });
});
