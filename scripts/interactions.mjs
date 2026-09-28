/**
 * LES INTERACTIONS, ÉPROUVÉES COMME UN VISITEUR LES FAIT.
 *
 * Ce script ne vérifie pas que des classes existent : il clique, il tabule, il
 * envoie des formulaires, et il mesure ce qui arrive. Un site peut être
 * impeccable au rendu et inerte au doigt.
 *
 * Il a été RÉÉCRIT pour ce site, et non rapiécé depuis celui d'à côté : repris
 * tel quel, il visait « .basse » là où la barre s'appelle « .barre-basse », et
 * il mourait sur une attente de trente secondes. Un contrôle qui parle des
 * sélecteurs d'un autre site ne mesure rien du sien.
 */
import { pagesLiees } from './pages.mjs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4488';
const echecs = [];
const ok = (nom, detail = '') => console.log(`  ✓ ${nom}${detail ? ` — ${detail}` : ''}`);
const ko = (nom, detail) => {
  echecs.push(`${nom} — ${detail}`);
  console.log(`  ✗ ${nom} — ${detail}`);
};

const navigateur = await chromium.launch();
const TEL = { width: 390, height: 844, isMobile: true, hasTouch: true };
const ORD = { width: 1440, height: 900 };

/**
 * ATTEND QUE LE DÉFILEMENT SE SOIT ARRÊTÉ.
 *
 * La page défile en douceur : une mesure prise pendant le trajet lit une
 * position intermédiaire. C'est ainsi qu'une ancre parfaitement posée à 24 px
 * sous la barre s'est annoncée à 166 px — la page était encore en route. On
 * observe donc la position jusqu'à ce qu'elle cesse de bouger.
 */
const stabilise = async (p, limite = 4000) => {
  const debut = Date.now();
  let precedent = -1;
  let stable = 0;
  while (Date.now() - debut < limite) {
    const y = await p.evaluate(() => Math.round(window.scrollY));
    stable = y === precedent ? stable + 1 : 0;
    precedent = y;
    if (stable >= 3) return { y, duree: Date.now() - debut };
    await p.waitForTimeout(60);
  }
  return { y: precedent, duree: limite };
};

const page = async (vue) => {
  const ctx = await navigateur.newContext({ viewport: vue, locale: 'fr-FR', ...(vue.isMobile ? { isMobile: true, hasTouch: true } : {}) });
  return { ctx, p: await ctx.newPage() };
};

/* ══ 1 · La barre basse ═══════════════════════════════════════════════════ */
console.log('\n── La barre basse ' + '─'.repeat(44));
{
  const { ctx, p } = await page(TEL);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });

  const actions = await p.$$eval('.barre-basse a', (as) =>
    as.map((a) => ({ href: a.getAttribute('href') || '', texte: a.textContent.trim().split('\n')[0], haut: Math.round(a.getBoundingClientRect().height) })),
  );
  if (actions.length !== 3) ko('barre basse', `${actions.length} action(s) au lieu de trois`);
  else ok('trois actions sur téléphone', actions.map((a) => a.texte).join(' · '));

  const petites = actions.filter((a) => a.haut < 44);
  if (petites.length) ko('cibles de la barre basse', `${petites.length} sous 44 px`);
  else ok('cibles confortables', `${Math.min(...actions.map((a) => a.haut))} px de haut au moins`);

  const whats = actions.find((a) => a.href.startsWith('https://wa.me/'));
  if (!whats) ko('barre basse', 'aucun lien WhatsApp');
  else if (!/d%C3%A9monstration|démonstration/i.test(decodeURIComponent(whats.href)))
    ko('message WhatsApp', 'il ne mentionne pas la démonstration');
  else ok('WhatsApp pré-rempli', 'le message mentionne la démonstration');

  /* Elle ne doit JAMAIS recouvrir le pied de page : le corps lui rend sa
     place, et c'est ce qu'on mesure, au repos, tout en bas. */
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await p.waitForTimeout(400);
  const chevauche = await p.evaluate(() => {
    const b = document.querySelector('.barre-basse').getBoundingClientRect();
    for (const e of document.querySelectorAll('.pied a, .pied p')) {
      const r = e.getBoundingClientRect();
      if (r.height && b.top < r.bottom && b.bottom > r.top && r.top < innerHeight) return e.textContent.trim().slice(0, 40);
    }
    return null;
  });
  if (chevauche) ko('barre basse en bas de page', `elle recouvre « ${chevauche} »`);
  else ok('elle laisse le pied de page tranquille', 'mesuré au repos, tout en bas');
  await ctx.close();
}

{
  const { ctx, p } = await page(ORD);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const visible = await p.evaluate(() => {
    const b = document.querySelector('.barre-basse');
    return b ? getComputedStyle(b).display !== 'none' : false;
  });
  if (visible) ko('barre basse sur ordinateur', 'elle devrait disparaître au-delà de 60 rem');
  else ok('elle disparaît sur ordinateur', 'la barre haute y porte déjà le devis');
  await ctx.close();
}

