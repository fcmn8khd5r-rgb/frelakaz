/**
 * LA SONDE, ÉPROUVÉE DANS LES DEUX SENS.
 *
 * On casse la page exprès — quatre défauts, un par famille — et l'on vérifie
 * que chacun est bien signalé. Sans cela, « aucun défaut » ne veut rien dire.
 */
import { chromium } from 'playwright';
import { SONDE } from './audit.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4488';

/* Chaque défaut est injecté sur une page qui S'Y PRÊTE, et SUR UN SÉLECTEUR
   QUI EXISTE ICI.
   
   C'est le piège de cette famille de scripts : repris d'un site à l'autre, ils
   continuent d'injecter sur des classes disparues. L'injection ne casse alors
   rien, la sonde ne voit rien, et l'on croit tenir une sonde aveugle alors
   qu'on tient une injection morte. Le contrôle plus bas vérifie donc d'abord
   que le sélecteur visé existe RÉELLEMENT dans la page. */
const CAS = [
  ['aucun défaut', '/', null, '', 0],
  ['aucun défaut (devis)', '/devis/', null, '', 0],
  /* « min-width » et non « width » : l'enveloppe porte un « max-width », qui
     annulait la largeur injectée — l'injection ne débordait donc de rien. */
  ['débordement', '/', '.enveloppe', '.enveloppe { min-width: 140vw; }', 1],
  ['texte rogné', '/', '.ouverture__lead',
   '.ouverture__lead { height: 12px; overflow: hidden; display: block; }', 1],
  ['superposition', '/', '#prestations',
   '#prestations { position: relative; margin-top: -320px; }', 1],
  /* AUCUN ÉLÉMENT DU SITE NE PORTE L'ATTRIBUT « hidden » : il n'y avait donc
     rien à casser, et la sonde avait raison de se taire. On en pose un, puis
     on lui retire son effet — c'est bien la sonde qu'on éprouve, et non la
     présence fortuite d'un attribut. */
  ['« hidden » sans effet', '/', 'main',
   '[hidden] { display: block !important; }', 1,
   () => {
     const p = document.createElement('p');
     p.hidden = true;
     p.textContent = 'Bloc masqué pour éprouver la sonde';
     document.querySelector('main')?.prepend(p);
   }],
];

const nav = await chromium.launch();
const ctx = await nav.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let tout = true;

for (const [nom, chemin, cible, casse, attendu, preparer] of CAS) {
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  /* L'INJECTION EST VÉRIFIÉE AVANT D'ÊTRE CRUE. Un sélecteur qui ne
     correspond à rien casse zéro chose, et la sonde a raison de ne rien
     signaler : c'est l'épreuve qui est fausse, pas la sonde. */
  if (cible) {
    const combien = await page.evaluate((s) => document.querySelectorAll(s).length, cible);
    if (!combien) {
      console.log(`  ✗ ${nom.padEnd(24)} le sélecteur « ${cible} » ne correspond à rien sur ${chemin}`);
      tout = false;
      continue;
    }
  }

  if (preparer) await page.evaluate(preparer);
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
