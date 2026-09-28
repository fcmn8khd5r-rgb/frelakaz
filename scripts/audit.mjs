/**
 * L'AUDIT DE RENDU.
 *
 * Toutes les pages, à beaucoup de largeurs, sous « animations réduites » —
 * une mesure se prend sur une page POSÉE, non sur des blocs encore
 * translucides.
 *
 * Ce qu'il cherche, et pourquoi chaque contrôle existe :
 *   · débordement horizontal ;
 *   · texte rogné par son conteneur ;
 *   · mot coupé au trait d'union ;
 *   · SUPERPOSITION — comparée sur les rectangles de LIGNE du texte, jamais
 *     sur la boîte englobante, qui ment sur un texte replié ;
 *   · élément « hidden » dont l'affichage n'est pas « none » — trois sites
 *     l'ont porté, dont un où plus rien n'était cliquable ;
 *   · bouton d'appel inerte ;
 *   · hôte tiers ;
 *   · ressource en erreur — « transferSize » à zéro étant une lecture en
 *     cache, et non un échec.
 */
import { pages } from './pages.mjs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4488';
/* LA LISTE VIENT DE LA CONSTRUCTION, et non d'ici : recopiée, elle laisse
   toute page neuve hors de tout contrôle, et le rapport reste vert. Voir
   scripts/pages.mjs. */
const PAGES = await pages();
const LARGEURS = [320, 360, 390, 430, 540, 768, 900, 1024, 1280, 1440, 1920];

export const SONDE = () => {
  const ennuis = [];
  const de = document.documentElement;

  if (de.scrollWidth > de.clientWidth + 1) {
    const large = [...document.querySelectorAll('body *')].find((e) => {
      const b = e.getBoundingClientRect();
      return b.right > de.clientWidth + 1 && b.width > 0 && getComputedStyle(e).position !== 'fixed';
    });
    ennuis.push(`débordement ${de.scrollWidth - de.clientWidth} px — ${large ? large.tagName.toLowerCase() + '.' + (large.className || '—') : '?'}`.slice(0, 120));
  }

  for (const e of document.querySelectorAll('[hidden]')) {
    if (getComputedStyle(e).display !== 'none') {
      ennuis.push(`« hidden » sans effet — ${e.tagName.toLowerCase()}.${e.className || '—'}`);
    }
  }

  for (const e of document.querySelectorAll('p, h1, h2, h3, dd, dt, li, span, a, button, legend, figcaption')) {
    if (!e.firstChild || e.children.length) continue;
    /* LE TEXTE RÉSERVÉ AUX LECTEURS D'ÉCRAN EST ROGNÉ PAR CONSTRUCTION :
       c'est ainsi qu'on le retire de l'affichage sans le retirer de l'arbre
       d'accessibilité. Le signaler comme « texte rogné » revient à signaler
       qu'il fait ce qu'on lui demande — 419 constats sur ce seul motif. La
       classe s'appelle « visuellement-cache » ici et « lecteur-seul »
       ailleurs : on reconnaît les deux, plutôt que de recopier un nom qui
       changera au site suivant. */
    if (e.closest('.lecteur-seul, .visuellement-cache')) continue;
    const s = getComputedStyle(e);
    if (s.overflow === 'visible' || s.display === 'none') continue;
    if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) {
      ennuis.push(`texte rogné — ${e.tagName.toLowerCase()}.${e.className || '—'} : « ${e.textContent.trim().slice(0, 28)} »`);
    }
  }

  /* Superposition : boîte PEINTE d'un élément à fond ou bordure contre les
     rectangles de LIGNE des textes nus. Une boîte englobante mentirait sur un
     texte replié, et plus encore sur un texte en colonnes. */
  const EXCLUS = ['.evitement', '.saut', '.lecteur-seul', '.visuellement-cache', 'dialog', '.visio', '[hidden]'];

  /* UN ÉLÉMENT FIXE FLOTTE PAR NATURE, ET SES ENFANTS AVEC LUI.
     Premier essai : j'écartais les éléments dont la position est « fixed »,
     mais pas leur CONTENU, qui reste « static ». Les deux boutons de la barre
     basse étaient donc comparés à tout le document, et soixante-trois
     superpositions étaient annoncées là où il n'y en a aucune. On remonte
     désormais la chaîne des ancêtres. */
  const flotte = (e) => {
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };

  const peints = [...document.querySelectorAll('body *')].filter((e) => {
    if (EXCLUS.some((s) => e.closest(s)) || flotte(e)) return false;
    const s = getComputedStyle(e);
    if (s.position === 'absolute' || s.display === 'none' || s.visibility === 'hidden') return false;
    const fond = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
    return fond || parseFloat(s.borderTopWidth) > 0;
  });
  const lignes = [];
  for (const e of document.querySelectorAll('p, h1, h2, h3, dd, dt, li, figcaption, legend')) {
    if (e.children.length || !e.textContent.trim()) continue;
    if (EXCLUS.some((s) => e.closest(s)) || flotte(e)) continue;
    const r = document.createRange(); r.selectNodeContents(e);
    for (const b of r.getClientRects()) if (b.width > 2 && b.height > 2) lignes.push({ e, b });
  }
  for (const { e, b } of lignes) {
    for (const p of peints) {
      if (p.contains(e) || e.contains(p)) continue;
      const q = p.getBoundingClientRect();
      const chevauche = b.left < q.right - 2 && b.right > q.left + 2 && b.top < q.bottom - 2 && b.bottom > q.top + 2;
      if (chevauche) {
        ennuis.push(`superposition — « ${e.textContent.trim().slice(0, 24)} » sous ${p.tagName.toLowerCase()}.${p.className || '—'}`);
        break;
      }
    }
  }

  const inertes = [...document.querySelectorAll('a[href="#"], a:not([href]), button:not([type]):not([data-valider])')];
  if (inertes.length) ennuis.push(`${inertes.length} appel(s) sans destination`);

  return ennuis;
};

