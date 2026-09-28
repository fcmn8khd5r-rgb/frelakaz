/**
 * L'ACCESSIBILITÉ, SUR L'ARBRE RÉEL.
 *
 * axe-core est chargé dans la page et tranche sur ce que le navigateur rend
 * vraiment — un validateur statique croirait que le menu d'ordinateur et le
 * tiroir de téléphone coexistent, faute de voir le CSS.
 *
 * Les BONNES PRATIQUES sont incluses, et pas seulement les règles WCAG : la
 * règle « landmark-unique » en fait partie, et c'est elle qui avait manqué le
 * jour où deux navigations portaient le même nom, menu ouvert.
 *
 * Chaque ÉTAT compte : menu replié, menu ouvert, visionneuse ouverte.
 */
import { pages } from './pages.mjs';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const exiger = createRequire(import.meta.url);
const axeSource = exiger('fs').readFileSync(exiger.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE || 'http://127.0.0.1:4488';
/* LA LISTE VIENT DE LA CONSTRUCTION, et non d'ici : recopiée, elle laisse
   toute page neuve hors de tout contrôle, et le rapport reste vert. Voir
   scripts/pages.mjs. */
const PAGES = await pages();
const REGLES = { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] };

const nav = await chromium.launch();
const violations = [];
const animations = [];
/* Les opacités intermédiaires RENCONTRÉES, pour que la ligne finale dise si
   la sonde a eu quelque chose à mesurer — « aucun texte illisible » sur un
   balayage qui n'a rien vu du tout ne veut rien dire. */
const vues = [];
let passes = 0;

async function examiner(page, nom) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate((o) => window.axe.run(document, o), REGLES);
  passes++;
  for (const v of r.violations) {
    violations.push(`${nom} — ${v.id} (${v.impact}) ×${v.nodes.length} : ${v.help}`);
  }
}

for (const largeur of [390, 1440]) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const chemin of PAGES) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await examiner(page, `${chemin} @${largeur}`);

    if (largeur === 390 && chemin === '/') {
      /* Le panneau de téléphone est un <details> : on l'ouvre comme un
         visiteur, et l'on attend que son contenu soit réellement à l'écran.
         « landmark-unique » et les doublons de libellés ne se voient QUE dans
         cet état. */
      await page.locator('[data-menu-bouton]').click();
      await page.locator('.mobile__liste a').first().waitFor({ state: 'visible' });
      await examiner(page, `/ @390 menu ouvert`);
    }
  }
  await ctx.close();
}

/* ---- L'APPARITION, EN COURS -------------------------------------------
   Les autres passes mesurent sous « animations réduites » : une page POSÉE.
   Or un visiteur traverse des états intermédiaires en défilant, et un texte
   à mi-opacité ne se lit pas. On cherche donc une position de défilement où
   un élément animé est à mi-course, et l'on y mesure le contraste.
   C'est ce contrôle qui a trouvé un bloc à 0,41 d'opacité pour 2,47 de
   contraste — sur les deux sites, et sans qu'aucune autre passe le voie. */
{
  const ctxApp = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'no-preference',
  });
  const pageApp = await ctxApp.newPage();
  for (const chemin of PAGES.filter((p) => !p.endsWith('.html'))) {
    await pageApp.goto(BASE + chemin, { waitUntil: 'networkidle' });
    const hauteur = await pageApp.evaluate(() => document.documentElement.scrollHeight);
    let trouve = false;
    for (let y = 0; y < hauteur && !trouve; y += 140) {
      await pageApp.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
      /* ON NE CHERCHE PLUS UNE CLASSE, ON CHERCHE LA PROPRIÉTÉ.

         Ce contrôle visait « .monte », le nom employé sur un autre site :
         repris ici, il ne trouvait rien et se taisait — une sonde muette qui
         se lit comme un succès. Ce qui compte n'est pas le nom de la classe,
         c'est qu'AUCUN texte ne traverse une opacité intermédiaire. On
         balaie donc le document entier, à la recherche d'un élément porteur
         de texte dont l'opacité calculée est entre 0,05 et 0,9. */
      const partielles = await pageApp.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((e) => e.textContent && e.textContent.trim().length > 3)
          .map((e) => +getComputedStyle(e).opacity)
          .filter((o) => o > 0.05 && o < 0.9));
      if (partielles.length) vues.push(partielles[0]);
      if (!partielles.length) continue;
      await pageApp.addScriptTag({ content: axeSource });
      const r = await pageApp.evaluate(() => window.axe.run(document, { runOnly: ['color-contrast'] }));
      if (r.violations.length) {
        animations.push(
          `${chemin} à y=${y} — opacité ${partielles[0].toFixed(2)} — ` +
          `${r.violations[0].nodes.length} nœud(s) sous le seuil`,
        );
        trouve = true;
      }
    }
  }
  await ctxApp.close();
}

