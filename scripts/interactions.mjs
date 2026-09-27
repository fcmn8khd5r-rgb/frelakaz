/**
 * CE QUI SE CLIQUE, ÉPROUVÉ.
 * Chaque attente est calée sur une CONDITION observable, jamais sur un délai.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4477';
const resultats = [];
const dire = (bon, quoi, detail = '') => {
  resultats.push(bon);
  console.log(`  ${bon ? '✓' : '✗'} ${quoi}${detail ? ' — ' + detail : ''}`);
};
const montant = (s) => Number((s || '').replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.'));

const nav = await chromium.launch({ args: ['--lang=fr-FR'] });

/* ---- Téléphone : barre basse, menu, recherche -------------------------- */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

  dire(await page.locator('.basse').isVisible(), 'barre basse présente sur téléphone');
  const wa = await page.locator('.basse a[href^="https://wa.me/"]').getAttribute('href');
  dire(!!wa && wa.includes('590690305037') && wa.includes('monstration'),
       'WhatsApp : numéro professionnel et message pré-rempli');

  /* L'aéroport est le défaut, et la mention d'économie est visible. */
  dire(await page.locator('select[name="lieuPrise"]').inputValue() === 'aeroport',
       'le lieu de prise par défaut est l’aéroport');
  const eco = page.locator('.recherche__economie');
  dire(await eco.isVisible() && /Jarry/.test((await eco.textContent()) || ''),
       'la mention d’économie sur Jarry est visible', (await eco.textContent())?.trim().slice(0, 52));

  const panneau = page.locator('.tiroir__panneau');
  dire(!(await panneau.isVisible()), 'menu replié au chargement');
  await page.locator('.tiroir__bouton').click();
  await panneau.waitFor({ state: 'visible' });
  const cibles = await page.locator('.tiroir__panneau a').evaluateAll((l) =>
    l.map((a) => Math.round(a.getBoundingClientRect().height)));
  dire(cibles.every((h) => h >= 40), 'cibles du menu ≥ 40 px', `min ${Math.min(...cibles)} px`);
  await page.keyboard.press('Escape');

  /* Le formulaire de l'accueil mène à la réservation, sans script. */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.locator('.recherche button[type="submit"]').click();
  await page.waitForURL(/\/reserver\/\?/, { timeout: 15000 });
  dire(/lieuPrise=aeroport/.test(page.url()), 'la recherche porte ses réponses dans l’adresse',
       page.url().replace(BASE, '').slice(0, 60));

  await ctx.close();
}

/* ---- Ordinateur : le parcours et le devis ------------------------------ */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/reserver/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-recap] dl') !== null);

  const total0 = montant(await page.locator('.ligne--total dd').textContent());
  dire(total0 > 0, 'le total est chiffré au chargement', `${total0} €`);

  /* Une option ajoute une ligne NOMMÉE et augmente le total. */
  await page.locator('[data-option="rachat"]').check();
  await page.waitForFunction((t) => {
    const e = document.querySelector('.ligne--total dd');
    return e && Number(e.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) > t;
  }, total0, { timeout: 10000 });
  const total1 = montant(await page.locator('.ligne--total dd').textContent());
  const lignes = await page.locator('[data-recap] .ligne dt').allTextContents();
  dire(total1 > total0 && lignes.some((l) => /franchise/i.test(l)),
       'une option ajoute sa ligne nommée et son montant', `${total0} → ${total1} €`);

  /* Le supplément jeune conducteur apparaît dès l'âge renseigné. */
  await page.fill('input[name="age"]', '22');
  await page.locator('input[name="age"]').dispatchEvent('change');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.recap__section')].some((e) => /jeune/i.test(e.textContent)));
  const total2 = montant(await page.locator('.ligne--total dd').textContent());
  dire(total2 > total1, 'le supplément jeune conducteur apparaît et s’ajoute', `${total1} → ${total2} €`);

  /* L'aller simple se facture et se nomme. */
  await page.selectOption('select[name="lieuRetour"]', 'port');
  await page.waitForFunction((t) => {
    const e = document.querySelector('.ligne--total dd');
    return e && Number(e.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) > t;
  }, total2, { timeout: 10000 });
  const nommees = await page.locator('[data-recap] .ligne dt').allTextContents();
  dire(nommees.some((l) => /aller simple/i.test(l)), 'l’aller simple apparaît en ligne nommée');

  /* L'acompte vaut bien le quart du total, et le dépôt est annoncé à part. */
  const total3 = montant(await page.locator('.ligne--total dd').textContent());
  const acompte = montant(await page.locator('.ligne--acompte dd').textContent());
  dire(Math.abs(acompte - Math.round(total3 * 0.25)) <= 1,
       'l’acompte vaut le quart du total, assiette dite', `${acompte} € sur ${total3} €`);
  dire(/900/.test((await page.locator('.recap__aprevoir').textContent()) || ''),
       'le dépôt de garantie est annoncé à part du total');

  /* Le parcours va jusqu'au bout et dit qu'il n'encaisse rien. */
  await page.locator('[data-valider]').click();
  await page.waitForFunction(() => {
    const e = document.querySelector('[data-reponse]');
    return e && !e.hidden && !/Vérification/.test(e.textContent);
  }, null, { timeout: 15000 });
  const rep = (await page.locator('[data-reponse]').textContent())?.trim() || '';
  dire(/aucune carte/i.test(rep), 'l’acompte se déroule et annonce qu’il n’encaisse rien', rep.slice(0, 58));

  /* Une date passée est refusée, avec sa cause propre. */
  await page.fill('input[name="prise"]', '2026-01-05');
  await page.locator('input[name="prise"]').dispatchEvent('change');
  await page.locator('[data-valider]').click();
  await page.waitForFunction(() => {
    const e = document.querySelector('[data-reponse]');
    return e && !/Vérification/.test(e.textContent);
  }, null, { timeout: 15000 });
  const refus = (await page.locator('[data-reponse]').textContent())?.trim() || '';
  dire(/pass/i.test(refus), 'une date passée est refusée en nommant sa cause', refus.slice(0, 52));

  /* Le sélecteur de langue mène à la page équivalente. */
  await page.goto(`${BASE}/conditions/`, { waitUntil: 'networkidle' });
  const jumelle = await page.locator('.tete__langue').getAttribute('href');
  dire(!!jumelle && jumelle.endsWith('/en/terms/'), 'le sélecteur de langue mène à la page équivalente', jumelle || '');

  /* Les questions s'ouvrent, la première est servie ouverte. */
  await page.goto(`${BASE}/questions/`, { waitUntil: 'networkidle' });
  const ouvertes = await page.locator('details[open]').count();
  dire(ouvertes === 1, 'une seule question est servie ouverte', `${ouvertes}`);

  await ctx.close();
}

await nav.close();
const rates = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length} contrôles · ${rates} échec(s)`);
process.exit(rates ? 1 : 0);
