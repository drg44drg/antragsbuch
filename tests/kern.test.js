const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const AB = require('./lade.js');
const { erzeuge, KOPF, zeile, VM } = require('../tools/testdaten.js');
const U = AB.util, C = AB.csv, S = AB.abrechnung, M = AB.model, P = AB.provision;
const daten = erzeuge();

// ---------------- CSV-Parser ----------------
test('Kodierung: UTF-8, UTF-8 mit BOM und Windows-1252 – Umlaute stimmen', () => {
  const text = 'Name;Ort\r\nGrößmann, Jörg;Übungsheim\r\n';
  for (const [buf, kod] of [[Buffer.from(text, 'utf8'), 'UTF-8'], [Buffer.from('﻿' + text, 'utf8'), 'UTF-8 (BOM)'], [Buffer.from(text, 'latin1'), 'Windows-1252']]) {
    const r = C.lies(new Uint8Array(buf));
    assert.equal(r.kodierung, kod);
    assert.deepEqual(r.zeilen[1], ['Größmann, Jörg', 'Übungsheim']);
  }
  // typische Windows-1252-Zeichen außerhalb Latin-1 (€ = 0x80, „ = 0x84)
  assert.equal(C.dekodiere(new Uint8Array([0x80, 0x20, 0x84, 0xE4])).text, '€ „ä');
});

test('Trennzeichen: Semikolon, Komma, Tab werden erkannt', () => {
  assert.equal(C.erkenneTrennzeichen('a;b;c\n1;2;3\n'), ';');
  assert.equal(C.erkenneTrennzeichen('a,b,c\n1,2,3\n'), ',');
  assert.equal(C.erkenneTrennzeichen('a\tb\tc\n1\t2\t3\n'), '\t');
  assert.equal(C.erkenneTrennzeichen('Name;Betrag\n"Muster, Anna";1,50\n"Probe, Clara";2,75\n'), ';');
  assert.equal(C.erkenneTrennzeichen('Name,Betrag\n"Muster; Anna",1.50\n'), ',');
});

test('Anführungszeichen, eingebettete Trenner/Zeilenumbrüche, leere Zeilen', () => {
  const r = C.parse('a;b;c\r\n"x;y";"sagt ""Hallo""";"Zeile1\nZeile2"\r\n\r\n1;;3', ';');
  assert.deepEqual(r, [['a', 'b', 'c'], ['x;y', 'sagt "Hallo"', 'Zeile1\nZeile2'], ['1', '', '3']]);
  assert.deepEqual(C.parse('a;b\n1;2', ';'), [['a', 'b'], ['1', '2']]); // ohne Zeilenende am Schluss
});

test('Zahlen: deutsches und englisches Format, negativ, Währung', () => {
  const f = [['1.239,27', 1239.27], ['1239,27', 1239.27], ['1,239.27', 1239.27], ['-5,81', -5.81], ['5,81-', -5.81], ['(5,81)', -5.81],
    ['5,34 €', 5.34], ['0', 0], ['', 0], ['7', 7], ['5.34', 5.34], ['1.234', 1234], ['12.345.678,9', 12345678.9], ['−3,5', -3.5]];
  for (const [ein, soll] of f) assert.equal(U.parseZahl(ein), soll, ein);
  assert.equal(U.parseZahl('1.234', '.'), 1.234);
  assert.ok(isNaN(U.parseZahl('abc')));
  assert.equal(U.erkenneDezimal(['5,34', '1.239,27', '0']), ',');
  assert.equal(U.erkenneDezimal(['5.34', '1239.27']), '.');
});

test('Datum: deutsche, ISO- und Excel-Formate', () => {
  const f = [['02.01.2026', '2026-01-02'], ['2.1.26', '2026-01-02'], ['2026-01-02', '2026-01-02'], ['2026-01-02 00:00:00', '2026-01-02'],
    ['02/01/2026', '2026-01-02'], ['46024', '2026-01-02'], [46024, '2026-01-02'], ['31.02.2026', ''], ['', ''], ['Quatsch', '']];
  for (const [ein, soll] of f) assert.equal(U.parseDatum(ein), soll, String(ein));
});

