// node render.js <page.html> <outDir> <seconds> [w h fps]
// The page exposes window.frame(t) which lays out the scene for time t (seconds).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, page, out, secs, W = 1600, H = 900, FPS = 30] = process.argv;
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const n = Math.round(+secs * +FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => window.frame(t), i / +FPS);
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 4)));
  console.log('frames', n);
  await b.close();
})();
