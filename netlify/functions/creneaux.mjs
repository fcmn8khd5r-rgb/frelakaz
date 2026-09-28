/**
 * LES CRÉNEAUX À VENIR.
 *
 * POURQUOI CETTE FONCTION EXISTE ALORS QUE LA PAGE EST STATIQUE. Un site
 * construit une fois pour toutes fige son calendrier au jour de la
 * construction : demain, il proposerait encore les créneaux d'hier. La page
 * est donc rendue avec l'état du jour de la construction — pour qu'elle ne
 * soit jamais vide, et qu'elle serve même sans script — puis rafraîchie au
 * chargement par cette fonction, qui, elle, connaît la date du jour.
 *
 * Le calcul vit dans src/lib/rendezvous.mjs — le MÊME module que la page. Deux
 * calculs finiraient par diverger, et l'affiché contredirait le confirmé.
 */
import { journees } from '../../src/lib/rendezvous.mjs';

/* Court : le calendrier change d'un jour à l'autre, et une minute de cache
   suffit à absorber un rafraîchissement répété. */
const CACHE_S = 60;
const JOURS_MAX = 35;

export default async (requete) => {
  const url = new URL(requete.url);
  const jours = Math.min(Math.max(Number(url.searchParams.get('jours') || 21), 1), JOURS_MAX);
  return Response.json(
    { mode: 'demonstration', journees: journees(new Date(), jours) },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_S}` } },
  );
};

export const config = { path: '/api/creneaux' };