test('Vertragsnummer bleibt Text; Vergleich ohne führende Nullen und Leerzeichen', () => {
  assert.equal(U.textNr('010238'), '010238');
  assert.equal(U.textNr(10238), '10238');
  assert.equal(U.normVnr('010238'), '10238');
  assert.equal(U.normVnr(' 0000 800 800 '), '800800');
  assert.equal(U.normVnr(10238), '10238');
  assert.equal(U.normVnr('0998117'), U.normVnr('998117'));
  const r = S.lies(C.lies(new Uint8Array(daten.dateien['abrechnung_2026_01.csv'])).zeilen);
  assert.ok(r.zeilen.some((z) => z.vnr === '012345'), 'führende Null bleibt in der Abrechnung erhalten');
});

test('CSV-Export: Semikolon, BOM, deutsches Zahlenformat, Schutz vor Formeln', () => {
  const t = C.schreibe(['Name', 'Betrag'], [['Muster; Anna', 12.5], ['=SUMME(A1)', -3]]);
  assert.equal(t.charCodeAt(0), 0xFEFF);
  assert.equal(t.slice(1), 'Name;Betrag\r\n"Muster; Anna";12,5\r\n\'=SUMME(A1);-3\r\n');
});

// ---------------- Abrechnung ----------------
test('Spalten werden über den Namen zugeordnet – auch umsortiert und mit kaputten Umlauten', () => {
  const kopf = KOPF.slice().reverse().map((k) => k.replace('ß', 'ﬂ').replace('Ä', 'ƒ'));
  const z = zeile({ vnr: '012345', name: 'MUSTER, ANNA', tarif: 'A107', mbd: 10, bdat: '2026-01-15', art: 'Erhöhung' }).reverse();
  z[kopf.indexOf('Provisionsart')] = 'Erhˆhung';
  const r = S.lies([['Export vom 01.02.2026'], kopf, z]);
  assert.equal(r.fehler, undefined);
  assert.equal(r.zeilen[0].vnr, '012345');
  assert.equal(r.zeilen[0].part, 'Erhöhung');
  assert.equal(r.zeilen[0].mbd, 10);
  assert.equal(r.zeilen[0].prov, 55);
  assert.equal(r.zeilen[0].bdat, '2026-01-15');
});

test('Fehlende Pflichtspalten werden verständlich gemeldet', () => {
  const kopf = KOPF.filter((k) => k !== 'Provision' && k !== 'Tarif');
  const r = S.lies([kopf, kopf.map(() => '1')]);
  assert.match(r.fehler, /Pflichtspalten: Tarif, Provision/);
  assert.match(S.lies([['a', 'b'], ['1', '2']]).fehler, /keine Provisionsabrechnung/);
});

test('Kumulativ-Vergleich: neue Buchungen, entfallene, identische Doppelzeilen über Anzahl', () => {
  const lies = (n) => S.lies(C.lies(new Uint8Array(daten.dateien[n])).zeilen).zeilen;
  const jan = lies('abrechnung_2026_01.csv'), feb = lies('abrechnung_2026_01-02.csv'), mrz = lies('abrechnung_2026_01-03.csv');
  const v1 = S.vergleiche([], jan, 1);
  assert.equal(v1.neu, jan.length);
  const v2 = S.vergleiche(jan, feb, 2);
  assert.equal(v2.neu, feb.filter((z) => z.bdat.startsWith('2026-02')).length);
  assert.equal(v2.entfallen, 1, 'eine Januar-Buchung wurde korrigiert');
  assert.ok(feb.filter((z) => z.bdat.startsWith('2026-01')).every((z) => z.imp === 1));
  const v3 = S.vergleiche(feb, mrz, 3);
  assert.equal(v3.neu, mrz.filter((z) => z.bdat.startsWith('2026-03')).length);
  assert.ok(mrz.filter((z) => z.bdat.startsWith('2026-02')).every((z) => z.imp === 2), 'Erst-Import bleibt über Folgeimporte erhalten');
  // gleicher Stand noch einmal: nichts neu
  const nochmal = lies('abrechnung_2026_01-03.csv');
  assert.deepEqual(S.vergleiche(mrz, nochmal, 4), { neu: 0, provisionNeu: 0, entfallen: 0 });
  // Doppelzeilen: 2 identische alt, 3 identische neu → genau 1 neu
  const d = (imp) => ({ vnr: '1', pnr: '1', tarif: 'T', bdat: '2026-01-01', part: 'Abschluss', mbd: 10, prov: 55, imp });
  const neu = [d(0), d(0), d(0)];
  assert.equal(S.vergleiche([d(1), d(1)], neu, 2).neu, 1);
  assert.deepEqual(neu.map((z) => z.imp), [1, 1, 2]);
  assert.equal(S.vergleiche([d(1), d(1), d(1)], [d(0)], 2).entfallen, 2);
});

