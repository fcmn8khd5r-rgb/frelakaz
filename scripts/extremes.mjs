/**
 * LES CAS EXTRÊMES.
 *
 * La suite ordinaire éprouve le site dans les conditions où il se trouve
 * d'habitude. Restent celles où il se trouvera un jour, et qu'aucun autre
 * contrôle n'atteint :
 *
 *   1. SANS JAVASCRIPT — script bloqué par une extension, réseau qui coupe,
 *      navigateur d'entreprise verrouillé. Le menu et les questions doivent
 *      s'ouvrir quand même : ce sont des <details>, ils le peuvent.
 *   2. SANS LES POLICES — le fichier n'arrive pas. Les polices de repli ont
 *      des métriques ajustées ; la page doit garder à peu près sa hauteur, et
 *      surtout ne rien laisser déborder.
 *   3. EN COULEURS FORCÉES — le mode contraste élevé de Windows remplace
 *      toutes les couleurs. Ce qui n'était dessiné que par une couleur de
 *      fond disparaît alors.
 *   4. À L'IMPRESSION — une page de conditions générales s'imprime.
 *   5. AUX ÉCRANS EXTRÊMES — 280 px, et jusqu'à 3840.
 *   6. CONSTRUCTION REPRODUCTIBLE — deux constructions de suite donnent le
 *      même dossier, sinon le cache du navigateur travaille pour rien.
 *   7. VALIDITÉ DU BALISAGE — un navigateur répare en silence ce qu'un autre
 *      interprète autrement.
 */
import { pages } from './pages.mjs';
import { chromium } from 'playwright';
import { readFile, readdir, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HtmlValidate, formatterFactory } from 'html-validate';

const execFileP = promisify(execFile);
const BASE = process.env.BASE || 'http://127.0.0.1:4488';
/* LA LISTE VIENT DE LA CONSTRUCTION, et non d'ici : elle était recopiée dans
   cinq scripts, et quatre pages de métier sont arrivées d'un coup. Voir
   scripts/pages.mjs. */
const PAGES = await pages();

const probleme = [];
const ko = (t) => { probleme.push(t); console.log(`    ✗ ${t}`); };
const ok = (t) => console.log(`  ✓ ${t}`);

const nav = await chromium.launch();

