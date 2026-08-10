import { chromium } from "@playwright/test";
const url = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const fonts = [];
p.on("response", async (r) => {
  if (!/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) return;
  try {
    fonts.push((await r.body()).length);
  } catch {}
});
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const m = await p.evaluate(
  () =>
    new Promise((res) => {
      const out = { lcp: 0, cls: 0 };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) out.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      setTimeout(() => res(out), 500);
    }),
);
const total = fonts.reduce((a, b) => a + b, 0);
console.log(`LCP  ${m.lcp.toFixed(0)} ms   (目標 < 2500)`);
console.log(`CLS  ${m.cls.toFixed(4)}      (目標 < 0.1)`);
console.log(`字型 ${(total / 1024).toFixed(1)} KB / ${fonts.length} 個分片`);
await b.close();