test('Packen/Entpacken ist verlustfrei', () => {
  const z = S.lies(C.lies(new Uint8Array(daten.dateien['abrechnung_2026_01.csv'])).zeilen).zeilen;
  assert.deepEqual(S.entpacke(JSON.parse(JSON.stringify(S.packe(z)))), z);
});

// ---------------- Provision ----------------
test('Provision: Faktor, Leben, Unfall, GKV, Bank-Teilung, Überschreiben, Vorzeichen', () => {
  const regeln = P.standardRegeln();
  const a = (o) => Object.assign(M.neuerAntrag(), o);
  const pos = (...l) => l.map(([tarif, beitrag, bereich]) => Object.assign(M.neuePosition(), { tarif, beitrag, bereich: bereich || '' }));
  assert.equal(P.soll(a({ bereich: 'voll', positionen: pos(['A', 100]) }), regeln).betrag, 550);
  assert.equal(P.soll(a({ bereich: 'zusatz', positionen: pos(['A', 100]) }), regeln).betrag, 450);
  assert.equal(P.soll(a({ bereich: 'bkv', positionen: pos(['A', 100]) }), regeln).betrag, 300);
  assert.equal(P.soll(a({ bereich: 'gruppe', positionen: pos(['A', 100]) }), regeln).betrag, 280);
  // Pflegepflicht als Position mit eigenem Bereich innerhalb eines Voll-Antrags
  assert.equal(P.soll(a({ bereich: 'voll', positionen: pos(['A', 100], ['PVN', 40, 'pflege']) }), regeln).betrag, 550 + 60);
  // Leben: 25 ‰ × (100 × 12 × 20)
  const l = P.soll(a({ bereich: 'leben', laufzeit: 20, positionen: pos(['RV', 100]) }), regeln);
  assert.equal(l.betrag, 600);
  // Unfall: 20 % je Monat, laufend
  const u = P.soll(a({ bereich: 'unfall', positionen: pos(['UV', 30]) }), regeln);
  assert.equal(u.betrag, 6); assert.equal(u.laufend, true);
  // GKV: Fixbetrag je Stück
  assert.equal(P.soll(a({ bereich: 'gkv', positionen: pos(['mhplus', 0], ['mhplus', 0]) }), regeln).betrag, 100);
  // Umstellung: keine Provision
  assert.equal(P.soll(a({ bereich: 'voll', vorgang: 'umstellung', positionen: pos(['A', 100]) }), regeln).betrag, 0);
  // Minderbeitrag: negativ, auch wenn positiv erfasst
  assert.equal(P.soll(a({ bereich: 'voll', vorgang: 'minder', positionen: pos(['A', 20]) }), regeln).betrag, -110);
  assert.equal(M.beitrag(a({ vorgang: 'minder', positionen: pos(['A', -20]) })), -20);
  // Bank-Teilung 40 %
  const b = P.soll(a({ bereich: 'voll', bank: { aktiv: true, anteil: 40 }, positionen: pos(['A', 100]) }), regeln);
  assert.equal(b.betrag, 330); assert.equal(b.bankAbzug, 220);
  // manuell überschrieben
  const m = P.soll(a({ bereich: 'voll', provisionManuell: 123.45, positionen: pos(['A', 100]) }), regeln);
  assert.equal(m.betrag, 123.45); assert.equal(m.ueberschrieben, true); assert.equal(m.berechnet, 550);
  // geänderte Regel greift
  regeln['voll|neu'].wert = 6;
  assert.equal(P.soll(a({ bereich: 'voll', positionen: pos(['A', 100]) }), regeln).betrag, 600);
});

