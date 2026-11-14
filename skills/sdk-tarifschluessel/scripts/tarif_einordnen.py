#!/usr/bin/env python3
"""SDK-Tarife anhand des Tarifschlüssels einordnen.

Aufrufe:
  tarif_einordnen.py nachschlagen A107a S30a "TA6/160" BE375
  tarif_einordnen.py excel EINGABE.xlsx --spalte Tarif [--blatt NAME] [--summe Monatsbeitrag] [--aus AUSGABE.xlsx]
  tarif_einordnen.py csv EINGABE.csv --spalte Tarif [--aus AUSGABE.csv]
  tarif_einordnen.py pruefen EINGABE.xlsx --spalte Tarif [--blatt NAME]      (nur Bericht, ändert nichts)

Als Modul:  from tarif_einordnen import einordnen;  einordnen("A20a") -> dict
Arbeitet rein lokal, ohne Netzwerk. Die Eingabedatei wird nie überschrieben.
"""
import argparse, csv, collections, json, os, re, sys

HIER = os.path.dirname(os.path.abspath(__file__))
VERZEICHNIS_DATEI = os.path.join(HIER, '..', 'references', 'tarifschluessel.csv')
WELTEN = {'a': 'Alte Tarifwelt (Bisex, vor 2009)', 'n': 'Neue Tarifwelt (Bisex, 2009–2013)', 'u': 'Unisex', 'z': 'Modifizierte Kostensätze'}

# Reihenfolge zählt: die erste passende Regel gewinnt.
KATEGORIEN = [
    (r'Pflegepflicht', 'Pflegepflicht'), (r'Pflege', 'Pflegezusatz'), (r'Beitragsentlastung', 'Beitragsentlastung'),
    (r'Krankentagegeld', 'Krankentagegeld'), (r'Krankenhaustagegeld', 'Krankenhaustagegeld'),
    (r'Standardtarif|asistarif|otlagentarif', 'Sozialtarif'), (r'Unfall', 'Unfall'), (r'Ausland', 'Ausland'),
    (r'Sterbegeld|Renten|Beitragsfreistellung', 'Leben und Vorsorge'), (r'Zahn', 'Zahn'), (r'Naturheil|Heilpraktiker', 'Naturheilverfahren'),
    (r'Vorsorgetarif', 'Vorsorge'), (r'mbulant', 'Ambulant'), (r'tationär', 'Stationär'), (r'Gesetzlicher Zuschlag', 'Gesetzlicher Zuschlag'),
    (r'Ergänzungstarif', 'Ergänzung'), (r'Optionstarif', 'Option'),
]
SPALTEN = ['Tarif (erkannt)', 'Beschreibung', 'Kategorie', 'Beihilfe', 'Voll/Zusatz', 'Tarifwelt', 'Zielgruppe', 'Status']

_verz = None
def verzeichnis():
    """Tarif -> Beschreibung (aus references/tarifschluessel.csv)."""
    global _verz
    if _verz is None:
        _verz = collections.OrderedDict()
        with open(VERZEICHNIS_DATEI, encoding='utf-8', newline='') as f:
            for z in csv.DictReader(f, delimiter=';'):
                _verz[z['Tarif']] = z['Beschreibung']
        _verz_klein = {}
        for t in _verz: _verz_klein.setdefault(t.lower(), t)
        verzeichnis.klein = _verz_klein
    return _verz

def _aus_beschreibung(b):
    kat = next((k for muster, k in KATEGORIEN if re.search(muster, b)), 'Sonstige')
    beihilfe = bool(re.search(r'Beihilfe|Beamtenanwärter', b))
    zusatz = bool(re.search(r'Ergänzungs|Zusatz|Zahnersatz|GKV|mhplus|agegeld', b)) and not beihilfe
    if kat in ('Pflegepflicht', 'Sozialtarif', 'Beitragsentlastung', 'Gesetzlicher Zuschlag'): art = 'Voll'
    elif kat in ('Unfall',): art = 'Unfall'
    elif kat in ('Leben und Vorsorge',): art = 'Leben'
    elif kat in ('Pflegezusatz', 'Ausland', 'Krankenhaustagegeld', 'Naturheilverfahren', 'Vorsorge', 'Option') or zusatz: art = 'Zusatz'
    else: art = 'Voll'
    ziel = ('Firmen (bKV)' if 'Firmen' in b else 'Gruppenversicherung' if re.search(r'gen\. Organisationen|Gruppen', b) else
            'Kooperationspartner' if 'Kooperationspartner' in b else 'mhplus' if 'mhplus' in b else 'GKV-Mitglieder' if 'GKV' in b else '')
    return kat, beihilfe, art, ziel

