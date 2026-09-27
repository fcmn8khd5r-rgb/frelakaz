import type { APIRoute } from 'astro';
import data from '../data/contenu.json';

/* L'adresse vient de l'hébergeur au moment de construire, et le contenu ne
   sert que de repli : un plan de site qui désigne un domaine mort n'est pas
   lu deux fois. */
const base = (import.meta.env.SITE ?? data.site.url).replace(/\/$/, '');

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
