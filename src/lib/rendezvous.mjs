/**
 * LES CRÉNEAUX D'ENTRETIEN — LE SEUL ENDROIT OÙ ILS SE CALCULENT.
 *
 * Ce module est importé par la PAGE et par les FONCTIONS. Deux calculs
 * finiraient par diverger, et le créneau affiché contredirait le créneau
 * confirmé — c'est arrivé ailleurs sur un prix d'acompte, et cela se voit tout
 * de suite quand ça arrive.
 *
 * POURQUOI UNE EMPREINTE ET NON UN TIRAGE AU SORT. L'occupation doit être la
 * même à chaque affichage, sur le serveur comme dans le navigateur, et d'une
 * visite à l'autre. On la déduit donc de la date elle-même. La date sert de
 * graine ; l'empreinte transforme cette graine en un nombre.
 *
 * LE MÉLANGE FINAL N'EST PAS UNE COQUETTERIE. FNV-1a seul rend, pour deux
 * graines voisines — et deux jours consécutifs SONT voisins — deux valeurs
 * voisines : le calendrier affichait alors six jours pleins d'affilée puis dix
 * jours vides. Le mélange final de murmur3 disperse les bits de poids faible,
 * et l'occupation cesse de suivre le calendrier.
 *
 * CE QUI EST FERMÉ. Samedi et dimanche, et les jours fériés. Les onze jours
 * fériés nationaux de l'article L3133-1 du code du travail, plus le 27 mai,
 * commémoration de l'abolition de l'esclavage, que l'article L3422-2 désigne
 * comme jour férié en Guadeloupe. La mi-carême, le vendredi saint et le
 * 21 juillet sont chômés par l'usage dans l'archipel sans figurer dans ces
 * articles : ils ne sont donc PAS fermés ici, faute de pouvoir l'affirmer.
 */

/** Une journée UTC, en texte : « 2026-09-28 ». */
export const jour = (d) => d.toISOString().slice(0, 10);

/** Le texte inverse, ramené à minuit UTC — jamais à l'heure locale. */
export const versJour = (t) => new Date(`${t}T00:00:00Z`);

/**
 * FNV-1a 32 bits, SUIVI DU MÉLANGE FINAL DE MURMUR3.
 * Sans ce mélange, « 2026-10-01 » et « 2026-10-02 » rendent des valeurs
 * séparées d'une poignée d'unités.
 */
export function empreinte(chaine) {
  let h = 0x811c9dc5;
  for (let i = 0; i < chaine.length; i++) {
    h ^= chaine.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Dimanche de Pâques, algorithme de Meeus pour le calendrier grégorien. */
export function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jourDuMois = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jourDuMois));
}

const JOUR_MS = 86_400_000;
const decale = (d, n) => new Date(d.getTime() + n * JOUR_MS);

/** Les jours fériés d'une année, en Guadeloupe. */
export function feries(annee) {
  const p = paques(annee);
  const dates = [
    new Date(Date.UTC(annee, 0, 1)),   // Jour de l'an
    decale(p, 1),                      // Lundi de Pâques
    new Date(Date.UTC(annee, 4, 1)),   // Fête du travail
    new Date(Date.UTC(annee, 4, 8)),   // Victoire de 1945
    decale(p, 39),                     // Ascension
    decale(p, 50),                     // Lundi de Pentecôte
    new Date(Date.UTC(annee, 4, 27)),  // Abolition de l'esclavage — Guadeloupe
    new Date(Date.UTC(annee, 6, 14)),  // Fête nationale
    new Date(Date.UTC(annee, 7, 15)),  // Assomption
    new Date(Date.UTC(annee, 10, 1)),  // Toussaint
    new Date(Date.UTC(annee, 10, 11)), // Armistice
    new Date(Date.UTC(annee, 11, 25)), // Noël
  ];
  return new Set(dates.map(jour));
}

const cacheFeries = new Map();
export function estFerie(d) {
  const an = d.getUTCFullYear();
  if (!cacheFeries.has(an)) cacheFeries.set(an, feries(an));
  return cacheFeries.get(an).has(jour(d));
}