def einordnen(tarif):
    """Einen Tarif einordnen. Status: bekannt | abgeleitet | unbekannt.

    abgeleitet = nicht exakt im Verzeichnis, aber über Schreibweise, Zusatz (z. B. TA6/160) oder Tariffamilie zugeordnet.
    """
    roh = '' if tarif is None else str(tarif).strip()
    if re.fullmatch(r'\d+\.0', roh): roh = roh[:-2]
    o = {'eingabe': roh, 'tarif': '', 'beschreibung': '', 'kategorie': '', 'beihilfe': None, 'art': '', 'welt': '', 'weltname': '', 'zielgruppe': '', 'status': 'unbekannt', 'hinweis': ''}
    if not roh: o['status'] = 'leer'; return o
    v = verzeichnis(); klein = verzeichnis.klein
    kandidaten = [(roh, 'bekannt', '')]
    kern = re.split(r'[\s/(]', roh)[0]
    if kern != roh: kandidaten.append((kern, 'abgeleitet', 'Zusatz „%s" ignoriert' % roh[len(kern):].strip()))
    for basis in (roh, kern):
        if basis.lower() in klein and klein[basis.lower()] != basis: kandidaten.append((klein[basis.lower()], 'abgeleitet', 'Schreibweise angepasst'))
    treffer = next(((t, s, h) for t, s, h in kandidaten if t in v), None)
    if not treffer:
        # Endung ergänzen: A107 -> A107a/A107n/A107u, wenn alle dieselbe Beschreibung haben
        fam = [t for t in (kern + e for e in 'anuz') if t in v]
        if not fam:
            stamm = re.sub(r'\d+$', '', kern)        # BE375 -> BE, U350 bleibt exakt
            if stamm and stamm != kern: fam = [t for t in (stamm + e for e in ('', 'a', 'n', 'u', 'z')) if t in v]
        if fam:
            beschr = {v[t] for t in fam}
            treffer = (fam[0], 'abgeleitet', 'Tariffamilie %s' % '/'.join(fam) + ('' if len(beschr) == 1 else ' (Beschreibungen weichen ab)'))
    if not treffer:
        o['hinweis'] = 'nicht im Tarifschlüssel (Stand 11.06.2021)'
        return o
    t, status, hinweis = treffer
    kat, beihilfe, art, ziel = _aus_beschreibung(v[t])
    o.update(tarif=t, beschreibung=v[t], kategorie=kat, beihilfe=beihilfe, art=art, zielgruppe=ziel, status=status, hinweis=hinweis)
    m = re.fullmatch(r'[A-Z0-9][A-Za-z0-9]*?([anuz])', roh if status == 'bekannt' else kern)
    if m and (roh if status == 'bekannt' else kern) in v: o['welt'] = m.group(1); o['weltname'] = WELTEN[m.group(1)]
    if re.match(r'PG\d[AS]?D', t): o['hinweis'] = (o['hinweis'] + '; ' if o['hinweis'] else '') + 'mit Dynamik über das 70. Lebensjahr'
    return o

def zerlege(zelle):
    """Zelle mit mehreren Tarifen aufteilen: 'AM13, S3, Z6, TA6/ 160, BE375' -> ['AM13','S3','Z6','TA6/160','BE375']"""
    s = '' if zelle is None else str(zelle)
    s = re.sub(r'\s*/\s*', '/', s)
    return [t for t in re.split(r'[,;+\n]|\s{2,}|(?<=\S)\s+(?=[A-Za-z])', s) if t and t.strip()] if s.strip() else []

def zeile_werte(zelle):
    """Werte für die Zusatzspalten einer Zelle (auch bei mehreren Tarifen)."""
    teile = [einordnen(t) for t in zerlege(zelle)]
    if not teile: return [''] * len(SPALTEN), []
    def j(f): return ' | '.join(dict.fromkeys(x for x in (f(e) for e in teile) if x))
    status = 'unbekannt' if any(e['status'] == 'unbekannt' for e in teile) else 'abgeleitet' if any(e['status'] == 'abgeleitet' for e in teile) else 'bekannt'
    bh = [e['beihilfe'] for e in teile if e['beihilfe'] is not None]
    return [j(lambda e: e['tarif'] or e['eingabe']), j(lambda e: e['beschreibung']), j(lambda e: e['kategorie']),
            ('ja' if any(bh) else 'nein') if bh else '', j(lambda e: e['art']), j(lambda e: e['weltname']), j(lambda e: e['zielgruppe']), status], teile

