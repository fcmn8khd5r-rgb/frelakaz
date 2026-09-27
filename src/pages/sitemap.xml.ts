import type { APIRoute } from 'astro';
import data from '../data/contenu.json';

const base = (import.meta.env.SITE ?? data.site.url).replace(/\/$/, '');

/**
 * Le plan du site. Les pages de confirmation et la page des adresses égarées
 * n'y figurent pas : elles portent « noindex », et déclarer dans un plan de
 * site une adresse qu'on demande d'écarter est contradictoire.
 */
export const GET: APIRoute = () => {
  const pages = [
    { chemin: '/', priorite: '1.0', frequence: 'monthly' },
    { chemin: '/devis/', priorite: '0.9', frequence: 'monthly' },
    { chemin: '/rendez-vous/', priorite: '0.9', frequence: 'monthly' },
    ...data.navigation.documents.map((d) => ({
      chemin: d.href,
      priorite: '0.3',
      frequence: 'yearly',
    })),
  ];
  const jour = new Date().toISOString().slice(0, 10);
  const corps = pages
    .map(
      (p) => `  <url>
    <loc>${new URL(p.chemin, `${base}/`).href}</loc>
    <lastmod>${jour}</lastmod>
    <changefreq>${p.frequence}</changefreq>
    <priority>${p.priorite}</priority>
  </url>`,
    )
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corps}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