/** Lundi à vendredi, hors jours fériés. */
export const estOuvre = (d) => {
  const n = d.getUTCDay();
  return n >= 1 && n <= 5 && !estFerie(d);
};

/**
 * LE PASSÉ SE JUGE ICI, et non dans la page.
 * Le mois du premier jour libre est rendu ENTIER : les jours qui le précèdent
 * doivent donc savoir se déclarer passés, sans quoi le calendrier propose des
 * rendez-vous d'hier.
 */
export function estPasse(d, maintenant = new Date()) {
  const aujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate(),
  );
  return d.getTime() < aujourdhui;
}

/**
 * QUATRE CRÉNEAUX PAR JOUR OUVRÉ. Deux heures chacun, ce que demande un
 * entretien complet — la page le dit, et le calendrier ne promet rien d'autre.
 */
export const CRENEAUX = [
  { id: 'matin-1', debut: '07:30', fin: '09:30' },
  { id: 'matin-2', debut: '09:30', fin: '11:30' },
  { id: 'apres-1', debut: '13:00', fin: '15:00' },
  { id: 'apres-2', debut: '15:00', fin: '17:00' },
];

/* Quarante-cinq pour cent des créneaux sont pris. Mesuré : une journée
   entièrement complète arrive dans 4 % des cas — assez rare pour qu'on trouve
   toujours un rendez-vous dans la semaine, assez fréquent pour que le message
   « ce jour est complet » existe vraiment et soit éprouvé. */
const TAUX_OCCUPATION = 45;

/** Un créneau est-il libre, ce jour-là ? */
export function estLibre(d, idCreneau) {
  if (!estOuvre(d)) return false;
  return empreinte(`${jour(d)}#${idCreneau}`) % 100 >= TAUX_OCCUPATION;
}

/** Les quatre créneaux d'une journée, avec leur état. */
export function creneauxDu(d) {
  return CRENEAUX.map((c) => ({ ...c, libre: estLibre(d, c.id) }));
}

/** Une journée entière, telle que la page l'affiche. */
export function journee(d, maintenant = new Date()) {
  const passe = estPasse(d, maintenant);
  const ouvre = estOuvre(d);
  const creneaux = ouvre && !passe ? creneauxDu(d) : [];
  return {
    date: jour(d),
    ouvre,
    passe,
    creneaux,
    restants: creneaux.filter((c) => c.libre).length,
  };
}

/** Les « nombre » prochaines journées, à partir de « depuis » incluse. */
export function journees(depuis, nombre, maintenant = new Date()) {
  const out = [];
  const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()));
  for (let i = 0; i < nombre; i++) {
    out.push(journee(d, maintenant));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * LE PREMIER JOUR QUI OFFRE UN CRÉNEAU.
 * Le calendrier s'ouvre là, et non sur aujourd'hui : s'ouvrir sur un samedi
 * ou sur une journée complète donne l'impression d'un artisan débordé.
 */
export function premierJourLibre(maintenant = new Date()) {
  const d = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  );
  for (let i = 0; i <= 60; i++) {
    if (journee(d, maintenant).restants > 0) return new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

/**
 * LA VÉRIFICATION, REFAITE CÔTÉ SERVEUR.
 * Elle rend un motif NOMMÉ, jamais un simple faux : une date passée et un
 * créneau pris envoient chercher deux choses différentes, et les confondre
 * fait tourner le visiteur en rond.
 */
export function verifie({ date, creneau }, maintenant = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    return { ok: false, motif: 'inconnu' };
  }
  const d = versJour(date);
  if (Number.isNaN(d.getTime())) return { ok: false, motif: 'inconnu' };
  if (!CRENEAUX.some((c) => c.id === creneau)) return { ok: false, motif: 'inconnu' };
  if (estPasse(d, maintenant)) return { ok: false, motif: 'date-passee' };
  if (!estOuvre(d)) return { ok: false, motif: 'ferme' };
  if (!estLibre(d, creneau)) return { ok: false, motif: 'pris' };
  const c = CRENEAUX.find((x) => x.id === creneau);
  return { ok: true, date, creneau: c.id, debut: c.debut, fin: c.fin };
}
