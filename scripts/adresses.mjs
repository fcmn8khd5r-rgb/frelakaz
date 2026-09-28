/**
 * TOUTE ADRESSE CITÉE DOIT RÉPONDRE.
 *
 * Les liens internes sont déjà contrôlés par « meta » : ils pointent tous vers
 * une page et une ancre qui existent. Les liens SORTANTS, eux, ne dépendent
 * pas de nous — et ce sont les plus coûteux quand ils tombent :
 *   · une démonstration hors ligne fait passer le portfolio pour abandonné ;
 *   · une page d'aide publique déplacée fait citer un dispositif introuvable,
 *     ce qui est pire que de ne rien citer ;
 *   · une adresse d'hébergeur périmée dans les mentions légales est une
 *     mention légale fausse.
 *
 * Le cas s'est produit : l'adresse du Chèque TIC relevée dans une recherche
 * répondait 404 dans un vrai navigateur, et une capture a longtemps montré une
 * démonstration qui ne répondait plus.
 *
 * ON DEMANDE LA PAGE ENTIÈRE, ET NON SES SEULS EN-TÊTES : plusieurs serveurs
 * refusent une requête HEAD qu'ils honorent en GET. Et on se présente avec
 * l'identité d'un navigateur : un filtre anti-robot renvoie 403 à un outil qui
 * s'annonce comme tel, ce qui donnerait une alerte sur une page parfaitement
 * en ligne.
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const data = JSON.parse(await readFile('src/data/contenu.json', 'utf8'));

const NAVIGATEUR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const DELAI = 25_000;
/** Quatre à la fois : assez pour que ce soit court, assez peu pour rester poli. */
const FRONT = 4;

const trouver = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await trouver(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

const fichiers = await trouver(DIST);
if (!fichiers.length) {
  console.error('  Aucune page dans « dist » — lancez « npm run build » d’abord.');
  process.exit(1);
}

/* Où chaque adresse est citée : un rapport qui donne l'adresse sans dire où
   elle se trouve oblige à la chercher dans dix fichiers. */
const citations = new Map();
const cite = (url, page) => {
  const nettoyee = url.replace(/[),.;]+$/, '');
  if (!citations.has(nettoyee)) citations.set(nettoyee, new Set());
  citations.get(nettoyee).add(page);
};

for (const f of fichiers) {
  const html = await readFile(f, 'utf8');
  const page =
    '/' +
    f
      .slice(DIST.length + 1)
      .replace(/index\.html$/, '')
      .replace(/^\/+/, '');
  for (const m of html.matchAll(/(?:href|src|content)="(https?:\/\/[^"]+)"/g)) cite(m[1], page);
  /* Les données structurées citent des adresses hors de tout attribut. */
  for (const bloc of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    for (const m of bloc[1].matchAll(/"(https?:\/\/[^"]+)"/g)) cite(m[1], page);
  }
}

/* L'adresse du site elle-même : elle n'apparaît que dans ses propres balises
   canoniques, et on veut savoir si le domaine répond encore. */
cite(data.site.url, 'contenu.json');

/* « schema.org » n'est pas un lien mais un espace de noms : il n'a jamais
   vocation à être ouvert, et le vocabulaire reste valable même si le site est
   momentanément indisponible. */
const EXCLUES = /^https?:\/\/schema\.org/;

const toutes = [...citations.keys()].filter((u) => !EXCLUES.test(u)).sort();

/* LES ADRESSES DU SITE LUI-MÊME SE VÉRIFIENT SUR LA CONSTRUCTION, et non sur
   le domaine en production.

   Elles y étaient interrogées, et les quatre pages de métier revenaient 404 :
   elles existaient dans « dist » mais le domaine servait encore la version
   d'avant. L'alerte était donc garantie à chaque page nouvelle, jusqu'au
   déploiement — une alerte qui se déclenche toujours cesse d'être lue. Ce
   qu'on veut savoir ici, c'est qu'une adresse canonique désigne une page que
   l'on publie RÉELLEMENT. */
const RACINE = data.site.url.replace(/\/$/, '');
const miennes = toutes.filter((u) => u.startsWith(RACINE + '/') || u === RACINE);
const adresses = toutes.filter((u) => !miennes.includes(u));

console.log(`  ${toutes.length} adresses citées, sur ${fichiers.length} pages`);
console.log(`  dont ${miennes.length} sur ce site — vérifiées dans « ${DIST} »\n`);

