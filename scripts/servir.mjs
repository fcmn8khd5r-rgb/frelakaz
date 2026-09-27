/**
 * Un serveur statique pour les contrôles. On sert « dist », JAMAIS le serveur
 * de développement : son rechargement à chaud perd la position de défilement
 * entre deux appels et les captures tombent au mauvais endroit.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../dist');
/* Un port À LUI. Balaou sert sur 4455, Woulé sur 4477 : deux sites sur le même
   port, et l'on mesure l'un en croyant mesurer l'autre — c'est arrivé. */
const PORT = Number(process.env.PORT || 4488);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

/* LES FONCTIONS, SERVIES COMME EN LIGNE.
   Sans cela, le devis et les créneaux ne peuvent être éprouvés qu'une fois
   déployés — et c'est ainsi qu'un défaut de production passe inaperçu en
   local. On monte les mêmes modules, sous les mêmes adresses. */
const FONCTIONS = {};
for (const nom of ['devis', 'creneaux', 'rendez-vous']) {
  /* Une fonction pas encore écrite ne doit pas empêcher de servir le site :
     autrement, le serveur meurt au démarrage et l'on mesure un port muet en
     croyant mesurer une page. */
  try {
    FONCTIONS[`/api/${nom}`] = (await import(`../netlify/functions/${nom}.mjs`)).default;
  } catch {
    console.log(`  (fonction « ${nom} » absente — non montée)`);
  }
}

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  const fonction = FONCTIONS[url];
  if (fonction) {
    const complet = `http://${req.headers.host}${req.url}`;
    const corps = ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
    const reponse = await fonction(new Request(complet, { method: req.method, headers: req.headers, body: corps }));
    res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
    res.end(Buffer.from(await reponse.arrayBuffer()));
    return;
  }

  let fichier = path.join(RACINE, url);
  try {
    if ((await stat(fichier)).isDirectory()) fichier = path.join(fichier, 'index.html');
  } catch {
    fichier = path.join(RACINE, '404.html');
  }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`dist servi sur http://127.0.0.1:${PORT}`));
