// node stills.js <page.html> <out.png> t1,t2,...  -> contact sheet (2 cols) of frames at those times
const { chromium } = require('playwright');
(async () => {
  const [,, page, out, times, W = 1600, H = 900] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W, height: +H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const ts = times.split(',').map(Number); const shots = [];
  for (const t of ts) { await p.evaluate(t => window.frame(t), t); shots.push((await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64')); }
  const cols = 2, w = +W / 2, h = +H / 2;
  const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:#000">${shots.map((s, i) => `<div style="position:relative"><img src="data:image/jpeg;base64,${s}" style="width:${w}px;height:${h}px;display:block"><b style="position:absolute;left:6px;top:4px;color:red;font:20px sans-serif">${ts[i]}</b></div>`).join('')}</body>`;
  const q = await b.newPage({ viewport: { width: cols * w, height: Math.ceil(ts.length / cols) * h } });
  await q.setContent(html); await q.screenshot({ path: out, fullPage: true });
  if (errs.length) console.log('ERR', errs.slice(0, 3));
  await b.close();
})();
