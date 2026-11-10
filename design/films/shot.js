const { chromium } = require('playwright');
(async () => { const [,, page, out, W, H] = process.argv; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +W, height: +H } });
 await p.goto('file://' + page, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); await p.screenshot({ path: out }); await b.close(); })();