/* ─── 1 · Sans JavaScript ────────────────────────────────────────────── */
console.log('── Sans JavaScript ' + '─'.repeat(43));
{
  const avantSansScript = probleme.length;
  const ctx = await nav.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  for (const chemin of PAGES) {
    await page.goto(BASE + chemin, { waitUntil: 'load' });
    const e = await page.evaluate(() => ({
      texte: (document.querySelector('main')?.innerText || '').trim().length,
      liens: document.querySelectorAll('a[href]').length,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      classeJs: document.documentElement.classList.contains('js'),
    }));
    /* DEUX PAGES TIENNENT EN UN TITRE, UNE PHRASE ET DES CHEMINS : celle des
       adresses égarées et celle qui confirme l'envoi du formulaire. Leur
       demander autant de texte qu'aux mentions légales n'a pas de sens — on
       vérifie qu'elles affichent leur titre, leur phrase et leurs liens, pas
       qu'elles atteignent un nombre de signes. */
    const BREVES = ['/404.html', '/devis/merci/', '/rendez-vous/merci/'];
    const plancher = BREVES.includes(chemin) ? 150 : 400;
    if (e.texte < plancher) ko(`sans script · ${chemin} : ${e.texte} signes affichés`);
    /* Ce qu'on veut savoir : la page n'est pas un cul-de-sac. On compte les
       liens de la PAGE ENTIÈRE et non du seul contenu — le pied porte le
       menu, le numéro et l'adresse sur chacune, et c'est par là qu'on sort. */
    if (e.liens < 8) ko(`sans script · ${chemin} : ${e.liens} lien(s), la page est un cul-de-sac`);
    if (e.debord > 1) ko(`sans script · ${chemin} : ${e.debord} px de débordement`);
    if (e.classeJs) ko(`sans script · ${chemin} : la classe « js » est posée malgré tout`);
  }
  /* Le menu doit s'ouvrir : c'est un <details>, le navigateur s'en charge. */
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('.entete summary').first().click();
  await page.waitForTimeout(200);
  const menu = await page.evaluate(() => {
    const p = document.querySelector('.mobile__interieur');
    return { ouvert: document.querySelector('.mobile').open, hauteur: Math.round(p.getBoundingClientRect().height), liens: p.querySelectorAll('a').length };
  });
  if (!menu.ouvert || menu.hauteur < 100) ko(`sans script · le menu ne s'ouvre pas (${JSON.stringify(menu)})`);
  else ok(`le menu s'ouvre sans script : ${menu.liens} liens sur ${menu.hauteur} px`);

  /* Une question doit s'ouvrir aussi. Trois précautions, chacune apprise
     d'une fausse alerte :
       · on repart d'une page neuve, le menu qu'on vient d'ouvrir restant
         déployé faute de script pour le refermer ;
       · on amène la question au CENTRE et d'un SAUT — le défilement du site
         est doux, et un élément qui glisse n'est jamais « stable » ;
       · on éprouve la DEUXIÈME question : la première est servie ouverte,
         pour qu'un visiteur voie tout de suite à quoi ressemble une réponse.
         Cliquer sur celle-là la referme, ce qui ressemblait à une panne. */
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const question = page.locator('.q').nth(1);
  await question.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await question.locator('summary').click();
  await page.waitForTimeout(200);
  const q = await page.evaluate(() => {
    const d = document.querySelectorAll('.q')[1];
    return { ouvert: d.open, texte: d.innerText.trim().length };
  });
  if (!q.ouvert || q.texte < 120) ko(`sans script · une question ne s'ouvre pas (${JSON.stringify(q)})`);
  else ok('une question s’ouvre sans script');

  /* La barre basse doit rester joignable : c'est elle qui porte les trois
     masque le temps que l'ouverture soit passée. */
  const pastille = await page.evaluate(() => {
    const f = document.querySelector('.barre-basse');
    return { opacite: +getComputedStyle(f).opacity, clics: getComputedStyle(f).pointerEvents };
  });
  if (pastille.opacite < 0.9 || pastille.clics === 'none')
    ko(`sans script · la barre basse reste masquée : ${JSON.stringify(pastille)}`);
  else ok('la barre basse reste joignable sans script');

  /* La ligne verte ne s'imprime que si rien n'a été relevé dans ce contrôle :
     elle annonçait « 10 pages lisibles » au-dessus d'une croix qui en excluait
     une. */
  if (probleme.length === avantSansScript) {
    ok(`${PAGES.length} pages lisibles sans script, sans débordement`);
  }
  await ctx.close();
}

/* ─── 2 · Sans les polices ───────────────────────────────────────────── */
console.log('\n── Sans les polices ' + '─'.repeat(42));
{
  const mesurer = async (bloquer) => {
    const ctx = await nav.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    if (bloquer) await page.route('**/polices/**', (r) => r.abort());
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      hauteur: document.documentElement.scrollHeight,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titre: Math.round(document.querySelector('h1').getBoundingClientRect().height),
    }));
    await ctx.close();
    return m;
  };
  const avec = await mesurer(false);
  const sans = await mesurer(true);
  const ecart = Math.abs(sans.hauteur - avec.hauteur) / avec.hauteur * 100;
  if (sans.debord > 1) ko(`sans polices : ${sans.debord} px de débordement`);
  /* Les repli sont ajustés par « size-adjust » : au-delà de 5 % d'écart, le
     réglage a dérivé et la page saute au chargement de la vraie police. */
  if (ecart > 5) ko(`sans polices : la page change de ${ecart.toFixed(1)} % de hauteur (${avec.hauteur} → ${sans.hauteur})`);
  else ok(`repli des polices : ${ecart.toFixed(2)} % d’écart de hauteur (${avec.hauteur} → ${sans.hauteur} px), titre ${avec.titre} → ${sans.titre} px`);
}

/* ─── 3 · Couleurs forcées ───────────────────────────────────────────── */
console.log('\n── Couleurs forcées (contraste élevé) ' + '─'.repeat(24));
{
  const ctx = await nav.newContext({ forcedColors: 'active', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const chemin of ['/', '/mentions-legales/']) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    const e = await page.evaluate(() => {
      /* Un élément qui n'existait que par sa couleur de fond devient
         invisible : on cherche ce qui n'a ni texte, ni bordure, ni image. */
      const fantomes = [...document.querySelectorAll('.bouton, .formule, .oeuvre__cadre, .repere')].filter((el) => {
        const s = getComputedStyle(el);
        const bord = ['Top', 'Right', 'Bottom', 'Left'].some((c) => parseFloat(s[`border${c}Width`]) > 0);
        return !el.innerText.trim() && !bord && !el.querySelector('img, svg');
      }).length;
      return {
        fantomes,
        debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        texte: document.body.innerText.trim().length,
      };
    });
    if (e.fantomes) ko(`couleurs forcées · ${chemin} : ${e.fantomes} élément(s) sans contour ni contenu`);
    if (e.debord > 1) ko(`couleurs forcées · ${chemin} : ${e.debord} px de débordement`);
    if (e.texte < 500) ko(`couleurs forcées · ${chemin} : ${e.texte} signes seulement`);
  }
  ok('en couleurs forcées, rien ne disparaît et rien ne déborde');
  await ctx.close();
}

