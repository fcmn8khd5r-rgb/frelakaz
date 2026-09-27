/**
 * LES ICÔNES ET L'IMAGE DE PARTAGE, TIRÉES DU MÊME DESSIN.
 *
 * favicon.ico manquait sur trois sites : les navigateurs qui ignorent le SVG à
 * cet endroit n'avaient aucune icône, et la requête répondait 404. Il est ici
 * engendré depuis le vectoriel, comme l'icône d'écran d'accueil.
 *
 * L'image de partage est ABSOLUE dans les balises — un chemin relatif est
 * refusé par Open Graph, et le partage sort alors sans vignette.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(RACINE, 'public');
const svg = await readFile(path.join(PUBLIC, 'favicon.svg'));

/* --- L'icône d'écran d'accueil ----------------------------------------- */
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

/* --- favicon.ico : deux tailles dans un conteneur écrit à la main ------- */
const tailles = [16, 32];
const images = await Promise.all(
  tailles.map((t) => sharp(svg, { density: 384 }).resize(t, t).png({ compressionLevel: 9 }).toBuffer()),
);
const entete = Buffer.alloc(6);
entete.writeUInt16LE(0, 0); entete.writeUInt16LE(1, 2); entete.writeUInt16LE(tailles.length, 4);
let decalage = 6 + 16 * tailles.length;
const entrees = images.map((buf, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(tailles[i] === 256 ? 0 : tailles[i], 0);
  e.writeUInt8(tailles[i] === 256 ? 0 : tailles[i], 1);
  e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(decalage, 12);
  decalage += buf.length;
  return e;
});
await writeFile(path.join(PUBLIC, 'favicon.ico'), Buffer.concat([entete, ...entrees, ...images]));

/* --- L'image de partage, 1200 × 630 ------------------------------------ */
const photo = path.join(RACINE, 'src/assets/photos/ouverture.jpg');
const marque = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="v" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0%" stop-color="#14222a" stop-opacity="0.90"/>
    <stop offset="52%" stop-color="#14222a" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#14222a" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="180" width="1200" height="450" fill="url(#v)"/>
  <text x="80" y="432" font-family="Helvetica Neue, Helvetica, Arial" font-size="24"
        letter-spacing="7" fill="#3d9bb8">DÉMONSTRATION · STUDIO MATHYS</text>
  <text x="80" y="520" font-family="Helvetica Neue, Helvetica, Arial" font-size="76"
        font-weight="600" fill="#ffffff">Fré Lakaz</text>
  <text x="80" y="566" font-family="Helvetica Neue, Helvetica, Arial" font-size="26"
        fill="#d3e5ec">Climatisation en Guadeloupe · installation, entretien, dépannage</text>
</svg>`);
await sharp(photo)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .composite([{ input: marque, top: 0, left: 0 }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(PUBLIC, 'partage.jpg'));

const { size } = await import('node:fs').then((m) => m.promises.stat(path.join(PUBLIC, 'partage.jpg')));
console.log('  apple-touch-icon.png  180×180');
console.log(`  favicon.ico           ${tailles.join(' et ')} px`);
console.log(`  partage.jpg           1200×630 · ${Math.round(size / 1024)} Ko`);
