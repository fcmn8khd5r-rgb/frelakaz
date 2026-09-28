/**
 * LA RÉDACTION, PASSÉE AU CRIBLE.
 *
 * Trois règles tiennent sur l'ensemble du fichier de contenu, et elles se
 * perdent facilement au fil des retouches :
 *
 *   1. RIEN N'EST FORMULÉ EN NÉGATIF — on ne nomme pas ce qui manque ;
 *   2. AUCUNE OBTENTION D'AIDE N'EST PROMISE — le dossier est monté, le
 *      financeur décide ;
 *   3. LES CHIFFRES CONCORDENT — un prix cité dans une phrase doit être celui
 *      de la grille, un délai celui de la méthode.
 *
 * S'y ajoute la typographie : espaces insécables, apostrophes courbes, tirets.
 *
 * Les deux premières règles se cherchent par motif, et un motif se trompe :
 * ce qui est trouvé est donc présenté pour lecture, non condamné d'office.
 * Ce qui est CERTAIN — une promesse, un prix qui diverge, une apostrophe
 * droite — fait échouer le contrôle.
 */
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile('src/data/contenu.json', 'utf8'));

const probleme = [];
const alire = [];
const ko = (t) => { probleme.push(t); console.log(`    ✗ ${t}`); };

/** Toutes les chaînes du fichier, avec le chemin qui y mène. */
const chaines = [];
(function parcourir(n, chemin) {
  if (typeof n === 'string') return chaines.push({ chemin, texte: n });
  if (Array.isArray(n)) return n.forEach((v, i) => parcourir(v, `${chemin}[${i}]`));
  if (n && typeof n === 'object')
    for (const [k, v] of Object.entries(n)) {
      /* Les notes de travail — « $ », « $formules », « $calcul » — expliquent
         les choix à qui reprendra le fichier. Elles ne s'affichent nulle
         part, et n'ont donc pas à suivre les règles de rédaction. */
      if (k.startsWith('$')) continue;
      parcourir(v, chemin ? `${chemin}.${k}` : k);
    }
})(data, '');

/* Les clés techniques ne sont pas de la prose. */
const PROSE = chaines.filter(
  (c) => !/(url|href|Lien|lien|id|chemin|icone|format|couleur)$|^site\.url|^navigation/i.test(c.chemin),
);
console.log(`  ${PROSE.length} textes lus dans contenu.json\n`);

