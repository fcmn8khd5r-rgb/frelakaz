/**
 * LES PHOTOGRAPHIES, RAPATRIÉES ET ÉTALONNÉES.
 *
 * Elles viennent d'une banque d'images : l'entreprise est imaginaire, elle n'a
 * pas de chantiers à photographier. Ce que ce script garantit, c'est qu'elles
 * se ressemblent — même étalonnage, même traitement — et qu'elles ne
 * transportent rien qui ne les regarde.
 *
 * AUCUNE MÉTADONNÉE N'EST ÉCRITE. Et surtout, « withMetadata() » n'est JAMAIS
 * appelé : contrairement à ce que son nom laisse croire, il ne retire rien, il
 * RÉATTACHE ce qui avait été lu à l'entrée — EXIF et position GPS compris.
 * sharp écrit sans métadonnées par défaut ; il suffit de le laisser faire.
 *
 * L'ÉTALONNAGE EST COMMUN. Quatre photographies de quatre auteurs mises côte à
 * côte se voient tout de suite comme quatre photographies de quatre auteurs.
 * Un léger gain de contraste et une saturation ramenée de 10 % les fait tenir
 * ensemble sans les dénaturer.
 */
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SORTIE = 'src/assets/photos';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const manifeste = JSON.parse(await readFile('src/data/photos.json', 'utf8'));
await mkdir(SORTIE, { recursive: true });

let total = 0;
for (const p of manifeste.items) {
  const adresse = `https://images.unsplash.com/photo-${p.unsplash}?w=${p.largeur * 2}&q=90&fm=jpg`;
  const reponse = await fetch(adresse, { headers: { 'User-Agent': UA } });
  if (!reponse.ok) {
    console.error(`  ✗ ${p.id} — ${reponse.status} sur ${adresse}`);
    process.exit(1);
  }
  const brut = Buffer.from(await reponse.arrayBuffer());

  const sortie = await sharp(brut)
    .resize({ width: p.largeur, withoutEnlargement: true })
    .modulate({ saturation: 0.9 })
    .linear(1.04, -6)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(`${SORTIE}/${p.id}.jpg`);

  total += sortie.size;
  console.log(
    `  ✓ ${p.id.padEnd(22)} ${String(sortie.width).padStart(4)}×${String(sortie.height).padEnd(4)} ` +
      `${String(Math.round(sortie.size / 1024)).padStart(4)} ko   ${p.auteur}`,
  );
}

/* CREDITS.md EST ENGENDRÉ, jamais tenu à la main : une photographie ajoutée au
   manifeste y apparaît du même geste, et aucun auteur ne peut être oublié. */
const lignes = [
  '# Crédits photographiques',
  '',
  `Toutes les photographies de ce site proviennent de **${manifeste.source}**`,
  `et sont employées selon la [${manifeste.licence}](${manifeste.licenceLien}).`,
  '',
  "Fré Lakaz est une entreprise **imaginaire** : ces images illustrent des",
  'situations du métier, elles ne montrent aucun chantier réel.',
  '',
  'Les métadonnées EXIF et les positions GPS ont été retirées au traitement.',
  "Les images sont mises à l'échelle et étalonnées de la même main —",
  'saturation ramenée de 10 %, léger gain de contraste — pour qu\'elles',
  'tiennent ensemble.',
  '',
  '| Fichier | Auteur | Page d\'origine | Sujet |',
  '| --- | --- | --- | --- |',
  ...manifeste.items.map(
    (p) => `| \`${p.id}.jpg\` | ${p.auteur} | [Unsplash](${p.page}) | ${p.sujet} |`,
  ),
  '',
  '## Images écartées, et pourquoi',
  '',
  "Trois photographies ont été écartées parce que la marque du fabricant y",
  'était lisible : Daikin, Mitsubishi et Carrier. Une chambre a été écartée',
  "parce qu'on voyait par la fenêtre un arbre nu et une moquette : un hiver",
  'tempéré, impossible en Guadeloupe.',
  '',
  "Sur `facade-trois-groupes.jpg`, les appareils portent un lettrage de marque.",
  'Mesuré à la largeur réelle des cartes du site — 560 px —, il occupe 24 px de',
  'large et 3 px de haut, et reste illisible. Cette image ne sert donc jamais en',
  "pleine largeur : la photographie d'ouverture, elle, ne porte aucune marque.",
  '',
];
await writeFile('CREDITS.md', lignes.join('\n'), 'utf8');

console.log(`  ${'—'.repeat(22)} ${(total / 1024).toFixed(0)} ko au total · CREDITS.md engendré`);
