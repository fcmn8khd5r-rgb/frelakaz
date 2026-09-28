/**
 * LA LISTE DES PAGES, LUE SUR LA CONSTRUCTION.
 *
 * Elle était recopiée dans cinq scripts. Quatre pages de métier sont arrivées
 * d'un coup : sans ce module, elles auraient été absentes de l'audit, du
 * contrôle d'accessibilité, du contrôle des extrêmes, de celui des moteurs et
 * du parcours des liens — cinq vérifications qui auraient rendu un rapport
 * vert sur des pages qu'elles n'ouvraient pas. C'est la pire forme de
 * vérification : celle qui rassure sans mesurer.
 *
 * Elle se lit donc sur « dist », qui est ce que l'hébergeur servira. Une page
 * ajoutée y entre du seul fait d'exister.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

async function fichiers(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await fichiers(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/**
 * Les adresses de toutes les pages construites, l'accueil en tête.
 *
 * « 404.html » EN FAIT PARTIE : c'est une page servie aux visiteurs comme les
 * autres, et souvent la première qu'ils voient quand un lien ancien circule
 * encore.
 */
export async function pages() {
  const liste = (await fichiers(DIST)).map(
    (f) =>
      '/' +
      f
        .slice(DIST.length + 1)
        .replace(/index\.html$/, '')
        .replace(/^\/+/, ''),
  );
  if (!liste.length) {
    throw new Error('Aucune page dans « dist » — lancez « npm run build » d’abord.');
  }
  /* L'accueil d'abord, puis l'ordre alphabétique : un rapport se relit mieux
     quand la page principale ouvre la liste. */
  return [...new Set(liste)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/**
 * Les pages qu'un visiteur atteint par un lien, sans la page des adresses
 * égarées ni les deux confirmations : elles n'ont pas de lien entrant, et un
 * parcours de liens qui les exigerait signalerait un défaut inexistant.
 */
const SANS_LIEN = ['/404.html', '/devis/merci/', '/rendez-vous/merci/'];
export async function pagesLiees() {
  return (await pages()).filter((p) => !SANS_LIEN.includes(p));
}
