/**
 * LA DEMANDE DE DEVIS.
 *
 * MODE DÉMONSTRATION : la fonction vérifie tout ce qu'un vrai traitement
 * vérifierait, puis s'arrête et le dit. Rien n'est envoyé, rien n'est écrit,
 * et les photographies sont comptées puis oubliées.
 *
 * ELLE REDIRIGE PLUTÔT QUE DE RÉPONDRE DU JSON. Un navigateur sans script
 * poste ce formulaire comme n'importe quel formulaire et attend une page ; lui
 * rendre du JSON brut lui afficherait du code à la place d'un remerciement.
 * On distingue les deux cas sur l'en-tête « accept ».
 *
 * LA LISTE DES COMMUNES VIENT DU CONTENU, jamais d'une copie : c'est la même
 * source que le menu déroulant de la page. Deux listes finiraient par
 * diverger, et le serveur refuserait une commune que la page propose.
 */
import contenu from '../../src/data/contenu.json' with { type: 'json' };

const COMMUNES = new Set(contenu.zone.groupes.flatMap((g) => g.communes));
const BESOINS = new Set(contenu.devis.besoins.map((b) => b.id));
const DELAIS = new Set(contenu.devis.delais.map((d) => d.id));

const PHOTOS_MAX = 4;
const POIDS_MAX = 5 * 1024 * 1024;

const MESSAGES = {
  corps: 'Demande illisible.',
  besoin: 'Choisissez le type de besoin.',
  pieces: 'Le nombre de pièces doit être compris entre 1 et 12.',
  surface: 'La surface doit être comprise entre 5 et 600 mètres carrés.',
  commune: 'Choisissez une commune de la zone d’intervention.',
  delai: 'Indiquez le délai souhaité.',
  nom: 'Indiquez votre nom.',
  telephone: 'Indiquez un numéro de téléphone joignable.',
  courriel: 'Cette adresse électronique paraît incomplète.',
  photosNombre: `Quatre photographies au plus, et ${PHOTOS_MAX} ont été dépassées.`,
  photosPoids: 'Chaque photographie doit peser cinq mégaoctets au plus.',
  photosType: 'Seules des images peuvent être jointes.',
  consentement: 'Votre accord est nécessaire pour vous répondre.',
  recu: 'Bien reçu. Sur le site d’un vrai artisan, un devis chiffré suivrait sous 24 heures ouvrées.',
};

const MERCI = '/devis/merci/';

export default async (requete) => {
  if (requete.method !== 'POST') {
    return Response.json({ message: 'POST attendu.' }, { status: 405 });
  }

  const type = requete.headers.get('content-type') || '';
  const veutPage = (requete.headers.get('accept') || '').includes('text/html');

  let champs;
  let photos = [];
  try {
    if (type.includes('application/json')) {
      champs = await requete.json();
    } else {
      const form = await requete.formData();
      champs = Object.fromEntries(
        [...form.entries()].filter(([, v]) => typeof v === 'string'),
      );
      photos = form.getAll('photos').filter((f) => typeof f === 'object' && f.size > 0);
    }
  } catch {
    return rater(MESSAGES.corps, veutPage, requete);
  }

  /* Champ piège : rempli, c'est un robot. On répond comme si de rien n'était —
     un refus explicite lui apprendrait à contourner. */
  if (String(champs.site || '').trim() !== '') {
    return reussir({ mode: 'demonstration', message: MESSAGES.recu }, veutPage, requete);
  }

  if (!BESOINS.has(String(champs.besoin || ''))) return rater(MESSAGES.besoin, veutPage, requete);

  const pieces = Number(champs.pieces);
  if (!Number.isInteger(pieces) || pieces < 1 || pieces > 12) {
    return rater(MESSAGES.pieces, veutPage, requete);
  }

  /* La surface est facultative : vide, elle passe ; renseignée, elle est tenue
     de rester plausible. */
  if (String(champs.surface || '').trim() !== '') {
    const surface = Number(champs.surface);
    if (!Number.isFinite(surface) || surface < 5 || surface > 600) {
      return rater(MESSAGES.surface, veutPage, requete);
    }
  }

  if (!COMMUNES.has(String(champs.commune || ''))) return rater(MESSAGES.commune, veutPage, requete);
  if (!DELAIS.has(String(champs.delai || ''))) return rater(MESSAGES.delai, veutPage, requete);
  if (!String(champs.nom || '').trim()) return rater(MESSAGES.nom, veutPage, requete);

  /* Un numéro joignable : au moins huit chiffres, quels que soient les espaces,
     les points et l'indicatif. On ne cherche pas à valider un format — les
     gens écrivent leur numéro comme ils veulent, et c'est leur droit. */
  const chiffres = String(champs.telephone || '').replace(/\D/g, '');
  if (chiffres.length < 8) return rater(MESSAGES.telephone, veutPage, requete);

  const courriel = String(champs.courriel || '').trim();
  if (courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(courriel)) {
    return rater(MESSAGES.courriel, veutPage, requete);
  }

  if (photos.length > PHOTOS_MAX) return rater(MESSAGES.photosNombre, veutPage, requete);
  for (const p of photos) {
    if (p.size > POIDS_MAX) return rater(MESSAGES.photosPoids, veutPage, requete);
    if (!String(p.type || '').startsWith('image/')) return rater(MESSAGES.photosType, veutPage, requete);
  }

  if (!champs.consentement) return rater(MESSAGES.consentement, veutPage, requete);

  /* ----- Passage au réel ---------------------------------------------------
     C'est ICI qu'un courriel partirait, avec les photographies en pièces
     jointes. Tout ce qui précède reste identique : la demande a déjà été
     vérifiée, et les fichiers pesés. La démonstration s'arrête à la
     vérification, et l'annonce.
     --------------------------------------------------------------------- */

  return reussir(
    {
      mode: 'demonstration',
      message: MESSAGES.recu,
      besoin: champs.besoin,
      pieces,
      commune: champs.commune,
      delai: champs.delai,
      photos: photos.length,
    },
    veutPage,
    requete,
  );
};

const reussir = (corps, veutPage, requete) =>
  veutPage ? Response.redirect(new URL(MERCI, requete.url), 303) : Response.json(corps);

const rater = (message, veutPage, requete) =>
  veutPage
    ? Response.redirect(new URL(`/devis/?erreur=${encodeURIComponent(message)}#erreur`, requete.url), 303)
    : Response.json({ message }, { status: 400 });

export const config = { path: '/api/devis' };
