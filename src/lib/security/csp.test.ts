import { describe, expect, it } from "vitest";

import { buildCsp, SECURITY_HEADERS } from "./csp";

/**
 * CSP（Spec §36）
 *
 * 一份設錯的 CSP 有兩種失敗方式，而且兩種都不會讓建置紅：
 *   1. 太鬆——看起來有設，實際上什麼都沒擋
 *   2. 太緊——把自己的 Supabase 或圖片擋掉，畫面壞掉
 *
 * 所以兩個方向都測。
 */

const ENV = {
  supabaseUrl: "https://1page-db.example.app",
  r2DomainUrl: "https://media.example.pet",
  r2PublicUrl: "https://pub-abc.r2.dev",
  analyticsEndpoint: "https://metrics.example.app/collect",
};

/** 取出某個 directive 的來源清單 */
const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe("擋得住的東西", () => {
  const csp = buildCsp(ENV, false);

  it("只准嵌入白名單裡的那兩個提供者", () => {
    /*
     * 這是加這份 CSP 的主要理由。buildEmbed 已經只組得出這兩個主機，
     * 這條是第二層——萬一哪天有人繞過它，瀏覽器還會擋一次。
     */
    expect(directive(csp, "frame-src")).toBe(
      "https://www.youtube-nocookie.com https://www.google.com",
    );
  });

  it("關掉 object / base / 內嵌他人頁面 / 表單外送", () => {
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "form-action")).toBe("'self'");
  });

  it("正式環境不給 unsafe-eval", () => {
    expect(directive(csp, "script-src")).not.toContain("unsafe-eval");
  });

  it("開發環境才給 unsafe-eval，而且不加 upgrade-insecure-requests", () => {
    // 開發是 http://127.0.0.1，升級成 https 會讓整個頁面載不起來
    const dev = buildCsp(ENV, true);

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("不能擋到自己", () => {
  const csp = buildCsp(ENV, false);

  it("瀏覽器連得到 Supabase 與分析端點", () => {
    // 這條寫錯的話，登入與後台會整個壞掉，而且只在瀏覽器 console 裡抱怨
    const connect = directive(csp, "connect-src");

    expect(connect).toContain("'self'");
    expect(connect).toContain("https://1page-db.example.app");
    expect(connect).toContain("https://metrics.example.app");
  });

  it("圖片載得到 R2 的兩個網域", () => {
    // 自訂網域是新上傳用的，r2.dev 是既有記錄用的，兩個都還在服役
    const img = directive(csp, "img-src");

    expect(img).toContain("https://media.example.pet");
    expect(img).toContain("https://pub-abc.r2.dev");
  });

  it("inline style 仍然允許——主題系統靠它運作", () => {
    /*
     * SiteScope 用 inline style 注入 --site-*，而 nonce 對 style="" 屬性無效。
     * 這一條要是被「加強安全性」改成 nonce，所有主題會直接失效，
     * 而畫面上只會看起來「怪怪的」——顏色與字型全部退回官網的。
     */
    expect(directive(csp, "style-src")).toContain("'unsafe-inline'");
  });
});

describe("環境變數沒設也不會產生壞的 CSP", () => {
  it("空的環境變數不會留下空白或殘缺的來源", () => {
    /*
     * CSP 的來源設錯，瀏覽器會讓**整條 directive 失效**，而且只在 console
     * 抱怨一句。所以取不出 origin 的就要濾掉，不能原樣塞進去。
     */
    const csp = buildCsp({}, false);

    expect(directive(csp, "connect-src")).toBe("'self'");
    expect(csp).not.toMatch(/;\s*;/);
    expect(csp).not.toMatch(/\s{2,}/);
    expect(csp).not.toContain("undefined");
  });

  it("網址含路徑時只取 origin", () => {
    // 分析端點是一個含路徑的網址，但 CSP 的來源不接受路徑
    const csp = buildCsp({ analyticsEndpoint: "https://metrics.example.app/collect" }, false);

    expect(directive(csp, "connect-src")).toBe("'self' https://metrics.example.app");
  });

  it("壞掉的網址被丟掉，而不是變成一個壞來源", () => {
    const csp = buildCsp({ supabaseUrl: "不是網址", analyticsEndpoint: "   " }, false);

    expect(directive(csp, "connect-src")).toBe("'self'");
  });
});

describe("其他安全標頭", () => {
  it("該有的都在", () => {
    const keys = SECURITY_HEADERS.map((header) => header.key);

    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
  });

  it("沒有空值", () => {
    for (const header of SECURITY_HEADERS) {
      expect(header.value.length, `${header.key} 是空的`).toBeGreaterThan(0);
    }
  });
});