def _finde_kopf(ws, spalte, max_zeilen=30):
    ziel = re.sub(r'[^a-z0-9]', '', spalte.lower())
    for r in range(1, min(ws.max_row, max_zeilen) + 1):
        for c in range(1, ws.max_column + 1):
            v = ws.cell(r, c).value
            if v is not None and re.sub(r'[^a-z0-9]', '', str(v).lower()) == ziel: return r, c
    raise SystemExit('Spalte „%s" nicht gefunden (gesucht in den ersten %d Zeilen von Blatt „%s").' % (spalte, max_zeilen, ws.title))

def _bericht(stat, unbekannt, abgeleitet, summenname):
    z = ['Zeilen mit Tarif: %d · bekannt %d · abgeleitet %d · unbekannt %d' % (stat['zeilen'], stat['bekannt'], stat['abgeleitet'], stat['unbekannt'])]
    z.append('Nach Kategorie (Anzahl%s):' % (', Summe ' + summenname if summenname else ''))
    for k, (n, s) in sorted(stat['kat'].items(), key=lambda x: -x[1][0]):
        z.append('  %-28s %6d%s' % (k, n, ('  %12.2f' % s) if summenname else ''))
    if abgeleitet: z.append('Abgeleitet (bitte prüfen): ' + ', '.join('%s→%s (%d×)' % (a, b, n) for (a, b), n in abgeleitet.most_common(25)))
    if unbekannt: z.append('Unbekannt: ' + ', '.join('%s (%d×)' % x for x in unbekannt.most_common(40)))
    return '\n'.join(z)

def _zaehle(stat, unbekannt, abgeleitet, werte, teile, betrag):
    stat['zeilen'] += 1; stat[werte[7]] += 1
    for e in teile:
        k = ('Beihilfe · ' if e['beihilfe'] else '') + (e['kategorie'] or 'Unbekannt')
        n, s = stat['kat'].get(k, (0, 0.0)); stat['kat'][k] = (n + 1, s + (betrag / len(teile) if betrag else 0.0))
        if e['status'] == 'unbekannt': unbekannt[e['eingabe']] += 1
        elif e['status'] == 'abgeleitet': abgeleitet[(e['eingabe'], e['tarif'])] += 1

def excel(args, schreiben=True):
    import openpyxl
    from openpyxl.styles import PatternFill, Font
    makro = args.eingabe.lower().endswith('.xlsm')
    wb = openpyxl.load_workbook(args.eingabe, keep_vba=makro)
    ws = wb[args.blatt] if args.blatt else wb.active
    kr, kc = _finde_kopf(ws, args.spalte)
    sc = _finde_kopf(ws, args.summe)[1] if args.summe else None
    stat = collections.Counter(); stat = {'zeilen': 0, 'bekannt': 0, 'abgeleitet': 0, 'unbekannt': 0, 'kat': {}}
    unbekannt, abgeleitet = collections.Counter(), collections.Counter()
    start = ws.max_column + 1
    farben = {'unbekannt': PatternFill('solid', fgColor='F9D6D6'), 'abgeleitet': PatternFill('solid', fgColor='FFF0C4')}
    if schreiben:
        for i, name in enumerate(SPALTEN):
            c = ws.cell(kr, start + i, name); c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='6250D6')
            ws.column_dimensions[c.column_letter].width = 44 if name == 'Beschreibung' else 18
    for r in range(kr + 1, ws.max_row + 1):
        zelle = ws.cell(r, kc).value
        if zelle is None or str(zelle).strip() == '': continue
        werte, teile = zeile_werte(zelle)
        betrag = ws.cell(r, sc).value if sc else None
        _zaehle(stat, unbekannt, abgeleitet, werte, teile, betrag if isinstance(betrag, (int, float)) else 0)
        if schreiben:
            for i, w in enumerate(werte):
                c = ws.cell(r, start + i, w)
                if i == 7 and w in farben: c.fill = farben[w]
    bericht = _bericht(stat, unbekannt, abgeleitet, args.summe)
    if schreiben:
        if 'Tarif-Auswertung' in wb.sheetnames: del wb['Tarif-Auswertung']
        aw = wb.create_sheet('Tarif-Auswertung')
        aw.append(['Kategorie', 'Anzahl'] + ([('Summe ' + args.summe)] if args.summe else []))
        for c in aw[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='6250D6')
        for k, (n, s) in sorted(stat['kat'].items(), key=lambda x: -x[1][0]): aw.append([k, n] + ([round(s, 2)] if args.summe else []))
        aw.append([]); aw.append(['Status', 'Zeilen'])
        for k in ('bekannt', 'abgeleitet', 'unbekannt'): aw.append([k, stat[k]])
        if unbekannt:
            aw.append([]); aw.append(['Unbekannte Tarife', 'Vorkommen'])
            for t, n in unbekannt.most_common(): aw.append([t, n])
        if abgeleitet:
            aw.append([]); aw.append(['Abgeleitet: Eingabe', 'zugeordnet zu', 'Vorkommen'])
            for (a, b), n in abgeleitet.most_common(): aw.append([a, b, n])
        aw.column_dimensions['A'].width = 34; aw.column_dimensions['B'].width = 16; aw.column_dimensions['C'].width = 18
        aus = args.aus or re.sub(r'(\.xls[xm])$', r'_tarife\1', args.eingabe, flags=re.I)
        if os.path.abspath(aus) == os.path.abspath(args.eingabe): raise SystemExit('Die Eingabedatei wird nicht überschrieben – bitte --aus mit anderem Namen angeben.')
        wb.save(aus); bericht += '\nGeschrieben: ' + aus
    print(bericht)

