/**
 * LA PRISE DE RENDEZ-VOUS.
 *
 * MODE DÉMONSTRATION : la fonction vérifie tout ce qu'un vrai traitement
 * vérifierait, puis s'arrête et le dit. Aucun rendez-vous n'est inscrit nulle
 * part, et le créneau reste libre pour le visiteur suivant.
 *
 * LA DISPONIBILITÉ EST REVÉRIFIÉE ICI, jamais crue sur parole : la page peut
 * avoir été ouverte la veille, ou modifiée dans le navigateur.
 *
 * CHAQUE REFUS NOMME SA CAUSE. Une date passée, un jour fermé et un créneau
 * pris envoient chercher trois choses différentes ; les confondre ferait
 * tourner le visiteur en rond.
 */
import contenu from '../../src/data/contenu.json' with { type: 'json' };
import { verifie, CRENEAUX } from '../../src/lib/rendezvous.mjs';

const COMMUNES = new Set(contenu.zone.groupes.flatMap((g) => g.communes));
const MOTIFS = contenu.rendezvous.motifs;
const MERCI = '/rendez-vous/merci/';

const MESSAGES = {
  corps: 'Demande illisible.',
  creneau: 'Choisissez un créneau.',
  commune: 'Choisissez une commune de la zone d’intervention.',
  nom: 'Indiquez votre nom.',
  telephone: 'Indiquez un numéro de téléphone joignable.',
  consentement: 'Votre accord est nécessaire pour vous répondre.',
  recu: 'C’est noté. Sur le site d’un vrai artisan, une confirmation partirait par courriel.',
};

export default async (requete) => {
  if (requete.method !== 'POST') {
    return Response.json({ message: 'POST attendu.' }, { status: 405 });
  }

  const type = requete.headers.get('content-type') || '';
  const veutPage = (requete.headers.get('accept') || '').includes('text/html');

  let champs;
  try {
    champs = type.includes('application/json')
      ? await requete.json()
      : Object.fromEntries(await requete.formData());
  } catch {
    return rater(MESSAGES.corps, veutPage, requete);
  }

  if (String(champs.site || '').trim() !== '') {
    return reussir({ mode: 'demonstration', message: MESSAGES.recu }, veutPage, requete);
  }

  /* Le créneau voyage en un seul champ — « 2026-09-28#matin-1 » — parce qu'un
     jour et une heure séparés peuvent arriver dépareillés. */
  const [date, id] = String(champs.creneau || '').split('#');
  if (!date || !id) return rater(MESSAGES.creneau, veutPage, requete, 'inconnu');

  const verdict = verifie({ date, creneau: id });
  if (!verdict.ok) {
    return rater(MOTIFS[verdict.motif] ?? MOTIFS.inconnu, veutPage, requete, verdict.motif);
  }

  if (!COMMUNES.has(String(champs.commune || ''))) return rater(MESSAGES.commune, veutPage, requete);
  if (!String(champs.nom || '').trim()) return rater(MESSAGES.nom, veutPage, requete);
  if (String(champs.telephone || '').replace(/\D/g, '').length < 8) {
    return rater(MESSAGES.telephone, veutPage, requete);
  }
  if (!champs.consentement) return rater(MESSAGES.consentement, veutPage, requete);

  /* ----- Passage au réel ---------------------------------------------------
     C'est ICI que le créneau serait inscrit et la confirmation envoyée. Tout
     ce qui précède reste identique : le créneau a déjà été revérifié.
     --------------------------------------------------------------------- */

  const c = CRENEAUX.find((x) => x.id === id);
  return reussir(
    {
      mode: 'demonstration',
      message: MESSAGES.recu,
      date: verdict.date,
      debut: c.debut,
      fin: c.fin,
      commune: champs.commune,
    },
    veutPage,
    requete,
  );
};

const reussir = (corps, veutPage, requete) =>
  veutPage ? Response.redirect(new URL(MERCI, requete.url), 303) : Response.json(corps);

const rater = (message, veutPage, requete, motif) =>
  veutPage
    ? Response.redirect(
        new URL(`/rendez-vous/?erreur=${encodeURIComponent(message)}#erreur`, requete.url),
        303,
      )
    : Response.json(motif ? { message, motif } : { message }, { status: motif === 'pris' || motif === 'date-passee' ? 409 : 400 });

export const config = { path: '/api/rendez-vous' };
