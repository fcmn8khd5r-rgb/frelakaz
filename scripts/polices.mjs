/**
 * LES POLICES, RAPATRIÉES SUR LE SITE.
 *
 * Aucune requête ne sort du document à l'exécution : ni Google Fonts, ni CDN.
 * Un tiers de moins à résoudre avant le premier texte, et rien à déclarer
 * côté vie privée.
 *
 * LE CHOIX. IBM Plex Sans pour tout ce qui se lit, IBM Plex Mono pour tout ce
 * qui se compte — puissances en kilowatts, prix, créneaux horaires, délais.
 * Ce sont deux membres de la MÊME superfamille, dessinés ensemble : leurs
 * hauteurs d'x et leurs graisses s'accordent, ce que deux familles étrangères
 * ne feraient pas. Le monospace n'est pas un ornement : il aligne les chiffres
 * en colonne dans la grille des créneaux et dans le tableau des prestations,
 * là où un chasse-variable les ferait danser d'une ligne à l'autre.
 *
 * On ne prend QUE les graisses employées : 400 et 600 pour le texte, 400 et
 * 500 pour les chiffres. Le sous-ensemble « latin » suffit au français — il
 * couvre les accents, œ, les guillemets et le signe €.
 */
import { writeFile } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const FAMILLES = [
  { css: 'IBM+Plex+Sans:wght@400', fichier: 'plex-400' },
  { css: 'IBM+Plex+Sans:wght@600', fichier: 'plex-600' },
  { css: 'IBM+Plex+Mono:wght@400', fichier: 'plex-mono-400' },
  { css: 'IBM+Plex+Mono:wght@500', fichier: 'plex-mono-500' },
];

let total = 0;

for (const f of FAMILLES) {
  const adresse = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
  const css = await (await fetch(adresse, { headers: { 'User-Agent': UA } })).text();

  let pose = false;
  for (const bloc of css.split('@font-face').slice(1)) {
    /* Une feuille découpée par sous-ensembles annonce ses plages par blocs :
       on ne garde que « latin ». */
    if (!/unicode-range:[^;]*U\+0000-00FF/.test(bloc)) continue;
    const src = bloc.match(/url\((https:[^)]+)\)\s*format\('woff2'\)/)?.[1];
    if (!src) continue;
    const nom = `${f.fichier}.woff2`;
    const bin = Buffer.from(await (await fetch(src)).arrayBuffer());
    await writeFile(`public/polices/${nom}`, bin);
    total += bin.length;
    pose = true;
    console.log(`  ${nom.padEnd(22)} ${(bin.length / 1024).toFixed(1)} ko`);
  }
  /* UNE POLICE MANQUANTE ARRÊTE LE SCRIPT. Sans cela, la page retomberait sur
     la pile système et personne ne le verrait avant la mise en ligne. */
  if (!pose) {
    console.error(`  ✗ aucun sous-ensemble latin trouvé pour « ${f.css} »`);
    process.exit(1);
  }
}

console.log(`  ${'—'.repeat(22)} ${(total / 1024).toFixed(1)} ko au total`);
