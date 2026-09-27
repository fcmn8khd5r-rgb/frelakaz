/**
 * Captures pour jugement visuel. Sous « animations réduites » : une mesure —
 * et une capture — se prend sur une page POSÉE, non sur des blocs encore
 * translucides.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://127.0.0.1:4477';
const SORTIE = process.argv[2];
await mkdir(SORTIE, { recursive: true });

const PAGES = [
  ['accueil', '/'],
  ['flotte', '/flotte/'],
  ['reserver', '/reserver/'],
];
const ECRANS = [
  ['telephone', 390, 844, 3],
  ['ordinateur', 1440, 900, 2],
];

const nav = await chromium.launch({ args: ['--lang=fr-FR'] });
for (const [nomEcran, l, h, echelle] of ECRANS) {
  const ctx = await nav.newContext({
    viewport: { width: l, height: h },
    deviceScaleFactor: echelle,
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  const journal = [];
  page.on('console', (m) => m.type() === 'error' && journal.push(m.text()));
  page.on('requestfailed', (r) => journal.push(`échec ${r.url()}`));

  for (const [nom, chemin] of PAGES) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SORTIE}/${nom}-${nomEcran}.jpg`, type: 'jpeg', quality: 90 });

    const m = await page.evaluate(() => ({
      deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hauteur: document.documentElement.scrollHeight,
      cachesVisibles: [...document.querySelectorAll('[hidden]')]
        .filter((e) => getComputedStyle(e).display !== 'none').length,
    }));
    console.log(`  ${nomEcran.padEnd(11)} ${nom.padEnd(9)} débordement ${m.deborde} px · hauteur ${m.hauteur} · [hidden] visibles ${m.cachesVisibles}`);
  }
  if (journal.length) console.log(`  ⚠ ${nomEcran} : ${[...new Set(journal)].slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await nav.close();
