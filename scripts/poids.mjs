import { chromium } from 'playwright';
const nav = await chromium.launch();
for (const [nom, l, h, dpr] of [['téléphone', 390, 844, 3], ['ordinateur', 1440, 900, 2]]) {
  const ctx = await nav.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const recu = [];
  page.on('response', async (r) => {
    try { const b = (await r.body()).length; recu.push({ url: r.url(), o: b, type: r.request().resourceType() }); } catch {}
  });
  await page.goto('http://127.0.0.1:4488/', { waitUntil: 'networkidle' });
  const total = recu.reduce((s, r) => s + r.o, 0);
  console.log(`\n── ${nom} ${l}×${h} ×${dpr} · ${recu.length} requêtes · ${Math.round(total / 1024)} Ko`);
  for (const r of recu.sort((a, b) => b.o - a.o).slice(0, 6)) {
    console.log(`   ${String(Math.round(r.o / 1024)).padStart(5)} Ko  ${r.type.padEnd(10)} ${r.url.replace(/.*\//, '').slice(0, 54)}`);
  }
  await ctx.close();
}
await nav.close();
