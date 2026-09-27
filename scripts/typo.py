# -*- coding: utf-8 -*-
"""La convention typographique du fichier, relevée sur ses 130 occurrences :

  U+00A0 insécable       avant  :  %  €   et à l'intérieur des guillemets
  U+202F fine insécable  avant  ;  ?  !

Elle s'applique partout sauf dans les adresses et les identifiants.
"""
NBSP = ' '
FINE = ' '
AP = '’'
ESPACES = (' ', NBSP, FINE)
SANS = {'url', 'lien', 'id', 'chemin', 'href', 'secteur', 'demos'}


def fr(x):
    y = x.replace("'", AP)
    for signe, espace in ((':', NBSP), ('%', NBSP), ('€', NBSP),
                          (';', FINE), ('?', FINE), ('!', FINE)):
        for e in ESPACES:
            y = y.replace(e + signe, espace + signe)
    for e in ESPACES:
        y = y.replace('«' + e, '«' + NBSP).replace(e + '»', NBSP + '»')
    return y


def normalise(o, chemin='', journal=None):
    if journal is None:
        journal = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k in SANS:
                continue
            if isinstance(v, str):
                n = v if k.startswith('$') else fr(v)
                if k.startswith('$'):
                    n = n.replace(AP, "'")
                if n != v:
                    journal.append(f'{chemin}.{k}')
                    o[k] = n
            else:
                normalise(v, f'{chemin}.{k}', journal)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if isinstance(v, str):
                n = fr(v)
                if n != v:
                    journal.append(f'{chemin}[{i}]')
                    o[i] = n
            else:
                normalise(v, f'{chemin}[{i}]', journal)
    return journal
