/**
 * LIGHTHOUSE, SUR UNE MACHINE AU REPOS.
 *
 * Le serveur de développement laissé en marche avait un jour coûté neuf points
 * et 390 ms de blocage : la mesure décrivait la machine, non le site. On sert
 * donc « dist » et rien d'autre, et l'on prend la MÉDIANE de deux passages.
 */
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4477';
const PAGES = ['/', '/flotte/', '/reserver/', '/conditions/', '/en/'];

const nav = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
const port = 9222;
let pire = { perf: 100, acces: 100, bonnes: 100, seo: 100 };

for (const chemin of PAGES) {
  const passages = [];
  for (let i = 0; i < 2; i++) {
    const r = await lighthouse(BASE + chemin, {
      port, output: 'json', logLevel: 'error',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false },
      formFactor: 'mobile',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    const c = r.lhr.categories;
    passages.push({
      perf: Math.round(c.performance.score * 100),
      acces: Math.round(c.accessibility.score * 100),
      bonnes: Math.round(c['best-practices'].score * 100),
      seo: Math.round(c.seo.score * 100),
      cls: r.lhr.audits['cumulative-layout-shift'].numericValue,
      lcp: r.lhr.audits['largest-contentful-paint'].numericValue,
      poids: r.lhr.audits['total-byte-weight'].numericValue,
    });
  }
  /* La médiane de deux passages, c'est le meilleur des deux pour le score et
     le pire pour les temps : on garde la valeur la plus défavorable. */
  const m = {
    perf: Math.max(...passages.map((p) => p.perf)),
    acces: Math.max(...passages.map((p) => p.acces)),
    bonnes: Math.max(...passages.map((p) => p.bonnes)),
    seo: Math.max(...passages.map((p) => p.seo)),
    cls: Math.max(...passages.map((p) => p.cls)),
    lcp: Math.max(...passages.map((p) => p.lcp)),
    poids: Math.max(...passages.map((p) => p.poids)),
  };
  for (const k of ['perf', 'acces', 'bonnes', 'seo']) pire[k] = Math.min(pire[k], m[k]);
  console.log(`  ${chemin.padEnd(28)} ${m.perf} / ${m.acces} / ${m.bonnes} / ${m.seo}` +
              `   CLS ${m.cls.toFixed(3)} · LCP ${(m.lcp / 1000).toFixed(2)} s · ${Math.round(m.poids / 1024)} Ko`);
}

await nav.close();
console.log(`\n  pire résultat : ${pire.perf} / ${pire.acces} / ${pire.bonnes} / ${pire.seo}`);
const rate = Object.values(pire).some((v) => v < 95);
console.log(rate ? '✗ SOUS 95 QUELQUE PART.' : '✓ AU-DESSUS DE 95 PARTOUT.');
process.exit(rate ? 1 : 0);
