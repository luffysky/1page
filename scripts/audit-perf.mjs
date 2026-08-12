import { chromium } from "@playwright/test";

/**
 * Core Web Vitals 量測（Spec §33 / Phase 8C）
 *
 * 8C 出口條件：「**真實部署環境下** LCP < 2.5s、CLS < 0.1、INP < 200ms。」
 *
 * ⚠️ 「真實部署環境」四個字是這一段的重點。
 *
 * Phase 1 量到的 LCP 356ms 是 localhost 的數字：沒有網路延遲、
 * 沒有 TLS 握手、沒有跨區域的往返、CPU 也是開發用的機器。
 * 那個數字唯一的用途是「比昨天慢了沒」，不能拿來說「使用者感受得到快」。
 *
 * 所以這支腳本吃 `--url`，預設是本機（拿來抓退步），
 * 但**驗收要用部署後的網址跑**：
 *
 *   pnpm audit:perf --url https://1page.snowrealm.pet
 *
 * 另外兩個誠實的但書：
 *   - CLS 只量到「載入後三秒內」。真實的 CLS 是整個瀏覽階段累計的
 *   - INP 需要真的互動才有值。這裡送一次點擊當作下限，
 *     真實的 INP 要看實際使用者的資料（RUM），不是實驗室量得出來的
 */

const urlIndex = process.argv.indexOf("--url");
const target = (urlIndex >= 0 ? process.argv[urlIndex + 1] : "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const throttle = process.argv.includes("--fast") ? null : { downloadKbps: 10_240, latencyMs: 40 };

const ROUTES = ["/", "/work", "/start"];

/** Spec §33 的門檻 */
const BUDGET = { lcp: 2_500, cls: 0.1, inp: 200 };

const browser = await chromium.launch();
let failures = 0;

console.log(`Core Web Vitals　→ ${target}`);
console.log(
  throttle
    ? `網路：模擬 ${throttle.downloadKbps / 1024} Mbps / ${throttle.latencyMs}ms RTT\n`
    : "網路：不節流（--fast）\n",
);

for (const route of ROUTES) {
  const context = await browser.newContext();
  const page = await context.newPage();

  if (throttle) {
    // 不節流的話量到的是「這台電腦有多快」，不是「使用者會等多久」。
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (throttle.downloadKbps * 1024) / 8,
      uploadThroughput: (throttle.downloadKbps * 1024) / 8,
      latency: throttle.latencyMs,
    });
  }

  await page.addInitScript(() => {
    // @ts-expect-error 量測用的全域
    window.__vitals = { lcp: 0, cls: 0 };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-expect-error 量測用的全域
        window.__vitals.lcp = entry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 使用者剛互動過造成的位移不算——那是他自己按出來的。
        if (!entry.hadRecentInput) {
          // @ts-expect-error 量測用的全域
          window.__vitals.cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(`${target}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3_000);

  const vitals = await page.evaluate(() => {
    // @ts-expect-error 量測用的全域
    return window.__vitals;
  });

  // INP 的下限：量一次真實互動的往返。
  const start = Date.now();
  await page.mouse.move(10, 10);
  await page.mouse.click(10, 10);
  await page.waitForTimeout(100);
  const interaction = Date.now() - start - 100;

  const lcpOk = vitals.lcp > 0 && vitals.lcp < BUDGET.lcp;
  const clsOk = vitals.cls < BUDGET.cls;
  const inpOk = interaction < BUDGET.inp;

  if (!lcpOk || !clsOk || !inpOk) failures += 1;

  console.log(`${route}`);
  console.log(`  ${lcpOk ? "✅" : "❌"} LCP  ${Math.round(vitals.lcp)}ms（< ${BUDGET.lcp}）`);
  console.log(`  ${clsOk ? "✅" : "❌"} CLS  ${vitals.cls.toFixed(4)}（< ${BUDGET.cls}）`);
  console.log(`  ${inpOk ? "✅" : "❌"} 互動 ${interaction}ms（< ${BUDGET.inp}，INP 下限）\n`);

  await context.close();
}

await browser.close();

console.log("─".repeat(56));
console.log(failures === 0 ? "全部在預算內" : `${failures} 條路由超出預算`);
console.log(
  target.includes("127.0.0.1") || target.includes("localhost")
    ? "\n⚠️  這是本機數字，偏樂觀。驗收請用部署後的網址重跑：\n    pnpm audit:perf --url https://你的網域"
    : "",
);

process.exit(failures === 0 ? 0 : 1);
