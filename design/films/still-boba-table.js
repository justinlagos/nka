// Whole cafe photo with the story in place, 1800x1350.
const { chromium } = require('playwright');
(async () => {
  const [,, page, out] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.125 });
  await p.goto('file://' + page, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.addStyleTag({ content: 'body{height:1200px!important}.cap,.capn{display:none!important}' });
  await p.evaluate(() => { window.frame(11.8); document.querySelectorAll('.layer').forEach(l => l.style.opacity = l.id === 'S4' ? 1 : 0);
    document.getElementById('P4').style.transform = `scale(${1600 / 2368})`; });
  await p.screenshot({ path: out });
  await b.close();
})();