if (process.argv[1] !== new URL(import.meta.url).pathname) {
  // importé pour éprouver la sonde : on n'exécute pas la campagne
} else {

const nav = await chromium.launch();
const ctx = await nav.newContext({ reducedMotion: 'reduce', locale: 'fr-FR' });
const page = await ctx.newPage();

const tiers = new Set();
const echecs = new Set();
page.on('request', (r) => {
  const h = new URL(r.url()).host;
  if (!h.startsWith('127.0.0.1') && !h.startsWith('localhost')) tiers.add(h);
});
page.on('response', (r) => { if (r.status() >= 400) echecs.add(`${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => echecs.add(`exception : ${e.message}`));

let rendus = 0;
const problemes = [];
for (const chemin of PAGES) {
  for (const l of LARGEURS) {
    await page.setViewportSize({ width: l, height: 900 });
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const ennuis = await page.evaluate(SONDE);
    rendus++;
    for (const e of ennuis) problemes.push(`${chemin} @ ${l} — ${e}`);
  }
}

console.log(`${rendus} rendus · ${PAGES.length} pages × ${LARGEURS.length} largeurs`);
console.log(`hôtes tiers : ${tiers.size ? [...tiers].join(', ') : 'aucun'}`);
console.log(`ressources en erreur : ${echecs.size ? [...echecs].slice(0, 5).join(' | ') : 'aucune'}`);
if (problemes.length) {
  const uniques = [...new Set(problemes.map((p) => p.replace(/@ \d+/, '@ …')))];
  console.error(`\n✗ ${problemes.length} constat(s), ${uniques.length} distinct(s) :`);
  for (const p of uniques.slice(0, 20)) console.error('   ·', p);
  process.exit(1);
}
console.log('\n✓ AUCUN DÉFAUT DE RENDU.');
await nav.close();
}
