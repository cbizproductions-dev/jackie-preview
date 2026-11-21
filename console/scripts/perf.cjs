// First paint on a throttled "Fast 4G" profile (CDP network emulation + 4x CPU slowdown), cached snapshot.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const c = await p.context().newCDPSession(p);
  await c.send('Network.enable');
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await p.goto(process.argv[2]);
  await p.waitForSelector('.meter .val');
  const meters = Date.now() - t0;
  const fcp = await p.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime);
  console.log(JSON.stringify({ firstContentfulPaintMs: Math.round(fcp), metersVisibleMs: meters }));
  await b.close();
})();
