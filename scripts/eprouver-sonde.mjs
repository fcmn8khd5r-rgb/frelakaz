/**
 * LA SONDE, ÉPROUVÉE DANS LES DEUX SENS.
 *
 * On casse la page exprès — quatre défauts, un par famille — et l'on vérifie
 * que chacun est bien signalé. Sans cela, « aucun défaut » ne veut rien dire.
 */
import { chromium } from 'playwright';
import { SONDE } from './audit.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4477';

/* Chaque défaut est injecté sur une page qui S'Y PRÊTE : « hidden » demande
   une page qui en porte un, la superposition demande deux blocs voisins.
   Injecter au hasard revient à éprouver l'injection, non la sonde. */
const CAS = [
  ['aucun défaut', '/flotte/', '', 0],
  ['aucun défaut (réserver)', '/reserver/', '', 0],
  ['débordement', '/flotte/', '.coque { width: 140vw; }', 1],
  ['« hidden » sans effet', '/reserver/', '.recap__reponse[hidden] { display: block; }', 1],
  ['texte rogné', '/flotte/', '.bande__titre { height: 12px; overflow: hidden; display: block; }', 1],
  ['superposition', '/', '.section--surface { position: relative; margin-top: -320px; }', 1],
];

const nav = await chromium.launch();
const ctx = await nav.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let tout = true;

for (const [nom, chemin, casse, attendu] of CAS) {
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (casse) await page.addStyleTag({ content: casse });
  await page.waitForTimeout(120);
  const ennuis = await page.evaluate(new Function(`return (${SONDE})()`));
  const bon = attendu === 0 ? ennuis.length === 0 : ennuis.length > 0;
  tout &&= bon;
  console.log(`  ${bon ? '✓' : '✗'} ${nom.padEnd(24)} ${ennuis.length} constat(s)` +
              (ennuis.length ? ` — ${ennuis[0].slice(0, 62)}` : ''));
}
await nav.close();
console.log(tout ? '\n✓ LA SONDE VOIT CE QU\'ELLE DOIT VOIR, ET RIEN DE PLUS.' : '\n✗ SONDE À REPRENDRE.');
process.exit(tout ? 0 : 1);