const manquantes = [];
for (const u of miennes) {
  const chemin = new URL(u).pathname;
  const candidats = chemin.endsWith('/')
    ? [join(DIST, chemin, 'index.html')]
    : [join(DIST, chemin), join(DIST, chemin, 'index.html')];
  let trouve = false;
  for (const c of candidats) {
    try {
      await access(c);
      trouve = true;
      break;
    } catch {}
  }
  if (!trouve) manquantes.push(u);
}
for (const u of manquantes) {
  console.log(`  ✗ absente de la construction : ${u}`);
  console.log(`      citée sur : ${[...citations.get(u)].sort().join(', ')}`);
}
if (!manquantes.length) console.log(`  ✓ les ${miennes.length} adresses du site désignent une page construite\n`);

async function interroge(url) {
  const arret = AbortSignal.timeout(DELAI);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': NAVIGATEUR, accept: 'text/html,*/*' },
      signal: arret,
    });
    /* On lit le corps pour libérer la connexion proprement. */
    await r.arrayBuffer().catch(() => {});
    return { url, code: r.status, arrivee: r.url };
  } catch (e) {
    return { url, code: 0, erreur: e.message };
  }
}

const resultats = [];
for (let i = 0; i < adresses.length; i += FRONT) {
  resultats.push(...(await Promise.all(adresses.slice(i, i + FRONT).map(interroge))));
}

/* CE QUE NODE REFUSE, UN NAVIGATEUR L'ACCEPTE PARFOIS — et c'est le navigateur
   qui a raison, puisque c'est lui qui sert les visiteurs.

   Relevé sur aides.regionguadeloupe.fr : le serveur omet le certificat
   intermédiaire de sa chaîne. Node s'arrête sur UNABLE_TO_VERIFY_LEAF_SIGNATURE
   là où Chrome va chercher lui-même le maillon manquant et ouvre la page sans
   broncher. Compter ce cas comme un lien mort aurait fait retirer du site une
   page d'aide publique parfaitement en ligne.

   On ne relance donc au navigateur que ce qui a échoué au réseau, et le
   rapport dit d'où vient la réponse. */
/* On relance au navigateur ce qui a échoué au réseau ET ce qui répond 403 :
   un filtre anti-robot renvoie 403 à tout ce qui ne ressemble pas à un
   navigateur, quelle que soit l'identité déclarée dans l'en-tête. Légifrance
   le fait, et la page s'ouvre pourtant sans difficulté dans un navigateur. */
const aRejuger = resultats.filter((r) => r.code === 0 || r.code === 403);
if (aRejuger.length) {
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ userAgent: NAVIGATEUR, locale: 'fr-FR' });
  for (const r of aRejuger) {
    const page = await contexte.newPage();
    try {
      const reponse = await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: DELAI });
      r.code = reponse?.status() ?? 0;
      r.arrivee = page.url();
      r.parNavigateur = true;
    } catch (e) {
      r.erreur = `${r.erreur} — et au navigateur : ${e.message.split('\n')[0]}`;
    } finally {
      await page.close();
    }
  }
  await navigateur.close();
}

const echecs = [];
for (const r of resultats.sort((a, b) => a.url.localeCompare(b.url))) {
  const ou = [...citations.get(r.url)].sort().join(', ');
  if (r.code >= 200 && r.code < 300) {
    const devie = r.arrivee && r.arrivee.replace(/\/$/, '') !== r.url.replace(/\/$/, '');
    const source = r.parNavigateur ? '  (vérifié au navigateur)' : '';
    console.log(`  ✓ ${String(r.code)} ${r.url}${devie ? `  → ${r.arrivee}` : ''}${source}`);
  } else {
    echecs.push(r);
    console.log(`  ✗ ${r.code || '—'} ${r.url}`);
    console.log(`      cité sur : ${ou}`);
    if (r.erreur) console.log(`      ${r.erreur}`);
  }
}

if (echecs.length || manquantes.length) {
  if (manquantes.length) {
    console.log(`\n✗ ${manquantes.length} ADRESSE(S) DU SITE SANS PAGE : ${manquantes.join(', ')}`);
  }
  if (echecs.length) {
    console.log(
      `\n✗ ${echecs.length} ADRESSE(S) SANS RÉPONSE : ` +
        echecs.map((e) => e.url).join(', ') +
        '\n  Une adresse citée qui ne répond pas fait douter de tout le reste de la page.',
    );
  }
  process.exit(1);
}
console.log(`\n✓ ${resultats.length} ADRESSES EXTÉRIEURES ET ${miennes.length} INTERNES : TOUTES RÉPONDENT.`);
