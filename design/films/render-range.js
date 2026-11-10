// node render-range.js <page.html> <outDir> <fromSec> <toSec>  -> re-renders only that span of frames at 30fps
const { chromium } = require('playwright');
(async () => {
  const [,, page, out, a, z] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const i0 = Math.round(+a * 30), i1 = Math.round(+z * 30);
  for (let i = i0; i < i1; i++) {
    await p.evaluate(t => window.frame(t), i / 30);
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 4)));
  console.log('frames', i0, i1);
  await b.close();
})();