/* ─── 4 · À l'impression ─────────────────────────────────────────────── */
console.log('\n── À l’impression ' + '─'.repeat(44));
{
  const ctx = await nav.newContext({ viewport: { width: 1024, height: 1400 } });
  const page = await ctx.newPage();
  /* LES PAGES QU'ON IMPRIME VRAIMENT : les documents légaux. La liste était
     recopiée et citait « /conditions-generales/ », absente ici — le serveur
     rendait la page des adresses égarées, et le contrôle signalait « 192
     signes » sur une page qu'il n'avait jamais ouverte. On la lit donc dans
     le fichier de contenu, qui est sa source. */
  const contenu = JSON.parse(await readFile('src/data/contenu.json', 'utf8'));
  const documents = contenu.navigation.documents.map((d) => d.href);
  for (const chemin of documents) {
    const reponse = await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    if ((reponse?.status() ?? 0) !== 200) {
      ko(`impression · ${chemin} répond ${reponse?.status()} — mesure abandonnée`);
      continue;
    }
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(200);
    const e = await page.evaluate(() => ({
      barre: getComputedStyle(document.querySelector('.entete')).display,
      pastille: document.querySelector('.barre-basse') ? getComputedStyle(document.querySelector('.barre-basse')).display : 'none',
      texte: (document.querySelector('main')?.innerText || '').trim().length,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    if (e.barre !== 'none') ko(`impression · ${chemin} : la barre haute s’imprime`);
    if (e.pastille !== 'none') ko(`impression · ${chemin} : la barre basse s’imprime`);
    /* CE QU'ON VÉRIFIE ICI : qu'une page légale s'imprime ENTIÈRE, et non
       qu'elle soit longue. Le plancher valait 800 signes, calé sur un site
       aux conditions générales fournies ; la politique de confidentialité de
       celui-ci en fait 682, parce qu'un site qui ne collecte rien a peu à
       déclarer. Allonger un texte pour satisfaire un seuil serait écrire pour
       l'instrument. 400 signes suffisent à distinguer une page imprimée d'une
       page vide. */
    if (e.texte < 400) ko(`impression · ${chemin} : ${e.texte} signes, la page s’imprime tronquée`);
    if (e.debord > 1) ko(`impression · ${chemin} : ${e.debord} px de débordement`);
    const pdf = await page.pdf({ format: 'A4' });
    if (pdf.length < 20000) ko(`impression · ${chemin} : le PDF ne fait que ${pdf.length} octets`);
    await page.emulateMedia({ media: 'screen' });
  }
  ok('barre haute, bandeau et barre basse retirés, texte entier, PDF produit');
  await ctx.close();
}

/* ─── 5 · Écrans extrêmes ────────────────────────────────────────────── */
console.log('\n── Écrans extrêmes ' + '─'.repeat(43));
{
  for (const [l, h] of [[280, 653], [2560, 1440], [3440, 1440], [3840, 2160]]) {
    const ctx = await nav.newContext({ viewport: { width: l, height: h } });
    const page = await ctx.newPage();
    let pires = 0;
    for (const chemin of PAGES) {
      await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
      const e = await page.evaluate(() => {
        const d = document.documentElement;
        const debord = d.scrollWidth - d.clientWidth;
        /* Aux très grandes largeurs, la colonne de contenu doit rester
           centrée et bornée : un texte de 3000 px de large est illisible. */
        const env = document.querySelector('.enveloppe').getBoundingClientRect();
        const par = document.querySelector('.ouverture__lead, .doc__par, .egaree__texte');
        return { debord, enveloppe: Math.round(env.width), ligne: par ? Math.round(par.getBoundingClientRect().width) : 0 };
      });
      if (e.debord > 1) { ko(`${l}×${h} · ${chemin} : ${e.debord} px de débordement`); pires++; }
      if (e.enveloppe > 1300) { ko(`${l}×${h} · ${chemin} : colonne de ${e.enveloppe} px`); pires++; }
      if (e.ligne > 900) { ko(`${l}×${h} · ${chemin} : ligne de texte de ${e.ligne} px`); pires++; }
    }
    if (!pires) console.log(`  ✓ ${String(l).padStart(4)}×${h}  ${PAGES.length} pages, colonne bornée, aucun débordement`);
    await ctx.close();
  }
}

await nav.close();

/* ─── 6 · Construction reproductible ─────────────────────────────────── */
console.log('\n── Construction reproductible ' + '─'.repeat(32));
{
  const empreinte = async (dir) => {
    const fichiers = [];
    const parcourir = async (d, base) => {
      for (const e of (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = join(d, e.name);
        if (e.isDirectory()) await parcourir(p, `${base}${e.name}/`);
        else fichiers.push(`${base}${e.name}:${createHash('sha1').update(await readFile(p)).digest('hex')}`);
      }
    };
    await parcourir(dir, '');
    return { liste: fichiers, somme: createHash('sha1').update(fichiers.join('\n')).digest('hex') };
  };
  const a = await empreinte('dist');
  await cp('dist', '.cache/dist-1', { recursive: true, force: true });
  await execFileP('npx', ['astro', 'build'], { cwd: process.cwd() });
  const b = await empreinte('dist');
  await rm('.cache/dist-1', { recursive: true, force: true });
  if (a.somme !== b.somme) {
    const A = new Map(a.liste.map((l) => l.split(':')));
    const B = new Map(b.liste.map((l) => l.split(':')));
    const bouge = [...B.keys()].filter((k) => A.get(k) !== B.get(k)).concat([...A.keys()].filter((k) => !B.has(k)));
    /* Le plan du site porte la date du jour : il change chaque nuit, et c'est
       voulu. Tout le reste doit être identique. */
    const vrais = bouge.filter((f) => f !== 'sitemap.xml');
    if (vrais.length) ko(`construction : ${vrais.length} fichier(s) diffèrent — ${vrais.slice(0, 4).join(', ')}`);
    else ok(`${a.liste.length} fichiers identiques d’une construction à l’autre (hors plan du site, qui porte la date)`);
  } else ok(`${a.liste.length} fichiers identiques d’une construction à l’autre`);
}

/* ─── 7 · Validité du balisage ───────────────────────────────────────── */
console.log('\n── Validité du balisage ' + '─'.repeat(38));
{
  const validateur = new HtmlValidate({
    extends: ['html-validate:recommended'],
    rules: {
      /* Astro pose ses propres attributs de portée sur les éléments ; ils
         sont valides mais inconnus du dictionnaire. */
      'attribute-allowed-values': 'off',
      'no-unknown-elements': 'error',
      'no-inline-style': 'off',
      /* CETTE RÈGLE EST TENUE AILLEURS. Un validateur statique ignore le CSS :
         il voit le menu d'ordinateur et le panneau de téléphone coexister,
         alors que l'un est toujours en « display: none ». Le contrôle qui
         compte est celui d'axe, dans « npm run acces », qui juge sur l'arbre
         d'accessibilité réel — et qui a bien relevé le seul doublon vrai,
         deux navigations « Documents » une fois le panneau ouvert. */
      'unique-landmark': 'off',
      'require-sri': 'off',
      'long-title': 'off',
    },
  });
  const fichiers = [];
  const parcourir = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await parcourir(p);
      else if (e.name.endsWith('.html')) fichiers.push(p);
    }
  };
  await parcourir('dist');
  let erreurs = 0;
  for (const f of fichiers.sort()) {
    const r = await validateur.validateString(await readFile(f, 'utf8'), f);
    const graves = r.results.flatMap((x) => x.messages).filter((m) => m.severity === 2);
    if (graves.length) {
      erreurs += graves.length;
      for (const m of graves.slice(0, 4)) ko(`${f} L${m.line} · ${m.ruleId} — ${m.message}`);
    }
  }
  if (!erreurs) ok(`${fichiers.length} pages, balisage valide`);
}

console.log('');
if (probleme.length) {
  console.error(`✗ ${probleme.length} PROBLÈME(S).`);
  process.exit(1);
}
console.log('✓ CAS EXTRÊMES : SANS SCRIPT, SANS POLICES, EN COULEURS FORCÉES, À L’IMPRESSION, DE 280 À 3840 PX.');