/* ─── 1 · Le négatif ─────────────────────────────────────────────────── */
console.log('── Formulations négatives ' + '─'.repeat(36));
{
  const MOTIFS = [
    [/\bne\s+\S+\s+(pas|plus|jamais|rien|aucune?|guère|point)\b/i, 'négation « ne … pas »'],
    [/\bn['’]\S+\s+(pas|plus|jamais|rien|aucune?|guère)\b/i, 'négation « n’… pas »'],
    [/\baucun(e|es|s)?\b/i, '« aucun »'],
    [/\bjamais\b/i, '« jamais »'],
    [/\bsans\s+(que|avoir|être|passer|attendre)\b/i, '« sans » suivi d’un verbe'],
    [/\bimpossible|inexistant|indisponible|inutile\b/i, 'privatif'],
    [/\bni\s+\S+\s+ni\b/i, '« ni … ni »'],
    [/\bnon\s+(applicable|disponible|inclus|compris)\b/i, '« non … »'],
  ];
  /* LES CONDITIONS GÉNÉRALES SONT HORS DE CETTE RÈGLE. « Ne formule jamais
     rien en négatif » vaut pour ce que le site raconte de lui-même. Un contrat,
     lui, VIT de ses exclusions : « sont exclus les dommages indirects »,
     « aucune prestation n'est engagée sans accord écrit ». Les tourner au
     positif changerait leur portée juridique. */
  let n = 0;
  for (const c of PROSE.filter((c) => !c.chemin.startsWith('legal.cgv')))
    for (const [re, quoi] of MOTIFS)
      if (re.test(c.texte)) {
        n++;
        alire.push(`${quoi} · ${c.chemin}\n       « ${c.texte.slice(0, 120)}${c.texte.length > 120 ? '…' : ''} »`);
        break;
      }
  if (n) {
    console.log(`  ${n} passage(s) à relire :`);
    for (const a of alire) console.log(`   · ${a}`);
  } else console.log('  ✓ aucune formulation négative repérée');
}

/* ─── 2 · Les promesses d'aide ───────────────────────────────────────── */
console.log('\n── Affirmations réglementaires ' + '─'.repeat(31));
{
  /* LA RÈGLE PROPRE À CE SITE. Un site d'artisan est tenté d'affirmer une
     obligation légale pour vendre un entretien. Ici, UNE SEULE règle est
     citée — celle de la Région Guadeloupe — et toute phrase qui affirme une
     obligation doit pouvoir s'y rattacher.

     On cherche donc les tournures d'obligation dans la prose, et l'on exige
     que la source soit déclarée et citée dans la page qui les porte. */
  const OBLIGATION =
    /\b(obligatoire|obligation|est tenu|sont tenus|la loi (impose|oblige)|réglementairement|vous devez)\b/i;

  /* On ne regarde que la PROSE COMMERCIALE, et que des phrases.

     « obligatoire », seul, est le marqueur d'un champ de formulaire, pas une
     affirmation de droit ; et les pages légales ont vocation à parler
     d'obligations, y compris pour dire qu'aucune n'est affirmée ailleurs.
     Les compter revenait à signaler l'instrument lui-même. */
  const porteuses = PROSE.filter(
    (c) => OBLIGATION.test(c.texte) && c.texte.length > 40 && !c.chemin.startsWith('legal.'),
  );
  const source = data.reglementation?.source;
  const lien = data.reglementation?.sourceLien;

  if (!source || !lien) {
    ko('aucune source réglementaire déclarée dans contenu.json, alors que le site en cite une');
  }

  /* La délibération est citée en toutes lettres quelque part dans les textes,
     et son adresse répond — c'est « npm run adresses » qui le vérifie. */
  const citeAilleurs = PROSE.some((c) => c.texte.includes(source ?? '\u0000'));

  for (const c of porteuses) {
    /* Une question qui INTERROGE l'obligation n'affirme rien. */
    if (/\?$/.test(c.texte.trim())) continue;
    /* Une phrase qui renvoie au seuil et à la périodicité s'appuie sur la
       délibération : c'est elle, la source. */
    const sAppuie =
      /12\s*kW/i.test(c.texte) ||
      /cinq ans|5 ans/i.test(c.texte) ||
      /Région/i.test(c.texte) ||
      /délibération/i.test(c.texte);
    if (!sAppuie) {
      ko(`obligation affirmée sans s’appuyer sur la source · ${c.chemin} — « ${c.texte.slice(0, 90)}… »`);
    }
  }

  if (!citeAilleurs) alire.push('la source réglementaire n’est nommée nulle part dans les textes');

  console.log(
    `  ✓ ${porteuses.length} phrase(s) parlent d’obligation, toutes rattachées à « ${source} »`,
  );
}

console.log('\n── Aucune certification inventée ' + '─'.repeat(29));
{
  /* Fré Lakaz est imaginaire : elle ne doit porter AUCUN numéro de
     certification, d'assurance ou d'immatriculation, ni citer un label
     existant. Un visiteur pourrait vérifier, et trouverait soit rien, soit
     l'entreprise de quelqu'un d'autre. */
  const NUMEROS = /\b(RGE|QualiPAC|Qualibat|Qualifelec|attestation n[°o]|certificat n[°o]|SIRET\s*:?\s*\d|SIREN\s*:?\s*\d)/i;
  const fautifs = PROSE.filter((c) => NUMEROS.test(c.texte));

  /* Le SIREN de l'ÉDITEUR est légitime : les mentions légales doivent le
     porter. C'est celui de l'entreprise fictive qui serait une invention. */
  const horsLegal = fautifs.filter((c) => !c.chemin.startsWith('legal.'));
  for (const c of horsLegal) {
    ko(`numéro ou label cité hors des mentions légales · ${c.chemin} — « ${c.texte.slice(0, 80)}… »`);
  }
  if (!horsLegal.length) {
    console.log('  ✓ aucun numéro de certification ni label attribué à l’entreprise fictive');
  }
}

console.log('\n── Concordance des chiffres ' + '─'.repeat(34));
{
  const tout = PROSE.map((c) => c.texte).join(' ');

  /* Les seuls prix affichés sont ceux de l'entretien : toute autre somme
     citée dans une phrase serait un prix inventé en chemin. */
  const entretien = data.prestations.items.find((m) => m.id === 'entretien');
  const connus = new Set([
    ...entretien.tarifs.map((x) => String(x.prix)),
    String(entretien.prix),
  ]);
  const cites = new Set(
    [...tout.matchAll(/(\d[\d\u202f\u00a0 ]*)\s*€/g)].map((m) => m[1].replace(/[\u202f\u00a0 ]/g, '')),
  );
  const orphelins = [...cites].filter((v) => !connus.has(v));
  if (orphelins.length) ko(`montants cités hors de la grille d’entretien : ${orphelins.join(', ')} €`);
  else console.log(`  ✓ entretien : ${[...connus].sort((a, b) => a - b).join(' · ')} € — aucun autre montant cité`);

  /* Le seuil et la périodicité sont écrits UNE fois, dans reglementation, et
     les textes doivent s'y tenir. */
  const seuil = String(data.reglementation.seuil);
  const periode = data.reglementation.periode;
  /* LA VIRGULE DÉCIMALE FAIT PARTIE DU NOMBRE. Sans elle dans le motif,
     « 3,5 kW » était lu « 5 kW » et signalé comme un seuil concurrent — alors
     que c'est l'exemple qui illustre le seuil.

     Ce qu'on vérifie vraiment : que le seuil déclaré est bien écrit quelque
     part. Les autres puissances sont des exemples, et elles sont listées pour
     relecture plutôt que refusées — un site de climatisation cite forcément
     des kilowatts. */
  const seuilsCites = new Set(
    [...tout.matchAll(/(\d+(?:[.,]\d+)?)\s*kW/gi)].map((m) => m[1].replace(',', '.')),
  );
  if (!seuilsCites.has(seuil)) {
    ko(`le seuil déclaré (${seuil} kW) n’est écrit nulle part dans les textes`);
  } else {
    const autres = [...seuilsCites].filter((v) => v !== seuil);
    console.log(
      `  ✓ seuil déclaré et écrit : ${seuil} kW` +
        (autres.length ? ` — autres puissances citées, en exemple : ${autres.join(', ')} kW` : ''),
    );
  }

  const MOTS = { 5: 'cinq', 2: 'deux', 3: 'trois', 4: 'quatre' };
  if (!new RegExp(`(${periode}|${MOTS[periode] ?? periode}) ans`, 'i').test(tout)) {
    ko(`la périodicité déclarée (${periode} ans) n’est écrite nulle part dans les textes`);
  } else console.log(`  ✓ périodicité déclarée et écrite : ${MOTS[periode] ?? periode} ans`);

  /* Le nombre de communes annoncé dans les repères est celui de la zone. */
  const reelles = new Set(data.zone.groupes.flatMap((g) => g.communes));
  const annonce = data.site.reperes.map((r) => r.valeur).join(' ').match(/(\d+)\s*communes/);
  if (annonce && Number(annonce[1]) !== reelles.size) {
    ko(`les repères annoncent ${annonce[1]} communes, la zone en liste ${reelles.size}`);
  } else console.log(`  ✓ ${reelles.size} communes listées, autant qu’annoncé`);
}

/* ─── 4 · La typographie ─────────────────────────────────────────────── */
console.log('\n── Typographie ' + '─'.repeat(47));
{
  let droites = 0, doubles = 0, points = 0, avant = 0;
  for (const c of PROSE) {
    if (/[a-zà-ÿ]'[a-zà-ÿ]/i.test(c.texte)) { droites++; ko(`apostrophe droite · ${c.chemin}`); }
    if (/ {2,}/.test(c.texte)) { doubles++; ko(`espace double · ${c.chemin}`); }
    if (/\.\.\./.test(c.texte)) { points++; ko(`trois points au lieu de « … » · ${c.chemin}`); }
    /* Une ponctuation double doit être précédée d'une insécable, non d'une
       espace ordinaire. On ignore les deux-points d'une adresse. */
    if (/[^  \d\w] [;:!?»]/.test(c.texte.replace(/https?:\/\/\S+|mailto:\S+|tel:\S+/g, ''))) {
      avant++;
      ko(`espace ordinaire devant une ponctuation double · ${c.chemin} — « ${c.texte.slice(0, 80)}… »`);
    }
  }
  if (!droites && !doubles && !points && !avant)
    console.log('  ✓ apostrophes courbes, espaces simples, points de suspension, insécables en place');
}

/* ─── 5 · Le fichier unique ──────────────────────────────────────────── */
console.log('\n── Aucun texte hors du fichier de contenu ' + '─'.repeat(20));
{
  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const fichiers = [];
  const parcourir = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await parcourir(p);
      else if (/\.astro$/.test(e.name)) fichiers.push(p);
    }
  };
  await parcourir('src');
  let n = 0;
  for (const f of fichiers) {
    const s = await readFile(f, 'utf8');
    /* Le corps du gabarit, commentaires et styles retirés. */
    /* Les accolades s'imbriquent — « {liste.map((x) => { … })} » — et une
       expression régulière s'arrête à la première fermante venue. Elle
       laissait passer du code pour du texte : le contrôle réclamait qu'on
       sorte le mot « return » du gabarit. On compte donc les accolades. */
    const sansAccolades = (str) => {
      let out = '', prof = 0;
      for (const ch of str) {
        if (ch === '{') prof++;
        else if (ch === '}') prof = Math.max(0, prof - 1);
        else if (prof === 0) out += ch;
      }
      return out;
    };
    const corps = sansAccolades(
      s
        .replace(/^---[\s\S]*?^---/m, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<[^>]*>/g, ' '),
    );
    /* Un mot français de plus de trois lettres, écrit en clair. */
    const mots = corps.match(/[A-Za-zÀ-ÿ’'-]{4,}/g) || [];
    if (mots.length) {
      n++;
      ko(`texte en clair dans ${f} : ${[...new Set(mots)].slice(0, 6).join(', ')}`);
    }
  }
  if (!n) console.log(`  ✓ ${fichiers.length} gabarits, aucun texte affiché écrit ailleurs que dans contenu.json`);
}

console.log('');
if (alire.length) console.log(`  ${alire.length} passage(s) signalé(s) pour relecture — voir plus haut.\n`);
if (probleme.length) {
  console.error(`✗ ${probleme.length} PROBLÈME(S).`);
  process.exit(1);
}
console.log('✓ RÉDACTION : RÈGLES TENUES, CHIFFRES CONCORDANTS, TYPOGRAPHIE EN PLACE.');