/* ══ 2 · Le menu de téléphone ═════════════════════════════════════════════ */
console.log('\n── Le menu de téléphone ' + '─'.repeat(38));
{
  const { ctx, p } = await page(TEL);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });

  const etat = () => p.evaluate(() => ({
    ouvert: document.querySelector('.mobile').open,
    annonce: document.querySelector('[data-menu-bouton]').getAttribute('aria-expanded'),
    liens: document.querySelectorAll('.mobile__liste a').length,
  }));

  await p.click('[data-menu-bouton]');
  await p.waitForTimeout(400);
  let e = await etat();
  if (!e.ouvert || e.annonce !== 'true') ko('ouverture du menu', JSON.stringify(e));
  else ok('le menu s’ouvre et l’annonce', `${e.liens} entrées`);

  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  e = await etat();
  const rendu = await p.evaluate(() => document.activeElement?.matches('[data-menu-bouton]'));
  if (e.ouvert || !rendu) ko('Échap', JSON.stringify({ ...e, rendu }));
  else ok('Échap ferme et rend le focus au bouton');

  await p.click('[data-menu-bouton]');
  await p.waitForTimeout(300);
  await p.mouse.click(10, 700);
  await p.waitForTimeout(300);
  if ((await etat()).ouvert) ko('clic au-dehors', 'le menu reste ouvert');
  else ok('un clic au-dehors ferme le menu');

  await p.click('[data-menu-bouton]');
  await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.waitForTimeout(500);
  if ((await etat()).ouvert) ko('élargissement', 'le panneau reste ouvert au-delà du seuil');
  else ok('l’élargissement de la fenêtre replie le panneau');
  await ctx.close();
}

/* ══ 3 · Les questions ════════════════════════════════════════════════════ */
console.log('\n── Les questions ' + '─'.repeat(45));
{
  const { ctx, p } = await page(ORD);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const seconde = p.locator('.q').nth(1);
  await seconde.locator('summary').click();
  await p.waitForTimeout(250);
  const r = await seconde.evaluate((d) => ({
    ouvert: d.open,
    haut: Math.round(d.querySelector('.q__panneau').getBoundingClientRect().height),
  }));
  if (!r.ouvert || r.haut < 20) ko('une réponse s’ouvre', JSON.stringify(r));
  else ok('une réponse s’ouvre', `${r.haut} px de texte`);

  await seconde.locator('summary').click();
  await p.waitForTimeout(250);
  const ferme = await seconde.evaluate((d) => ({
    ouvert: d.open,
    haut: Math.round(d.querySelector('.q__panneau').getBoundingClientRect().height),
  }));
  if (ferme.ouvert || ferme.haut > 1) ko('elle se referme', JSON.stringify(ferme));
  else ok('elle se referme, et ne réserve plus aucune hauteur');
  await ctx.close();
}

/* ══ 4 · Les ancres ═══════════════════════════════════════════════════════ */
console.log('\n── Les ancres de la barre haute ' + '─'.repeat(30));
{
  const { ctx, p } = await page(ORD);
  for (const href of await (async () => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    return p.$$eval('.menu__lien', (as) => as.map((a) => a.getAttribute('href')));
  })()) {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.click(`.menu__lien[href="${href}"]`);
    const arret = await stabilise(p);
    const id = href.replace('/#', '');
    const place = await p.evaluate((id) => {
      const s = document.getElementById(id);
      if (!s) return null;
      const barre = document.querySelector('.entete').getBoundingClientRect().bottom;
      const titre = s.querySelector('h2, h1');
      return {
        bord: Math.round(s.getBoundingClientRect().top - barre),
        titre: titre ? Math.round(titre.getBoundingClientRect().top - barre) : null,
      };
    }, id);
    if (!place) ko(`ancre ${href}`, 'la section n’existe pas');
    else if (place.titre === null || place.titre < 0 || place.titre > 90)
      ko(`ancre ${href}`, JSON.stringify(place));
    else ok(`ancre ${href}`, `titre à ${place.titre} px sous la barre (${arret.duree} ms)`);
  }
  await ctx.close();
}

