/**
 * LA PHOTOGRAPHIE D'OUVERTURE, CALCULÉE UNE FOIS POUR DEUX LECTEURS.
 *
 * La page en a besoin pour la PRÉCHARGER depuis la tête du document ; le
 * composant en a besoin pour l'AFFICHER. Les deux doivent demander exactement
 * les mêmes largeurs et le même format, sans quoi le navigateur précharge une
 * image et en télécharge une autre — le préchargement ne sert alors qu'à
 * doubler le poids de la page.
 *
 * Un « export » d'un composant Astro est évalué hors du rendu : il ne voit pas
 * les variables du frontmatter. D'où ce module, qui est le seul endroit où ces
 * largeurs sont écrites.
 */
import { getImage } from 'astro:assets';
import ouverture from '../assets/photos/ouverture.jpg';

const LARGEURS = [640, 1100, 1600, 2200];
export const SIZES = '(min-width: 60rem) 52vw, 100vw';

export async function imagesOuverture() {
  const [avif, webp, repli] = await Promise.all([
    getImage({ src: ouverture, widths: LARGEURS, format: 'avif', quality: 60 }),
    getImage({ src: ouverture, widths: LARGEURS, format: 'webp', quality: 72 }),
    getImage({ src: ouverture, width: 1400, format: 'webp', quality: 72 }),
  ]);
  return { avif, webp, repli, sizes: SIZES, largeur: ouverture.width, hauteur: ouverture.height };
}

/** Ce que Base.astro attend pour poser le <link rel="preload">. */
export async function prechargeOuverture() {
  const { avif } = await imagesOuverture();
  return [{ srcset: avif.srcSet.attribute, sizes: SIZES, type: 'image/avif' }];
}
