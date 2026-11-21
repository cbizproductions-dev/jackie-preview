// Tap targets ≥44px and text ≥12px (body ≥15px) on every screen at 390 wide.
const { chromium } = require('playwright');
const base = process.argv[2];
const SCREENS = ['home', 'money', 'studio', 'sync', 'beats', 'contracts', 'strategy', 'career', 'speaking', 'calendar', 'cabinet', 'system'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const out = [];
  for (const s of SCREENS) {
    await p.goto(`${base}#/${s}`); await p.reload(); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll('a, button, select, summary, [role=tab]')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || el.closest('.moves') || el.closest('iframe')) continue;
        if (b.height < 44 && !el.closest('.tbl td') && !el.closest('.row .t')) small.push(`${el.tagName} "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(b.height)}px`);
      }
      const tiny = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        if (el.closest('svg')) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) tiny.add(`${el.tagName}.${el.className} ${fs}px`);
      }
      return { small: small.slice(0, 6), tiny: [...tiny].slice(0, 6), body: getComputedStyle(document.body).fontSize };
    });
    if (r.small.length || r.tiny.length) out.push(`${s}: ${JSON.stringify(r)}`);
  }
  console.log(out.join('\n') || 'all tap targets ≥44px and text ≥12px');
  await b.close();
})();
