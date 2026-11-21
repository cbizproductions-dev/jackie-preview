// Playwright screenshots of every screen. Usage: node scripts/shots.cjs <baseUrl> <outDir> [screens...]
const { chromium } = require('playwright');
const base = process.argv[2], out = process.argv[3];
const only = process.argv.slice(4);
const SCREENS = ['home', 'money', 'studio', 'sync', 'beats', 'contracts', 'strategy', 'career', 'speaking', 'calendar', 'cabinet', 'system'];
const SIZES = [[390, 844], [430, 932], [1440, 900]];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, h] of SIZES) for (const embed of [false, true]) {
    if (embed && w === 430) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${w} ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`${w} console: ${m.text()}`));
    for (const s of only.length ? only : SCREENS) {
      const url = `${base}#/${s}`;
      if (embed) await p.setContent(`<html><body style="margin:0;background:#191919"><iframe src="${url}" style="border:0;width:100%;height:${Math.min(h, 650)}px"></iframe></body></html>`);
      else { await p.goto(url); await p.reload(); }
      await p.waitForTimeout(900);
      const f = embed ? p.frames()[1] : p;
      const overflow = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) errors.push(`${w}${embed ? ' embed' : ''} ${s}: horizontal overflow ${overflow}px`);
      await p.screenshot({ path: `${out}/${s}-${w}${embed ? '-embed' : ''}.png`, fullPage: !embed });
    }
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no errors');
})();
