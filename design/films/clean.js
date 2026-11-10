// node clean.js out.png page.html t  -> one frame, captions hidden, at 1.25x
const { chromium } = require('playwright');
(async () => {
  const [,, out, page, t] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await p.goto('file://' + page, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.addStyleTag({ content: '.cap,.capn{display:none!important}' });
  await p.evaluate(t => window.frame(t), +t);
  await p.screenshot({ path: out, type: 'png' });
  await b.close();
})();