def csvdatei(args):
    roh = open(args.eingabe, 'rb').read()
    try: text = roh.decode('utf-8-sig')
    except UnicodeDecodeError: text = roh.decode('cp1252')
    trenn = max(';,\t', key=lambda t: text.split('\n', 1)[0].count(t))
    zeilen = list(csv.reader(text.splitlines(), delimiter=trenn))
    ziel = re.sub(r'[^a-z0-9]', '', args.spalte.lower())
    kr, kc = next(((r, c) for r, z in enumerate(zeilen[:30]) for c, v in enumerate(z) if re.sub(r'[^a-z0-9]', '', v.lower()) == ziel), (None, None))
    if kr is None: raise SystemExit('Spalte „%s" nicht gefunden.' % args.spalte)
    stat = {'zeilen': 0, 'bekannt': 0, 'abgeleitet': 0, 'unbekannt': 0, 'kat': {}}; unbekannt, abgeleitet = collections.Counter(), collections.Counter()
    zeilen[kr] += SPALTEN
    for z in zeilen[kr + 1:]:
        if kc >= len(z) or not z[kc].strip(): continue
        werte, teile = zeile_werte(z[kc]); _zaehle(stat, unbekannt, abgeleitet, werte, teile, 0); z += werte
    aus = args.aus or re.sub(r'\.csv$', '_tarife.csv', args.eingabe, flags=re.I)
    if os.path.abspath(aus) == os.path.abspath(args.eingabe): raise SystemExit('Die Eingabedatei wird nicht überschrieben.')
    with open(aus, 'w', encoding='utf-8-sig', newline='') as f: csv.writer(f, delimiter=';').writerows(zeilen)
    print(_bericht(stat, unbekannt, abgeleitet, None) + '\nGeschrieben: ' + aus)

def main():
    p = argparse.ArgumentParser(description='SDK-Tarife anhand des Tarifschlüssels einordnen')
    sub = p.add_subparsers(dest='modus', required=True)
    n = sub.add_parser('nachschlagen'); n.add_argument('tarife', nargs='+'); n.add_argument('--json', action='store_true')
    for name in ('excel', 'pruefen', 'csv'):
        q = sub.add_parser(name); q.add_argument('eingabe'); q.add_argument('--spalte', default='Tarif'); q.add_argument('--aus')
        if name != 'csv': q.add_argument('--blatt'); q.add_argument('--summe')
    a = p.parse_args()
    if a.modus == 'nachschlagen':
        erg = [einordnen(t) for zelle in a.tarife for t in zerlege(zelle)]
        if a.json: print(json.dumps(erg, ensure_ascii=False, indent=1)); return
        for e in erg:
            print('%-10s %-10s %s%s%s%s' % (e['eingabe'], e['status'], e['beschreibung'] or e['hinweis'], ' · Beihilfe' if e['beihilfe'] else '',
                  ' · ' + e['weltname'] if e['weltname'] else '', ' · [' + e['hinweis'] + ']' if e['hinweis'] and e['beschreibung'] else ''))
    elif a.modus == 'excel': excel(a)
    elif a.modus == 'pruefen': excel(a, schreiben=False)
    else: csvdatei(a)

if __name__ == '__main__':
    main()