// ---------------- Modell ----------------
test('Pflichtfelder, Dubletten, Statushistorie, Migration', () => {
  const a = M.neuerAntrag();
  const f = M.pruefeAntrag(a).map((x) => x.feld);
  assert.ok(f.includes('vn.name') && f.includes('vn.vorname') && f.includes('pos.0.tarif') && f.includes('pos.0.beitrag'));
  a.vn = { name: 'Muster', vorname: 'Anna' }; a.positionen[0].tarif = 'A107'; a.positionen[0].beitrag = -12.5;
  assert.deepEqual(M.pruefeAntrag(a), [], 'negativer Beitrag ist erlaubt');
  a.bereich = 'leben';
  assert.ok(M.pruefeAntrag(a).some((x) => x.feld === 'laufzeit'));
  a.bereich = 'voll';
  const b = M.neuerAntrag(a);
  assert.notEqual(b.id, a.id);
  assert.equal(M.findeDubletten(b, [a]).length, 1);
  b.positionen[0].beitrag = 99;
  assert.equal(M.findeDubletten(b, [a]).length, 0);
  assert.equal(M.setzeStatus(a, 'policiert', '2026-02-01', 'manuell'), true);
  assert.equal(a.statusManuell, false);
  M.setzeStatus(a, 'abgerechnet', '2026-03-01', 'abgleich');
  assert.deepEqual(a.historie.map((h) => h.status), ['eingereicht', 'policiert', 'abgerechnet']);
  assert.equal(M.statusVorAbgleich(a).status, 'policiert');
  assert.throws(() => M.migriere({ foo: 1 }), /keine Antragsbuch-Projektdatei/);
  assert.throws(() => M.migriere({ format: 'antragsbuch', schema: 99 }), /neueren Version/);
  const alt = M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [{ id: 'x', vn: { name: 'A', vorname: 'B' }, positionen: [] }], einstellungen: {} });
  assert.equal(alt.einstellungen.offenTage, 60);
  assert.equal(alt.antraege[0].positionen.length, 1);
  assert.ok(alt.regeln['voll|neu']);
});

test('Sicherungsstände: höchstens 10, Wiederherstellung', () => {
  const p = M.neuesProjekt(2026);
  p.antraege.push(M.neuerAntrag());
  for (let i = 0; i < 12; i++) M.sichere(p, 'Import ' + i);
  assert.equal(p.sicherungen.length, 10);
  assert.equal(p.sicherungen[0].anlass, 'Import 2');
  const id = p.sicherungen[9].id;
  p.antraege = [];
  assert.equal(M.stelleWiederHer(p, id), true);
  assert.equal(p.antraege.length, 1);
});

test('Namensvergleich: Schreibweise „NAME, VORNAME", Umlaute, Tippfehler', () => {
  assert.equal(U.namensAehnlichkeit('MUSTER, ANNA', 'Anna Muster'), 1);
  assert.equal(U.namensAehnlichkeit('GRÖSSMANN, BJÖRN', 'Größmann, Björn'), 1);
  assert.equal(U.namensAehnlichkeit('Groessmann, Bjoern', 'Größmann, Björn'), 1);
  assert.ok(U.namensAehnlichkeit('Mustr, Anna', 'MUSTER, ANNA') > 0.85);
  assert.ok(U.namensAehnlichkeit('Dr. Anna Muster', 'MUSTER, ANNA') === 1);
  assert.ok(U.namensAehnlichkeit('Muster, Anna', 'MUSTER, ANNA MARIA') > 0.85);
  assert.ok(U.namensAehnlichkeit('Muster, Anna', 'Probe, Clara') < 0.3);
  assert.ok(U.namensAehnlichkeit('Muster, Anna', 'Muster, Fritz') < 0.7);
});

test('XLSX-Leser: Blätter, Text, Zahlen (komprimiert)', async () => {
  const t = await AB.xlsx.liesTabelle(new Uint8Array(daten.dateien['monatsscheiben.xlsx']), 'm.xlsx');
  assert.deepEqual(t.blaetter.map((b) => b.name), ['Produkthierarchie', 'Vertriebswege']);
  assert.equal(t.blaetter[1].zeilen[2][1], 'Stand: 31.03.2026');
  assert.equal(typeof t.blaetter[1].zeilen[7][5], 'number');
  assert.match(t.blaetter[1].zeilen[8][1], /^900999 /);
});

test('Im Code und in den Testdaten stehen keine externen Adressen', () => {
  const dateien = [];
  (function geh(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? geh(p) : dateien.push(p); } })(path.join(__dirname, '..', 'src'));
  for (const d of dateien) {
    const t = fs.readFileSync(d, 'utf8').replace(/http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml)/g, '').replace(/http:\/\/schemas\.openxmlformats\.org\/[\w\/-]+/g, '');
    assert.doesNotMatch(t, /https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|<script[^>]+src=|<link[^>]+href=/, d);
  }
  assert.equal(VM, '900999');
});