/* ══ 5 · La demande de devis ══════════════════════════════════════════════ */
console.log('\n── La demande de devis ' + '─'.repeat(39));
{
  const { ctx, p } = await page(TEL);
  await p.goto(BASE + '/devis/', { waitUntil: 'networkidle' });

  /* L'incrémenteur : il pousse la valeur, et il respecte les bornes. */
  const champ = p.locator('#pieces');
  await p.click('[data-compteur] [data-pas="1"]');
  await p.click('[data-compteur] [data-pas="1"]');
  if ((await champ.inputValue()) !== '3') ko('incrémenteur', `valeur ${await champ.inputValue()} au lieu de 3`);
  else ok('l’incrémenteur pousse la valeur', '1 → 3');

  for (let i = 0; i < 5; i++) await p.click('[data-compteur] [data-pas="-1"]');
  if ((await champ.inputValue()) !== '1') ko('borne basse', `valeur ${await champ.inputValue()} au lieu de 1`);
  else ok('il s’arrête à la borne basse', 'jamais zéro pièce');

  /* Le besoin passé en adresse coche la bonne carte. */
  await p.goto(BASE + '/devis/?besoin=depannage', { waitUntil: 'networkidle' });
  const coche = await p.evaluate(() => document.querySelector('input[name="besoin"]:checked')?.value);
  if (coche !== 'depannage') ko('besoin passé en adresse', `« ${coche} » coché`);
  else ok('le besoin passé en adresse coche sa carte', 'depannage');

  /* L'envoi complet, comme un navigateur le fait. */
  await p.selectOption('#commune', 'Le Gosier');
  await p.fill('#nom', 'Contrôle automatique');
  await p.fill('#telephone', '0690 11 22 33');
  await p.check('input[name="consentement"]');
  await p.click('button[type="submit"]');
  await p.waitForLoadState('networkidle');
  if (!p.url().endsWith('/devis/merci/')) ko('envoi du devis', `arrivé sur ${p.url()}`);
  else {
    const titre = await p.$eval('h1', (h) => h.textContent.trim());
    ok('l’envoi mène à la confirmation', `« ${titre} »`);
  }
  await ctx.close();
}

/* ══ 6 · Le rendez-vous ═══════════════════════════════════════════════════ */
console.log('\n── La prise de rendez-vous ' + '─'.repeat(35));
{
  const { ctx, p } = await page(TEL);
  await p.goto(BASE + '/rendez-vous/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);

  const ouverts = await p.$$eval('.journee[open]', (d) => d.length);
  if (ouverts !== 1) ko('un seul jour ouvert', `${ouverts} ouverts`);
  else ok('un seul jour est ouvert à l’arrivée', 'le premier qui offre un créneau');

  /* On ouvre un autre jour : le premier doit se refermer. */
  const jours = p.locator('.journee');
  await jours.nth(2).locator('summary').click();
  await p.waitForTimeout(300);
  const apres = await p.$$eval('.journee[open]', (d) => d.length);
  if (apres !== 1) ko('un seul jour à la fois', `${apres} ouverts après un second clic`);
  else ok('ouvrir un jour referme le précédent');

  /* Un créneau pris est hors d’atteinte : ni cliquable, ni tabulable. */
  const pris = await p.evaluate(() => {
    const c = document.querySelector('.journee[open] .creneau--pris input');
    return c ? { desactive: c.disabled, coche: c.checked } : null;
  });
  if (pris && !pris.desactive) ko('créneau pris', 'il reste sélectionnable');
  else ok('un créneau pris est hors d’atteinte', pris ? 'désactivé' : 'aucun créneau pris ce jour-là');

  /* L'envoi complet sur un créneau libre. */
  const libre = await p.evaluate(() => document.querySelector('.journee[open] .creneau input:not([disabled])')?.value);
  if (!libre) ko('rendez-vous', 'aucun créneau libre sur le jour ouvert');
  else {
    /* LE BOUTON RADIO EST RETIRÉ DE L'AFFICHAGE — c'est la carte qui se voit,
       et c'est elle qu'un visiteur touche. On clique donc l'étiquette, comme
       lui : viser le champ lui-même fait buter le pilote sur le libellé qui
       le recouvre, et l'attente expire au bout de trente secondes. */
    await p.locator(`.creneau:has(input[value="${libre}"])`).click();
    await p.selectOption('#commune', 'Sainte-Anne');
    await p.fill('#nom', 'Contrôle automatique');
    await p.fill('#telephone', '0690 11 22 33');
    await p.check('input[name="consentement"]');
    await p.click('button[type="submit"]');
    await p.waitForLoadState('networkidle');
    if (!p.url().endsWith('/rendez-vous/merci/')) ko('envoi du rendez-vous', `arrivé sur ${p.url()}`);
    else ok('l’envoi mène à la confirmation', libre);
  }
  await ctx.close();
}

/* ══ 7 · Toutes les pages répondent ═══════════════════════════════════════ */
console.log('\n── Les pages et les liens ' + '─'.repeat(36));
{
  const { ctx, p } = await page(ORD);
  for (const chemin of await pagesLiees()) {
    const r = await p.goto(BASE + chemin, { waitUntil: 'domcontentloaded' });
    const code = r?.status() ?? 0;
    if (code !== 200) ko(`page ${chemin}`, String(code));
    else ok(`page ${chemin}`, '200');
  }
  /* Les liens sortants sont contrôlés par « npm run adresses », et là
     seulement : un même fait mesuré à deux endroits finit par se contredire. */
  const externes = await p.$$eval('a[href^="http"]', (as) => new Set(as.map((a) => a.href)).size);
  console.log(`  · ${externes} liens sortants sur cette page — voir « npm run adresses »`);
  await ctx.close();
}

await navigateur.close();
console.log(
  echecs.length
    ? `\n✗ ${echecs.length} échec(s) :\n${echecs.map((e) => '   ' + e).join('\n')}`
    : '\n✓ TOUTES LES INTERACTIONS PASSENT.',
);
process.exit(echecs.length ? 1 : 0);