/* ---- Le texte à 200 %, et le clavier ---------------------------------- */
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const zoomProblemes = [];
for (const chemin of PAGES) {
  for (const racine of [16, 20, 24, 32]) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: `html { font-size: ${racine}px !important; }` });
    await page.evaluate(() => document.fonts.ready);
    const d = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    if (d > 1) zoomProblemes.push(`${chemin} à ${Math.round((racine / 16) * 100)} % : ${d} px`);
  }
}

/* LA PAGE LA PLUS DENSE EN CHAMPS, et l'on VÉRIFIE qu'on y est.

   Ce contrôle visait « /reserver/ », nom employé sur un autre site : ici,
   l'adresse n'existe pas, le serveur rendait la page des adresses égarées, et
   le rapport annonçait « 21 arrêts sur la page de réservation » en ayant
   mesuré une page de quatre liens. Une mesure prise ailleurs qu'annoncé est
   pire qu'une mesure absente. */
const PAGE_CLAVIER = '/devis/';
{
  const r = await page.goto(BASE + PAGE_CLAVIER, { waitUntil: 'networkidle' });
  const code = r?.status() ?? 0;
  const champs = await page.locator('form input, form select, form textarea').count();
  if (code !== 200 || champs < 5) {
    console.error(`  ✗ clavier : ${PAGE_CLAVIER} répond ${code} et porte ${champs} champ(s) — mesure abandonnée`);
    process.exit(1);
  }
}

/* ON NE S'ARRÊTE PLUS AU PREMIER DOUBLON.
   Un « input type=date » expose TROIS sous-champs — jour, mois, année — qui
   partagent la même boîte et la même signature. Rompre à la première
   répétition annonçait six arrêts là où le clavier en fait trente-deux.
   On tabule donc jusqu'à ce que le focus quitte le document, et l'on compte
   les deux : les arrêts réels, et les éléments distincts. */
let arrets = 0;
const vus = new Set();
for (let i = 0; i < 120; i++) {
  await page.keyboard.press('Tab');
  const sig = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const b = a.getBoundingClientRect();
    return `${a.tagName}.${a.className}|${Math.round(b.top)}|${Math.round(b.left)}`;
  });
  if (!sig) break;
  vus.add(sig); arrets++;
}

await nav.close();

console.log(`axe : ${passes} passes · ${violations.length} violation(s)`);
for (const v of [...new Set(violations)].slice(0, 12)) console.log('   ·', v);
console.log(`texte agrandi : ${zoomProblemes.length ? zoomProblemes.length + ' débordement(s)' : 'aucun débordement de 100 à 200 %'}`);
for (const z of zoomProblemes.slice(0, 8)) console.log('   ·', z);
console.log(
  `apparition : ${
    animations.length
      ? `${animations.length} état(s) sous contraste`
      : vues.length
        ? `${vues.length} opacité(s) intermédiaire(s) rencontrée(s), aucune sous le seuil`
        : 'aucune opacité intermédiaire dans la page — le mouvement seul ne traverse rien d’illisible'
  }`,
);
for (const a of animations.slice(0, 6)) console.log('   ·', a);
console.log(`clavier : ${arrets} arrêts sur ${PAGE_CLAVIER}, ${vus.size} éléments distincts`);

const rate = violations.length || zoomProblemes.length || animations.length;
console.log(rate ? '\n✗ À REPRENDRE.' : '\n✓ ACCESSIBILITÉ : RIEN À SIGNALER.');
process.exit(rate ? 1 : 0);
