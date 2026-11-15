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
  assert.equal(v2.entfallen, 0); assert.equal(v2.behalten.length, 1, 'eine Januar-Buchung fehlt in der Februar-Datei und wird behalten'); assert.equal(v2.behalten[0].fehlt, 2);
  assert.ok(feb.filter((z) => z.bdat.startsWith('2026-01')).every((z) => z.imp === 1));
  const v3 = S.vergleiche(feb, mrz, 3);
  assert.equal(v3.neu, mrz.filter((z) => z.bdat.startsWith('2026-03')).length);
  assert.ok(mrz.filter((z) => z.bdat.startsWith('2026-02')).every((z) => z.imp === 2), 'Erst-Import bleibt über Folgeimporte erhalten');
  // gleicher Stand noch einmal: nichts neu
  const nochmal = lies('abrechnung_2026_01-03.csv');
  assert.deepEqual(S.vergleiche(mrz, nochmal, 4), { neu: 0, provisionNeu: 0, entfallen: 0, behalten: [] });
  // Doppelzeilen: 2 identische alt, 3 identische neu → genau 1 neu
  const d = (imp) => ({ vnr: '1', pnr: '1', tarif: 'T', bdat: '2026-01-01', part: 'Abschluss', mbd: 10, prov: 55, imp });
  const neu = [d(0), d(0), d(0)];
  assert.equal(S.vergleiche([d(1), d(1)], neu, 2).neu, 1);
  assert.deepEqual(neu.map((z) => z.imp), [1, 1, 2]);
  assert.equal(S.vergleiche([d(1), d(1), d(1)], [d(0)], 2).behalten.length, 2, 'zwei der drei alten Zeilen fehlen in der neuen Datei und bleiben erhalten');
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
  assert.deepEqual(M.pruefeAntrag(a).map((x) => x.feld), ['herkunft'], 'Neu oder Bestand ist bei Neugeschäft Voll/bKV Pflicht');
  a.vorgang = 'mehr'; assert.deepEqual(M.pruefeAntrag(a), []); a.vorgang = 'neu'; a.bereich = 'zusatz'; assert.deepEqual(M.pruefeAntrag(a), []); a.bereich = 'voll';
  a.herkunft = 'neu';
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

test('Passwortschutz: verschlüsseln, entschlüsseln, falsches Passwort, kein Klartext im Umschlag', async () => {
  const K = AB.krypto, text = JSON.stringify({ format: 'antragsbuch', antraege: [{ vn: { name: 'Größmann', vorname: 'Björn' }, vertragsnummer: '012345' }] });
  const s = await K.schluessel('ein-gutes-Passwort');
  const u = await K.verschluessele(text, s, { format: 'antragsbuch', schema: 1, projektId: 'x', jahr: 2026, geaendert: '2026-11-14T10:00:00.000Z' });
  const roh = JSON.stringify(u);
  assert.equal(u.verschluesselt, 1); assert.equal(u.kdf.iter, 310000); assert.equal(u.projektId, 'x');
  assert.ok(!roh.includes('Größmann') && !roh.includes('012345') && !roh.includes('antraege'), 'kein Klartext');
  const e = await K.entschluessele(JSON.parse(roh), 'ein-gutes-Passwort');
  assert.equal(e.text, text);
  await assert.rejects(() => K.entschluessele(JSON.parse(roh), 'falsch'), (f) => f.falschesPasswort === true);
  // jeder Speichervorgang nutzt einen neuen Zufallswert – gleiche Daten ergeben anderen Geheimtext
  const u2 = await K.verschluessele(text, s, {});
  assert.notEqual(u2.daten, u.daten); assert.notEqual(u2.iv, u.iv);
  // manipulierte Daten werden erkannt
  const kaputt = JSON.parse(roh); kaputt.daten = kaputt.daten.slice(0, 20) + (kaputt.daten[20] === 'A' ? 'B' : 'A') + kaputt.daten.slice(21);
  await assert.rejects(() => K.entschluessele(kaputt, 'ein-gutes-Passwort'));
  assert.throws(() => M.migriere(JSON.parse(roh)), /Passwort geschützt/);
});

test('Gesetzlicher Zuschlag (VT) zählt zum Beitrag, löst aber keine Provision aus', () => {
  const a = M.neuerAntrag(); a.bereich = 'voll';
  a.positionen = [['A107u', 300], ['VT', 30]].map(([tarif, beitrag]) => Object.assign(M.neuePosition(), { tarif, beitrag }));
  assert.equal(M.beitrag(a), 330);
  const s = P.soll(a, P.standardRegeln());
  assert.equal(s.betrag, 1650); assert.match(s.teile[1].text, /gesetzlicher Zuschlag/);
});

test('Bonus-Rechner: Werte des Bonus-Reportings, Stufen, Sonderregelung, Zusatzboni', () => {
  const B = AB.bonus;
  // wie im Bonus-Reporting: Stufe 1+2, Bestand 373.185 €, KV-Netto 4.485 €, gesamt 4.607 €, 4 neue VP Voll, 38 neue VP bKV
  let r = B.rechne({ stufe: '1+2', bestandKv: 373185, neueVoll: 4, neueBkv: 38, nettoKv: 4485, nettoGesamt: 4607 });
  assert.deepEqual([r.ziel1.soll, r.ziel1.fehlt, r.ziel1.erreicht], [9, 5, false]);
  assert.deepEqual([Math.round(r.ziel2.soll), Math.round(r.ziel2.fehlt), Math.round(r.ziel2.je1000)], [8210, 3725, 12]);
  assert.deepEqual([Math.round(r.zb1.soll), Math.round(r.zb1.fehlt), r.zb1.max], [9330, 4845, 750]);
  assert.deepEqual([r.sonder.mindest, r.sonder.fehlt, r.sonder.greift], [6000, 1393, false]);
  assert.deepEqual([r.bkv.soll, r.bkv.erreicht, r.bkv.praemie, r.bkv.max], [25, true, 0, 500], 'bKV-Ziel erreicht, zählt aber erst mit Grundbonus');
  assert.equal(r.summe, 0); assert.equal(r.maxZusatz, 4250);
  assert.ok(r.schritte.some((s) => /noch 5 neue Personen/.test(s)) && r.schritte.some((s) => /3\.725 €/.test(s)) && r.schritte.some((s) => /1\.393 €/.test(s)));
  // Sonderregelung: Mindestproduktion erreicht → halber Grundbonus
  r = B.rechne({ stufe: '1+2', bestandKv: 373185, bestandVoll: 300000, neueVoll: 4, neueBkv: 38, nettoKv: 6100, nettoGesamt: 6200 });
  assert.deepEqual([r.grundErreicht, r.sonder.greift, r.grund, r.summe], [false, true, 1240, 1240]);
  // Beispiele aus den Bedingungen: Stufe 4, 9 neue Personen bei 350.000 € Bestand, 11.000 € → 6.600 €
  r = B.rechne({ stufe: '4', bestandKv: 350000, bestandVoll: 350000, neueVoll: 9, neueBkv: 0, nettoKv: 11000, nettoGesamt: 11000 });
  assert.equal(r.ziel1.soll, 9); assert.equal(r.ziel1.erreicht, true); assert.equal(r.grund, 6600); assert.equal(r.kombi.praemie, 6000);
  assert.equal(r.zb1.praemie, 4050); assert.equal(r.summe, 6600 + 6000 + 4050);
  // Stufe 5, 400.000 € Bestand, 12.500 € → 8.750 €; Stufe 3, 275.000 €, 7.500 € → Zusatzbonus 2.100 €
  assert.equal(B.rechne({ stufe: '5', bestandKv: 400000, nettoKv: 12500, nettoGesamt: 12500 }).grund, 8750);
  r = B.rechne({ stufe: '3', bestandKv: 275000, nettoKv: 7500, nettoGesamt: 7500, neueBkv: 35 });
  assert.equal(r.zb1.praemie, 2100); assert.equal(r.bkv.praemie, 1000); assert.equal(r.grund, 3750);
  assert.equal(B.rechne(B.leer()).summe, 0);
  assert.equal(B.rechne({ stufe: '3', bestandKv: 80000 }).ziel1.soll, 3, 'mindestens drei neue Personen');
});

test('Lizenz: ausstellen, prüfen, Testzeitraum, Warnung, Kulanz, Ablauf, Fälschung, falsche Nummer', async () => {
  const L = AB.lizenz, paar = await L.erzeugePaar(), fremd = await L.erzeugePaar();
  const cfg = { pub: paar.oeffentlich, test: 30, kulanz: 14, warn: 30 };
  const key = await L.stelleAus(paar.geheim, { nr: '900401', name: 'Beispiel, ADP', bis: '2026-12-31', aus: '2026-01-02' });
  assert.match(key, /^AB1-[\w-]+\.[\w-]+$/);
  assert.deepEqual(await L.lies(paar.oeffentlich, key), { v: 1, nr: '900401', name: 'Beispiel, ADP', bis: '2026-12-31', aus: '2026-01-02' });
  assert.equal(await L.lies(fremd.oeffentlich, key), null, 'fremder Aussteller');
  // ohne eingeprägten Schlüssel: alles frei
  assert.deepEqual(await L.pruefe({}, '', '900401', '2026-06-01'), { modus: 'frei', nurLesen: false, text: '' });
  const p = (k, nr, heute, start) => L.pruefe(cfg, k, nr, heute, start || '2026-01-01');
  let r = await p(key, '900401', '2026-06-01');  assert.deepEqual([r.modus, r.nurLesen, r.name], ['gueltig', false, 'Beispiel, ADP']);
  r = await p(key, '900401', '2026-12-10');      assert.deepEqual([r.modus, r.nurLesen, r.tage], ['warnung', false, 21]);
  r = await p(key, '900401', '2027-01-10');      assert.deepEqual([r.modus, r.nurLesen], ['kulanz', false]); assert.match(r.text, /noch 4 Tage/);
  r = await p(key, '900401', '2027-01-20');      assert.deepEqual([r.modus, r.nurLesen], ['abgelaufen', true]);
  r = await p(key, '900402', '2026-06-01');      assert.deepEqual([r.modus, r.nurLesen], ['ungueltig', true]); assert.match(r.text, /gehört zur Vermittlernummer 900401/);
  r = await p('', '900401', '2026-01-10');       assert.deepEqual([r.modus, r.nurLesen, r.tage], ['test', false, 21]);
  r = await p('', '900401', '2026-02-15');       assert.deepEqual([r.modus, r.nurLesen], ['fehlt', true]);
  // Fälschungen: Ablaufdatum verlängert, Zeichen verändert
  const teile = key.slice(4).split('.'), inhalt = JSON.parse(Buffer.from(teile[0], 'base64url').toString());
  inhalt.bis = '2099-12-31';
  const gefaelscht = 'AB1-' + Buffer.from(JSON.stringify(inhalt)).toString('base64url') + '.' + teile[1];
  assert.equal(await L.lies(paar.oeffentlich, gefaelscht), null);
  assert.equal((await p(gefaelscht, '900401', '2026-06-01')).modus, 'ungueltig');
  assert.equal(await L.lies(paar.oeffentlich, 'Unsinn'), null);
  assert.equal((await p(key.replace(/\./, '\n .'), '900401', '2026-06-01')).modus, 'gueltig', 'Zeilenumbrüche und Leerzeichen stören nicht');
  // Lizenz für alle Nummern (z. B. Führungskraft)
  assert.equal((await p(await L.stelleAus(paar.geheim, { nr: '*', bis: '2026-12-31' }), '900999', '2026-06-01')).modus, 'gueltig');
  // Prägen der App-Datei
  const html = '<html><script id="lizenz" type="application/json">{}</script></html>';
  const gepraegt = L.praege(html, { pub: paar.oeffentlich, test: 14, inhaber: 'Test </script>' });
  assert.equal(JSON.parse(/<script id="lizenz" type="application\/json">([\s\S]*?)<\/script>/.exec(gepraegt)[1]).test, 14);
  assert.equal(gepraegt.split('</script>').length, 2, 'kein vorzeitiges Skript-Ende');
  assert.throws(() => L.praege('<html></html>', {}), /keine antragsbuch\.html/);
});

test('Aktionen: Kundenliste einlesen, Kontakte mit festem Datum, Zustände, Kennzahlen, Excel', async () => {
  const K = AB.aktionen, a = K.neu('Anschreiben Altersvorsorgedepot'); a.frist = '2026-03-31';
  const zl = [['Liste vom 01.03.2026'], ['Mitgliedsnummer', 'Name VN', 'Ort VN', 'Tarif', 'Monatsbeitrag'],
    ['012345', 'MUSTER, ANNA', 'Musterstadt', 'A107a', 250.5], ['200200', 'PROBE, CLARA', 'Probedorf', 'ZP7', 35], ['300300', 'BEISPIEL, BERND', 'Beispielhausen', 'BE560', 55.2],
    ['400400', 'DEMO, EVA', 'Übungsheim', 'ZP9', 48], ['500500', 'VORLAGE, FRITZ', 'Musterstadt', 'A109a', 300], [null, null, null, null, null]];
  const k = AB.vdienst.kopfzeile(zl), map = AB.vdienst.rate(zl[k]);
  const e = K.kundenAusTabelle(zl, k, map);
  assert.equal(e.kunden.length, 5); assert.deepEqual(e.spalten, ['Ort VN', 'Tarif', 'Monatsbeitrag']);
  assert.deepEqual([e.kunden[0].vnr, e.kunden[0].name, e.kunden[0].extra], ['012345', 'MUSTER, ANNA', ['Musterstadt', 'A107a', '250,5']]);
  a.kunden = e.kunden; a.spalten = e.spalten;
  const [k1, k2, k3, k4] = a.kunden;
  K.setzeKontakt(k1, 0, 'O', '2026-03-05'); K.setzeKontakt(k1, 1, 'T', '2026-03-09'); k1.ergebnis = 'abschluss'; k1.mb = 85.5;
  K.setzeKontakt(k2, 0, 'O', '2026-03-05');
  K.setzeKontakt(k3, 0, 'M', '2026-03-05'); K.setzeKontakt(k3, 0, 'P', '2026-03-20');
  assert.deepEqual(k3.stufen[0], { code: 'P', datum: '2026-03-05' }, 'das Datum des ersten Eintrags bleibt stehen');
  K.setzeKontakt(k4, 0, 'X', '2026-03-06');
  assert.deepEqual(a.kunden.map(K.zustand), ['abschluss', 'nichtErreicht', 'kontaktiert', 'keinInteresse', 'unbearbeitet']);
  let z = K.kennzahlen(a, '2026-03-20');
  assert.deepEqual([z.kunden, z.bearbeitet, z.erreicht, z.zustand.unbearbeitet, z.mb, z.ueberfaellig, z.tageBisFrist], [5, 4, 3, 1, 85.5, 0, 11]);
  assert.deepEqual(z.codes, { T: 1, M: 0, P: 1, O: 2, X: 1 }); assert.deepEqual(z.stufen, [4, 1, 0]);
  assert.equal(z.quoteBearbeitet, 0.8); assert.equal(z.quoteErreicht, 0.75); assert.ok(Math.abs(z.quoteAbschluss - 1 / 3) < 1e-9);
  assert.equal(K.kennzahlen(a, '2026-04-02').ueberfaellig, 1);
  K.setzeKontakt(k2, 0, ''); assert.equal(K.zustand(k2), 'unbearbeitet');
  const t = K.tabelle(a);
  assert.equal(t.spalten.length, 2 + 3 + 6 + 4); assert.equal(t.zeilen[0][11], 'Abschluss'); assert.equal(t.farbe(t.zeilen[0], 0, 11), 'gut'); assert.equal(t.farbe(t.zeilen[4], 4, 11), 'krit');
  const zurueck = await AB.xlsx.lies(AB.xlsxout.schreibe([Object.assign({ name: 'Aktion', titel: a.name }, t)]));
  assert.ok(zurueck[0].zeilen.some((r) => r[0] === '012345' && r[1] === 'MUSTER, ANNA' && r[13] === 85.5), 'Vertragsnummer bleibt Text mit führender Null');
  const p = M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [], einstellungen: {} });
  assert.deepEqual(p.aktionen, []);
});

test('Nettoproduktion aus der Spalte „Produktion" und Bonus-Rechner gegen ein Bonus-Reporting (Karrierestufe 3)', () => {
  const z = (bdat, prod, tg, sparte) => ({ bdat, prod, tg, sparte: sparte || 'KVUV', mbd: 99 });
  const n = AB.team.nettoproduktion([z('2025-01-02', 900.46, 'Vollversicherung'), z('2025-01-20', -40.28, 'Firmentarife'), z('2025-11-03', 3.08, 'Unfallversicherung'),
    z('2025-12-01', 100, 'Rente', 'LV'), z('2025-12-05', 0, 'Vollversicherung'), z('2024-12-05', 500, 'Vollversicherung')], 2025);
  assert.deepEqual([n.gesamt, n.kv, n.monate[0], n.monate[10], n.monate[11], n.hat], [963.26, 860.18, 860.18, 3.08, 100, true]);
  assert.equal(AB.team.nettoproduktion([z('2025-01-02', 0, 'Vollversicherung')], 2025).hat, false);
  const r = AB.bonus.rechne({ stufe: '3', bestandKv: 487370, neueVoll: 3, neueBkv: 35, nettoKv: 7033, nettoGesamt: 7036 });
  assert.deepEqual([r.ziel1.soll, r.ziel1.fehlt, Math.round(r.ziel2.soll), Math.round(r.ziel2.fehlt), Math.round(r.zb1.soll), Math.round(r.zb1.fehlt)], [12, 9, 12184, 5151, 13159, 6126]);
  assert.deepEqual([r.grundErreicht, r.sonder.mindest, r.sonder.fehlt, r.sonder.greift, r.bkv.erreicht, r.bkv.praemie, r.summe, r.maxZusatz], [false, 7200, 164, false, true, 0, 0, 7600]);
});

test('Persönliche Auswertung (ein ADP-Blatt + FD-Gesamt) wird als Teamdatei gelesen', () => {
  const kopf = [null, '', 'Mrz../2025', '01-Mrz../2025', '', '01/2025', '02/2025', '03/2025', '04/2025', '05/2025', '06/2025'];
  const blatt = (name, a, b, c) => ({ name, zeilen: [[null, 'Monatsscheiben Nettoproduktion'], [null, 'Stand: 31.03.2025'], kopf, [null, 'Kranken', c, a + b + c, null, a, b, c], [null, 'Vollversicherung', c / 2, 0, null, a / 2, b / 2, c / 2], [null, 'Unfall', 0, 1, null, 1, null, null]] });
  const bl = [blatt('FDBms', 1000, 2000, 3000), blatt('GDms', 500, 500, 500), blatt('999ms', 100, 200, 300)];
  assert.equal(AB.team.istSammelmappe(bl), true);
  assert.equal(AB.team.istSammelmappe([blatt('999ms', 1, 2, 3)]), false);
  const t = AB.team.liesSammelmappe(bl);
  assert.equal(t.einzeln, true); assert.deepEqual(t.zeilen.map((z) => z.nr), ['FDB', '900999']);
  const pos = AB.team.position(t, '900999');
  assert.equal(pos.ytd.wert, 601); assert.equal(pos.gesamt.werte[2], 3000);
});

test('Bonus: Fehlbeträge mit ungerundeter Produktion wie im Reporting; Mindestproduktion muss überschritten werden', () => {
  const r = AB.bonus.rechne({ stufe: '3', bestandKv: 487370, neueVoll: 3, neueBkv: 35, nettoKv: 7032.54, nettoGesamt: 7035.62 });
  assert.deepEqual([Math.round(r.ziel2.fehlt), Math.round(r.zb1.fehlt), Math.round(r.sonder.fehlt)], [5152, 6126, 164]);
  assert.equal(AB.bonus.rechne({ stufe: '3', nettoGesamt: 7200 }).sonder.greift, false);
  assert.equal(AB.bonus.rechne({ stufe: '3', nettoGesamt: 7200.01 }).sonder.greift, true);
  const r26 = AB.bonus.rechne({ stufe: '1+2', bestandKv: 373185, neueVoll: 4, neueBkv: 38, nettoKv: 4485, nettoGesamt: 4607 });
  assert.deepEqual([r26.ziel1.soll, r26.ziel1.fehlt, Math.round(r26.ziel2.soll), Math.round(r26.zb1.soll), r26.sonder.fehlt, r26.maxZusatz, r26.summe], [9, 5, 8210, 9330, 1393, 4250, 0]);
});

test('Bonus-Vorschau: bestätigt (Reporting), gebucht (Abrechnung nach dem Stand), beantragt (Antragsbuch, ab Einreichung)', () => {
  const p = M.neuesProjekt(2026); p.bonus = Object.assign(AB.bonus.leer(), { stufe: '1+2', bestandKv: 300000, neueVoll: 4, neueBkv: 10, nettoKv: 4000, nettoGesamt: 4100, reportingStand: '2026-06-30' });
  const antrag = (o, pos) => { const a = M.neuerAntrag(); Object.assign(a, { herkunft: 'neu' }, o); a.positionen = pos.map((x) => Object.assign(M.neuePosition(), x)); p.antraege.push(a); return a; };
  const a1 = antrag({ eingang: '2026-03-10', bereich: 'voll', vorgang: 'neu', beginn: '2026-08-01', vn: { name: 'Muster', vorname: 'Anna' } }, [{ person: 'Anna Muster', tarif: 'AM13', beitrag: 400 }, { person: 'Anna Muster', tarif: 'S1', beitrag: 100 }, { person: 'Kind Muster', tarif: 'AM13', beitrag: 150 }]);
  const a2 = antrag({ eingang: '2026-05-02', bereich: 'voll', vorgang: 'neu', status: 'abgerechnet', vn: { name: 'Probe', vorname: 'Bernd' } }, [{ tarif: 'A107a', beitrag: 500 }]);
  const a3 = antrag({ eingang: '2026-07-15', bereich: 'voll', vorgang: 'neu', status: 'abgerechnet', vn: { name: 'Beispiel', vorname: 'Clara' } }, [{ tarif: 'AM12', beitrag: 450 }]);
  antrag({ eingang: '2026-08-01', bereich: 'bkv', vorgang: 'neu', vn: { name: 'Firma Test' } }, [{ person: 'P1', tarif: 'BFRO', beitrag: 20 }, { person: 'P2', tarif: 'BFRO', beitrag: 20 }]);
  antrag({ eingang: '2026-08-03', bereich: 'zusatz', vorgang: 'minder', vn: { name: 'Demo' } }, [{ tarif: 'ZP7', beitrag: 30 }]);
  antrag({ eingang: '2026-08-04', bereich: 'voll', vorgang: 'neu', status: 'absage', vn: { name: 'Weg' } }, [{ tarif: 'AM13', beitrag: 999 }]);
  antrag({ eingang: '2025-06-30', bereich: 'voll', vorgang: 'neu', status: 'abgerechnet', statusDatum: '2025-07-15', vn: { name: 'Vorjahr' } }, [{ tarif: 'AM13', beitrag: 999 }]);
  const erg = { proAntrag: { [a2.id]: { buendel: [{ bdat: '2026-06-12', monat: '2026-06' }] }, [a3.id]: { buendel: [{ bdat: '2026-08-11', monat: '2026-08' }, { bdat: '2026-09-02', monat: '2026-09' }] } } };
  const zl = [{ bdat: '2026-06-12', prod: 4100, tg: 'Vollversicherung', sparte: 'KVUV' }, { bdat: '2026-08-11', prod: 450, tg: 'Vollversicherung', sparte: 'KVUV' }, { bdat: '2026-08-20', prod: 12, tg: 'Unfallversicherung', sparte: 'KVUV' }];
  const s = AB.bonus.simulation(p, zl, erg);
  assert.deepEqual(s.liste.map((x) => [x.name, x.zustand, x.voll, x.bkv, x.mb]), [['Muster, Anna', 'beantragt', 2, 0, 650], ['Probe, Bernd', 'bestaetigt', 1, 0, 500], ['Beispiel, Clara', 'gebucht', 1, 0, 450], ['Firma Test', 'beantragt', 0, 2, 40], ['Demo', 'beantragt', 0, 0, -30]]);
  const kurz = (z) => [z.bestaetigt, z.gebucht, z.beantragt, z.voraussichtlich];
  assert.deepEqual(kurz(s.voll), [4, 1, 2, 7]); assert.deepEqual(kurz(s.bkv), [10, 0, 2, 12]);
  M.vergibNummern(p);
  assert.deepEqual(p.antraege.map((a) => a.nr), [2, 3, 4, 5, 6, 7, 1], 'Positionsnummern in der Reihenfolge des Eingangs');
  p.antraege.splice(4, 1); const neuA = antrag({ eingang: '2026-01-01', bereich: 'zusatz', vorgang: 'neu', vn: { name: 'Später erfasst' } }, [{ tarif: 'ZP9', beitrag: 9 }]);
  M.vergibNummern(p); assert.equal(neuA.nr, 8, 'gelöschte Nummern werden nicht neu vergeben, vorhandene bleiben');
  const sp = AB.bonus.simulation(p, zl, erg);
  assert.deepEqual([sp.voll.imBuch, sp.voll.abweichung, sp.voll.positionen], [1, 3, { bestaetigt: [3], gebucht: [4], policiert: [], beantragt: [2] }]);
  assert.deepEqual(sp.bkv.positionen.beantragt, [5]);
  const bl = AB.bonus.tabellePruefung(p, sp);
  assert.deepEqual(bl.map((b) => b.name), ['Überprüfung Bonus', 'Positionen']);
  assert.deepEqual(bl[0].zeilen[0].slice(0, 10), ['Neue Personen KV-Voll', 9, 4, 1, 3, 1, 0, 2, 7, 2]); assert.deepEqual(bl[0].zeilen[0].slice(10), ['3', '4', '', '2']);
  assert.equal(bl[0].farbe(bl[0].zeilen[0], 0, 4), 'krit');
  const zm = bl[1].zeilen.find((r) => r[0] === 2);
  assert.deepEqual(zm.slice(0, 4), [2, 'Muster, Anna', '', '10.03.2026']); assert.equal(zm[12], 'beantragt – nicht bestätigt'); assert.equal(bl[1].zeilen[0][0], 8);
  bl.forEach((b) => b.zeilen.forEach((r) => assert.equal(r.length, b.spalten.length)));
  assert.ok(AB.xlsxout.schreibe(bl).length > 1000);
  // Veränderungsdienst meldet die Policierung: zählt ab dann für den Bonus, auch ohne Abrechnung
  const am = p.antraege.find((a) => a.nr === 2);
  M.setzeStatus(am, 'policiert', '2026-07-20', 'vdienst');
  const spol = AB.bonus.simulation(p, zl, erg), xm = spol.liste.find((x) => x.nr === 2);
  assert.deepEqual([xm.zustand, xm.policiertAm, xm.abgerechnet], ['policiert', '2026-07-20', false]);
  assert.deepEqual(kurz(spol.voll).concat(spol.voll.policiert), [4, 1, 0, 7, 2]); assert.deepEqual(spol.voll.positionen.policiert, [2]);
  assert.equal(spol.nettoGesamt.policiert, 650); assert.equal(spol.monate.vollPoliciert[6], 2); assert.equal(spol.gebucht.ziel1.ist, 7);
  am.historie[am.historie.length - 1].datum = '2026-06-01'; am.statusDatum = '2026-06-01';
  const sfrueh = AB.bonus.simulation(p, zl, erg);
  assert.equal(sfrueh.liste.find((x) => x.nr === 2).zustand, 'bestaetigt', 'vor dem Stand policiert: sollte im Reporting enthalten sein');
  assert.deepEqual([sfrueh.voll.imBuch, sfrueh.voll.abweichung, sfrueh.voll.policiert], [3, 1, 0]);
  M.setzeStatus(am, 'eingereicht', '2026-03-10', 'manuell'); am.historie = [];
  // Neu oder Bestand: aus Bestand zählt nie; mit Pflegepflicht zählen genau die Personen mit Pflegepflicht; ohne Angabe wird nicht gezählt
  const zaehl = () => AB.bonus.simulation(p, zl, erg).liste.find((x) => x.nr === 2);
  am.herkunft = 'bestand'; assert.equal(zaehl().voll, 0);
  am.herkunft = ''; assert.deepEqual([zaehl().voll, zaehl().ohneAngabe], [0, true]); assert.deepEqual(AB.bonus.simulation(p, zl, erg).ohneAngabe, [2]);
  am.positionen.push(Object.assign(M.neuePosition(), { person: 'Kind Muster', tarif: 'PPN', beitrag: 0 }));
  assert.deepEqual([zaehl().voll, zaehl().ohneAngabe], [1, false], 'ohne Angabe, aber mit Pflegepflicht: die Person mit Pflegepflicht zählt');
  am.herkunft = 'neu'; assert.equal(zaehl().voll, 1, 'mit Pflegepflicht zählen nur die Personen mit Pflegepflicht');
  am.positionen.pop(); assert.equal(zaehl().voll, 2);
  const zz = (vnr, pnr, tarif, part, st, bdat) => ({ vnr, pnr, tarif, part, st, bdat, tg: 'Pflegeversicherung', prod: 0 });
  const gp = AB.bonus.neueVollAusAbrechnung([zz('1', '1', 'PPN', 'Abschluss', 0, '2026-01-05'), zz('2', '1', 'PPN', 'Kündigungsrücknahme', 0, '2026-03-05'), zz('3', '1', 'PPB', 'Abschluss', 0, '2026-04-05'), zz('3', '1', 'PPB', 'Abschluss', 1, '2026-04-06'),
    zz('3', '1', 'PPB', 'Abschluss', 0, '2026-06-06'), zz('4', '2', 'PPN', 'Abschluss', 0, '2026-11-11'), zz('5', '1', 'PPN', 'Abschluss', 0, '2026-02-01'), zz('5', '1', 'PPN', 'Abschluss', 1, '2026-02-20'), zz('6', '1', 'AM13', 'Abschluss', 0, '2026-02-01'), zz('7', '1', 'PPN', 'Abschluss', 0, '2025-12-01')], 2026);
  assert.deepEqual([gp.anzahl, gp.monate[0], gp.monate[3], gp.monate[10]], [3, 1, 1, 1]);
  assert.deepEqual(s.nettoGesamt, { bestaetigt: 4100, gebucht: 462, policiert: 0, beantragt: 660, voraussichtlich: 5222 });
  assert.deepEqual(s.nettoKv, { bestaetigt: 4000, gebucht: 550, policiert: 0, beantragt: 660, voraussichtlich: 5210 });
  assert.equal(s.monate.vollBeantragt[2], 2, 'beantragt zählt ab dem Monat der Einreichung, auch bei Beginn 1. August');
  assert.equal(s.monate.vollGebucht[5], 1); assert.equal(s.monate.vollGebucht[7], 1); assert.equal(s.monate.beantragtMb[7], 10);
  assert.equal(s.heute.ziel1.ist, 4); assert.equal(s.gebucht.ziel1.ist, 5); assert.equal(s.prognose.ziel1.ist, 7);
  assert.equal(s.prognose.ziel1.soll, 9); assert.equal(s.prognose.ziel1.erreicht, false);
  p.antraege[0].positionen.push(Object.assign(M.neuePosition(), { person: 'Zweites Kind', tarif: 'AM13', beitrag: 150 }), Object.assign(M.neuePosition(), { person: 'Drittes Kind', tarif: 'AM13', beitrag: 150 }));
  p.antraege.pop(); p.antraege.splice(4, 0, Object.assign(M.neuerAntrag(), { eingang: '2026-08-03', bereich: 'zusatz', vorgang: 'minder', vn: { name: 'Demo', vorname: '' }, positionen: [Object.assign(M.neuePosition(), { tarif: 'ZP7', beitrag: 30 })] }));
  const s2 = AB.bonus.simulation(p, zl, erg);
  assert.equal(s2.prognose.ziel1.erreicht, true); assert.equal(s2.heute.grundErreicht, false); assert.ok(s2.prognose.summe > 0);
  const ohne = AB.bonus.simulation(Object.assign(M.neuesProjekt(2026), { antraege: p.antraege }), [], null);
  assert.equal(ohne.voll.bestaetigt, 0); assert.equal(ohne.voll.beantragt, 4); assert.equal(ohne.voll.gebucht, 2, 'ohne Reporting-Stand gilt Abgerechnetes als gebucht');
});

test('Grundvergütung: Betrag nach Karrierestufe, von Hand überschreibbar, Jahr bis zum laufenden Monat', () => {
  const p = M.neuesProjekt(2026);
  assert.equal(M.grundverguetung(p, null, '2026-05-10').gesetzt, false);
  p.einstellungen.grundverguetung = { stufe: '3', betrag: null, tabelle: { '1+2': 1500, '3': 2000 } };
  assert.deepEqual((({ jeMonat, monate, summe, manuell }) => [jeMonat, monate, summe, manuell])(M.grundverguetung(p, null, '2026-05-10')), [2000, 5, 10000, false]);
  assert.equal(M.grundverguetung(p, 2, '2026-05-10').summe, 2000);
  assert.equal(M.grundverguetung(p, null, '2027-02-01').summe, 24000); assert.equal(M.grundverguetung(p, null, '2025-12-01').summe, 0);
  p.einstellungen.grundverguetung.betrag = 2150.5;
  assert.deepEqual((({ jeMonat, ausStufe, manuell }) => [jeMonat, ausStufe, manuell])(M.grundverguetung(p, 0, '2026-05-10')), [2150.5, 2000, true]);
  const alt = M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [], einstellungen: {} });
  assert.equal(alt.einstellungen.grundverguetung.stufe, '');
  // Karrieresystem: sechs Stufen mit Fixum; ohne eigene Eingabe gilt das Fixum der Stufe
  assert.deepEqual(M.KARRIERE.map((k) => [k.kurz, k.fixum, k.mb]), [['BV1', 1500, 4], ['BV2', 2000, 5], ['HV', 2250, 5.5], ['GV', 2750, 6], ['GL', 3300, 7], ['GD', 4400, 7]]);
  alt.einstellungen.grundverguetung.stufe = '3';
  assert.deepEqual((({ jeMonat, kurz, manuell }) => [jeMonat, kurz, manuell])(M.grundverguetung(alt, 0, '2026-05-10')), [2250, 'HV', false]);
  alt.einstellungen.grundverguetung.tabelle['3'] = 2300; assert.equal(M.grundverguetung(alt, 0, '2026-05-10').jeMonat, 2300);
  // Kindernachversicherung zählt als neue Person, auch ohne Pflegepflicht
  const pk = M.neuesProjekt(2026), ak = Object.assign(M.neuerAntrag(), { eingang: '2026-02-01', bereich: 'voll', vorgang: 'neu', herkunft: 'kind', vn: { name: 'Muster', vorname: 'Anna' } });
  ak.positionen = [Object.assign(M.neuePosition(), { person: 'Baby Muster', tarif: 'A20u', beitrag: 45 })]; pk.antraege.push(ak);
  assert.equal(AB.bonus.simulation(pk, [], null).voll.beantragt, 1); assert.deepEqual(M.pruefeAntrag(ak), []);
});

test('Beitragsentlastung immer als BE/<Stufe>; Kindernachversicherung nur in der Vollversicherung', () => {
  assert.deepEqual(M.beTarif('BE 700'), { be: true, stufe: 700, tarif: 'BE/700' });
  assert.deepEqual(['be/560', 'BE560', 'BE-375', 'BE/700u'].map((t) => M.beTarif(t).tarif), ['BE/560', 'BE/560', 'BE/375', 'BE/700']);
  assert.deepEqual(['BE', 'BEu', 'BE MAX', 'BE/', 'bea'].map((t) => [M.beTarif(t).stufe, M.beTarif(t).tarif]), Array(5).fill([null, 'BE/']));
  assert.deepEqual(['BFRO', 'BEIHILFE', 'A107', ''].map(M.beTarif), [null, null, null, null]);
  assert.equal(AB.tarif.einordnen('BE/700').kategorie, 'Beitragsentlastung');
  const a = Object.assign(M.neuerAntrag(), { vorgang: 'mehr', vn: { name: 'Muster', vorname: 'Anna' } });
  a.positionen[0].tarif = 'BEu'; a.positionen[0].beitrag = 50;
  assert.match(M.pruefeAntrag(a)[0].text, /Beitragsentlastung bitte mit Stufe angeben, z\. B\. BE\/700/);
  a.positionen[0].tarif = 'BE/700'; assert.deepEqual(M.pruefeAntrag(a), []);
  a.positionen[0].tarif = 'BEu'; a.quelle = 'abrechnung'; assert.deepEqual(M.pruefeAntrag(a), [], 'aus der Abrechnung übernommen: dort steht keine Stufe');
  const k = Object.assign(M.neuerAntrag(), { bereich: 'bkv', vorgang: 'neu', herkunft: 'kind', vn: { name: 'Firma', vorname: '' } }); k.positionen[0].tarif = 'BFRO'; k.positionen[0].beitrag = 20;
  assert.match(M.pruefeAntrag(k)[0].text, /nur in der Vollversicherung/);
});

test('Leben (Stuttgarter): Produktsuche mit Teilwort und *, Provision nach Linie, Tarifgruppe und Laufzeit', () => {
  const L = AB.leben, ids = (q) => L.suche(q).map((p) => p.id);
  assert.equal(L.PRODUKTE.length, 20);
  assert.deepEqual(ids('bu'), ['T95', 'T91', 'T91A'], 'Gruppe BU: Grundschutz+, BU-Plus, BU premium'); assert.deepEqual(ids('*91'), ['T91', 'T91A']); assert.deepEqual(ids('prem'), ['T91A']);
  assert.deepEqual(ids('riester perf'), ['T75P']); assert.deepEqual(ids('risiko fall'), ['T21']); assert.ok(ids('*9').includes('T95') && ids('*9').includes('T69'));
  assert.deepEqual(ids('t63'), ['T63', 'T63K']); assert.deepEqual(ids('xyz'), []); assert.equal(ids('').length, 20);
  // index-safe: 30 ‰, höchstens 35 Jahre; performance+ und BU: höchstens 40 Jahre
  let r = L.rechne({ produkt: 'T63' }, 100, 40); assert.deepEqual([r.wertungssumme, r.satz, r.betrag, r.haftung], [42000, 30, 1260, 96]);
  r = L.rechne({ produkt: 'T73' }, 100, 45); assert.deepEqual([r.wertungssumme, r.betrag], [48000, 1440]);
  r = L.rechne({ produkt: 'T91' }, 80, 30); assert.deepEqual([r.wertungssumme, r.betrag, r.haftung], [28800, 864, 60]);
  // classic: 20 ‰ mit Laufzeitfaktor (über 29 Jahre 100 %, 20 Jahre 50 %, bis 10 Jahre 0 %)
  assert.deepEqual([30, 29, 28.5, 20, 11, 10].map(L.laufzeitfaktor), [100, 95, 95, 50, 5, 0]);
  r = L.rechne({ produkt: 'T37' }, 100, 20); assert.deepEqual([r.wertungssumme, r.satz, r.betrag, r.richtwert], [24000, 10, 240, false]);
  // Tarifgruppe mit verminderten Abschlusskosten und Einmalbeitrag
  r = L.rechne({ produkt: 'T63', tarifgruppe: 'KG6' }, 100, 30); assert.deepEqual([r.satz, r.betrag], [18, 648]);
  r = L.rechne({ produkt: 'T69', einmal: true }, 20000, 0); assert.deepEqual([r.wertungssumme, r.betrag], [20000, 600]);
  assert.equal(L.rechne({ produkt: 'gibtsnicht' }, 100, 20).ok, false);
  // im Antrag: Produkt ist Pflicht, die erwartete Provision folgt dem Produkt; mit Bank die Hälfte
  const a = Object.assign(M.neuerAntrag(), { bereich: 'leben', vorgang: 'neu', laufzeit: 30, vn: { name: 'Muster', vorname: 'Anna' } });
  a.positionen[0].tarif = 'T91'; a.positionen[0].beitrag = 80;
  assert.match(M.pruefeAntrag(a)[0].text, /Produkt aus der Liste/);
  a.leben = { produkt: 'T91', tarifgruppe: 'einzel', einmal: false }; assert.deepEqual(M.pruefeAntrag(a), []);
  const regeln = AB.provision.standardRegeln();
  assert.equal(AB.provision.soll(a, regeln).betrag, 864);
  a.bank = { aktiv: true, anteil: 50 }; assert.equal(AB.provision.soll(a, regeln).betrag, 432);
});

test('Akzentfarbe: Fassungen sind in Hell und Dunkel lesbar, Multicolor würfelt sechs verschiedene Farben', () => {
  const merk = globalThis.AB; require('../src/ui/akzent.js'); const A = globalThis.AB.akzent;
  assert.equal(A.POOL.length, 25); assert.ok(A.EINZEL.length >= 10);
  for (const [name, hex] of A.POOL) {
    const f = A.fassungen(hex);
    assert.ok(A.kontrast(f.hell, '#ffffff') >= 3, name + ' auf Weiß'); assert.ok(A.kontrast(f.dunkel, '#15141f') >= 4.5, name + ' auf Dunkel');
    assert.ok(A.kontrast(f.tinte, f.hell) >= 3, name + ': Schrift auf der Akzentfläche');
  }
  let z = 0.123; const zufall = () => (z = (z * 9301 + 0.49297) % 1);
  for (let i = 0; i < 40; i++) { const w = A.wuerfle(zufall); assert.ok(w.length >= 5 && new Set(w).size === w.length, 'keine Farbe doppelt'); w.forEach((f) => assert.ok(A.POOL.some((p) => p[1] === f))); }
  assert.notDeepEqual(A.wuerfle(zufall), A.wuerfle(zufall));
  assert.equal(globalThis.AB, merk);
});

test('Analyse für Verkäufer: Größe der Anträge, Familien, Beitragsentlastung, Was-wäre-wenn; Tipps nach Kalender', () => {
  const p = M.neuesProjekt(2026), Y = AB.analyse;
  const an = (b, pos, o) => { const a = Object.assign(M.neuerAntrag(), { eingang: '2026-03-01', bereich: b, vorgang: 'neu', herkunft: 'neu', vn: { name: 'Kunde' + p.antraege.length, vorname: 'X' } }, o || {}); a.positionen = pos.map((x) => Object.assign(M.neuePosition(), { tarif: x[0], beitrag: x[1], personennummer: x[2] || '1' })); p.antraege.push(a); return a; };
  an('zusatz', [['ZP7', 20]]); an('zusatz', [['ZP9', 40]]); an('voll', [['AM13', 400], ['S1', 100]]); an('voll', [['AM13', 300, '1'], ['AM13', 150, '2'], ['AM13', 150, '3'], ['BE/500', 100, '1']]);
  an('voll', [['AM13', 999]], { status: 'absage' }); an('zusatz', [['ZP7', 30]], { vorgang: 'minder' }); an('zusatz', [['ZP7', 77]], { eingang: '2025-05-05', status: 'abgerechnet', statusDatum: '2025-06-01' });
  const o = Y.rechne(p, 2026);
  assert.deepEqual([o.n, o.summe, o.schnitt, o.median, o.kleinster, o.groesster], [4, 1260, 315, 270, 20, 700]);
  assert.deepEqual(o.klassen.map((k) => k.n), [1, 1, 0, 0, 1, 1]);
  assert.deepEqual(o.bereiche.map((b) => [b.id, b.n, b.summe, b.max, b.min]), [['voll', 2, 1200, 700, 500], ['zusatz', 2, 60, 40, 20]]);
  assert.deepEqual([o.familien.n, o.familien.gross, o.familien.schnitt, o.be.voll, o.be.mit], [1, 1, 700, 2, 1]);
  assert.equal(o.top[0].beitrag, 700); assert.equal(o.klein.beitrag, 20);
  assert.equal(o.wenn[0].beitrag, 40); assert.equal(o.wenn[1].beitrag, 480, 'kleinere Hälfte auf den mittleren Antrag gehoben'); assert.ok(o.wenn[0].provision > 0);
  assert.match(o.wenn[o.wenn.length - 1].text, /1 Vollversicherungen ohne Beitragsentlastung/);
  assert.equal(Y.rechne(M.neuesProjekt(2026), 2026).n, 0);
  const h = Y.heute('2026-09-20');
  assert.deepEqual([h.tag.name, h.tag.inTagen], ['Weltkindertag', 0]); assert.equal(Y.heute('2026-09-21', 3).tag.name, 'Welt-Alzheimertag'); assert.equal(Y.heute('2026-09-22', 3).tag.name, 'Tag der Zahngesundheit');
  assert.equal(Y.heute('2026-07-10').tag, null); assert.equal(Y.heute('2026-04-10').monat.titel, 'An den September denken'); assert.ok(Y.heute('2026-12-31').woche.length > 20);
  assert.equal(Y.MONAT.length, 12);
});

test('Stand zur Karrierestufe: linear gegen Wertung ÷ 12, eigene und nächste Stufe', () => {
  const s = M.stufenStand('3', 5000, 6);   // HV 9.000 im Jahr = 750 je Monat
  assert.deepEqual([s.eigene.kurz, s.eigene.jeMonat, s.eigene.soll, s.eigene.diff, s.eigene.hochrechnung, s.eigene.restJeMonat], ['HV', 750, 4500, 500, 10000, 666.67]);
  assert.deepEqual([s.naechste.kurz, s.naechste.jeMonat, s.naechste.soll, s.naechste.diff, s.naechste.restJeMonat], ['GV', 1000, 6000, -1000, 1166.67]);
  assert.equal(M.stufenStand('6', 30000, 12).naechste, null); assert.equal(M.stufenStand('6', 30000, 12).eigene.restJeMonat, null);
  assert.deepEqual([M.stufenStand('1', 100, 2).eigene.wertung, M.stufenStand('1', 100, 2).naechste.kurz], [0, 'BV2']);
  assert.equal(M.stufenStand('', 100, 2), null); assert.equal(M.stufenStand('3', 100, 0), null);
});

test('Meine Ziele je Produkt: speichern, Soll bei gleichmäßigem Verlauf, Stand aus Abrechnung oder Antragsbuch', () => {
  const p = M.neuesProjekt(2026);
  M.setzeZiel(p, 'voll', 6000); M.setzeZiel(p, 'zusatz', 1200);
  assert.deepEqual(p.ziele[2026], { voll: 6000, zusatz: 1200 });
  const a = Object.assign(M.neuerAntrag(), { eingang: '2026-02-01', bereich: 'voll', vorgang: 'neu', herkunft: 'neu', vn: { name: 'M', vorname: 'A' } });
  a.positionen = [Object.assign(M.neuePosition(), { tarif: 'AM13', beitrag: 400 }), Object.assign(M.neuePosition(), { tarif: 'PPN', beitrag: 60, bereich: 'pflege' }), Object.assign(M.neuePosition(), { tarif: 'ZP7', beitrag: 30, bereich: 'zusatz' })];
  p.antraege.push(a);
  let s = M.zieleStand(p, [], '2026-06-15');
  const voll = (x) => x.zeilen.find((z) => z.id === 'voll'), zus = (x) => x.zeilen.find((z) => z.id === 'zusatz');
  assert.deepEqual([s.monate, s.hatAbrechnung, voll(s).ziel, voll(s).soll, voll(s).wert, voll(s).diff, voll(s).restJeMonat], [6, false, 6000, 3000, 460, -2540, 923.33]);
  assert.deepEqual([zus(s).wert, zus(s).soll, zus(s).diff], [30, 600, -570]);
  assert.deepEqual([s.gesamt.ziel, s.gesamtAusSumme, s.gesamt.wert, s.gesamt.soll], [7200, true, 490, 3600]);
  // mit Abrechnung zählt die Nettoproduktion
  const zl = [{ bdat: '2026-03-01', prod: 3500, tg: 'Vollversicherung' }, { bdat: '2026-03-02', prod: 60, tg: 'Pflegeversicherung' }, { bdat: '2026-04-01', prod: 700, tg: 'Zusatzversicherung (Art Leben)' }, { bdat: '2025-04-01', prod: 999, tg: 'Vollversicherung' }];
  s = M.zieleStand(p, zl, '2026-06-15');
  assert.deepEqual([s.hatAbrechnung, voll(s).wert, voll(s).diff, zus(s).wert, zus(s).diff, s.gesamt.wert], [true, 3560, 560, 700, 100, 4260]);
  M.setzeZiel(p, 'gesamt', 9000); s = M.zieleStand(p, zl, '2026-06-15'); assert.deepEqual([s.gesamt.ziel, s.gesamtAusSumme, s.gesamt.soll], [9000, false, 4500]);
  M.setzeZiel(p, 'zusatz', null); assert.equal(p.ziele[2026].zusatz, undefined); assert.equal(zus(M.zieleStand(p, zl, '2026-06-15')).ziel, null);
  assert.deepEqual(M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [], einstellungen: {} }).ziele, {});
});

test('Krankentagegeld-Bedarf: Richtwert je Tag, Lücke und Deckung', () => {
  const r = AB.analyse.tagegeld(4100, 800, 0, 100);
  assert.deepEqual([r.bedarfMonat, r.bedarfTag, r.vorhandenMonat, r.lueckeTag, r.lueckeMonat], [4900, 165, 3000, 65, 1900]);
  assert.ok(Math.abs(r.deckung - 3000 / 4900) < 1e-9);
  assert.deepEqual((({ lueckeTag, lueckeMonat, deckung }) => [lueckeTag, lueckeMonat, deckung])(AB.analyse.tagegeld(3000, 600, 0, 150)), [0, 0, 1]);
  assert.equal(AB.analyse.tagegeld(0, 0, 0, 0).deckung, null);
});

test('Ziele: Verteilung auf die Monate in Prozent, Soll folgt der Verteilung', () => {
  const p = M.neuesProjekt(2026); M.setzeZiel(p, 'voll', 12000);
  let v = M.zielVerteilung(p); assert.equal(v.eigen, false); assert.ok(Math.abs(v.prozent[0] - 100 / 12) < 1e-9); assert.equal(v.summe, 100);
  const voll = (s) => s.zeilen.find((z) => z.id === 'voll');
  assert.equal(voll(M.zieleStand(p, [], '2026-06-15')).soll, 6000);
  // August wenig, Jahresende mehr
  M.setzeVerteilung(p, [8, 8, 8, 8, 8, 8, 8, 4, 8, 8, 10, 14]);
  v = M.zielVerteilung(p); assert.deepEqual([v.eigen, v.summe], [true, 100]);
  assert.equal(voll(M.zieleStand(p, [], '2026-06-15')).soll, 5760); assert.equal(voll(M.zieleStand(p, [], '2026-08-15')).soll, 7200); assert.equal(voll(M.zieleStand(p, [], '2027-01-15')).soll, 12000);
  // Summe ungleich 100: gerechnet wird im Verhältnis
  M.setzeVerteilung(p, [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert.equal(M.zielVerteilung(p).summe, 120); assert.equal(voll(M.zieleStand(p, [], '2026-06-15')).soll, 6000);
  M.setzeVerteilung(p, null); assert.equal(M.zielVerteilung(p).eigen, false); assert.equal(p.ziele[2026].voll, 12000);
});

test('Ziele: Rest gleichmäßig verteilen und Vorjahreswerte für die Planung', () => {
  const p = M.neuesProjekt(2026);
  M.setzeVerteilung(p, [100 / 12, 100 / 12, 100 / 12, 100 / 12, 100 / 12, 100 / 12, 100 / 12, 4, 100 / 12, 100 / 12, 100 / 12, 16], [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(M.verteilungFest(p).map(Number), [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(M.verteileRest(p), true);
  const v = M.zielVerteilung(p); assert.equal(v.summe, 100); assert.equal(v.prozent[7], 4); assert.equal(v.prozent[11], 16); assert.equal(v.prozent[0], 8);
  M.setzeVerteilung(p, [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], Array(12).fill(true)); assert.equal(M.verteileRest(p), false, 'sind alle Monate fest, bleibt alles stehen');
  M.setzeVerteilung(p, null); assert.deepEqual(M.verteilungFest(p).some(Boolean), false);
  const zl = [{ bdat: '2025-02-10', prod: 3000, tg: 'Firmentarife' }, { bdat: '2025-02-11', prod: 500, tg: 'Vollversicherung' }, { bdat: '2025-08-01', prod: -100, tg: 'Vollversicherung' }, { bdat: '2025-12-01', prod: 1500, tg: 'Vollversicherung' }, { bdat: '2026-01-05', prod: 999, tg: 'Vollversicherung' }];
  p.vorjahr = M.vorjahrAus(zl, 2025, 'abr2025.csv');
  assert.deepEqual([p.vorjahr.gesamt, p.vorjahr.bereiche, p.vorjahr.monate[1], p.vorjahr.monate[7], p.vorjahr.monate[11]], [4900, { bkv: 3000, voll: 1900 }, 3500, -100, 1500]);
  assert.deepEqual(M.vorjahrVerteilung(p.vorjahr).filter(Boolean), [70, 30]); assert.equal(M.vorjahrVerteilung(null), null);
  M.setzeZiel(p, 'voll', 2400);
  const s = M.zieleStand(p, [], '2026-06-15');
  assert.deepEqual([s.zeilen.find((x) => x.id === 'voll').vorjahr, s.zeilen.find((x) => x.id === 'bkv').vorjahr, s.zeilen.find((x) => x.id === 'leben').vorjahr, s.gesamt.vorjahr], [1900, 3000, 0, 4900]);
  assert.equal(M.zieleStand(M.neuesProjekt(2026), [], '2026-06-15').gesamt.vorjahr, null);
  assert.equal(M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [], einstellungen: {} }).vorjahr == null, true);
});

test('Banken: Auswertung je Beteiligtem aus der Abrechnung, Ziel und Zeitzielerreichung, Reporting', () => {
  const K = AB.bank;
  assert.deepEqual(K.beteiligter('913095 (RB Musterstadt eG, als Bestandsinhaber)'), { nr: '913095', name: 'RB Musterstadt eG', rolle: 'Bestandsinhaber', bank: true });
  assert.equal(K.beteiligter('902648 (Muster, als Bestandsinhaber)').bank, false); assert.equal(K.beteiligter(''), null); assert.equal(K.beteiligter('913095').nr, '913095');
  const z = (o) => Object.assign({ bdat: '2026-03-05', prod: 0, prov: 0, tg: 'Vollversicherung', sparte: 'KVUV', tarif: 'AM13', part: 'Abschluss', st: 0, vnr: '100', pnr: '1', beteil: '913095 (RB Musterstadt eG, als Bestandsinhaber)' }, o);
  const zl = [z({ prod: 400, prov: 1200 }), z({ prod: 60, prov: 180, tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP7', pnr: '2' }), z({ prod: 2, prov: 6, tg: 'Zusatzversicherung (Art Leben)', tarif: 'PG3AD', part: 'Erhöhung', bdat: '2026-05-01', vnr: '200' }),
    z({ prod: 0, prov: 3, tg: 'Unfallversicherung', tarif: 'UT', part: 'Bestand', bdat: '2026-04-30', vnr: '300' }), z({ prod: 3, tg: 'Unfallversicherung', tarif: 'UT', vnr: '300', bdat: '2026-02-01' }),
    z({ prod: 50, prov: 100, beteil: '912040 (VR Beispiel, als Bestandsinhaber)', vnr: '400' }), z({ prod: 999, beteil: '' }), z({ prod: 77, bdat: '2025-03-05' }), z({ prod: 10, beteil: '', bdat: '2026-06-10' })];
  const l = K.rechne(zl, 2026), b = l[0];
  assert.deepEqual(l.map((x) => x.nr), ['913095', '912040']);
  assert.deepEqual([b.name, b.prod, b.kv, b.uv, b.lv, b.zusatz, b.dynamik, b.prov, b.provLaufend, b.vertraege, b.personen, b.neuePersonen, b.stand, b.hr], ['RB Musterstadt eG', 465, 462, 3, 0, 62, 2, 1386, 3, 3, 4, 3, 6, 930]);
  assert.deepEqual([b.monate[1], b.monate[2], b.monate[4], b.bereiche], [3, 460, 2, { voll: 400, zusatz: 62, unfall: 3 }]);
  const p = M.neuesProjekt(2026); K.setze(p, '913095', 'ziel', 1200);
  const zi = K.ziel(p, b); assert.deepEqual([zi.plan, zi.zeitziel, zi.fehlt, Math.round(zi.grad * 100), Math.round(zi.hrGrad * 100)], [1200, 600, 735, 78, 78]);
  assert.equal(K.ziel(p, l[1]).plan, null); K.setze(p, '913095', 'ziel', null); assert.equal(K.ziel(p, b).plan, null);
  const t = K.tabelle(p, l); t.zeilen.forEach((r) => assert.equal(r.length, t.spalten.length));
  const rep = K.reporting(p, b); assert.deepEqual(rep.map((x) => x.name), ['Bankenreporting', 'Verlauf']); rep.forEach((bl) => bl.zeilen.forEach((r) => assert.equal(r.length, bl.spalten.length)));
  assert.deepEqual(rep[0].zeilen.find((r) => r[0] === 'Gesamt'), ['Gesamt', 465, 930]); assert.ok(AB.xlsxout.schreibe(rep).length > 1000);
});

test('Bankenbonus 2026: Stufe, Grundbonus, Sonderbonus Zusatz, Fehlbetrag – geprüft am Muster-Reporting', () => {
  const B = AB.bank.bonus;
  // Muster: Produktion 2.994 € (davon Zusatz 1.515 €) → 1.497 € + 303 €, es fehlen 506 € zur nächsten Stufe
  assert.deepEqual((({ stufe, grundMB, sonderMB, grund, sonder, gesamt, fehlt }) => [stufe, grundMB, sonderMB, grund, sonder, gesamt, fehlt])(B(2994, 1515)), [1, 0.5, 0.2, 1497, 303, 1800, 506]);
  // Hochrechnung 7.185 € (Zusatz 3.633 €) → 7.185 € + 5.449,50 €
  assert.deepEqual((({ stufe, grund, sonder }) => [stufe, grund, sonder])(B(7185, 3633)), [3, 7185, 5449.5]);
  assert.deepEqual([B(1999, 500).stufe, B(1999, 500).gesamt, B(1999, 500).fehlt, B(3500, 0).stufe, B(25000, 100).stufe, B(25000, 100).fehlt, B(25000, 100).sonder], [0, 0, 1, 2, 6, null, 590]);
});

test('Produktionsjahr: Produktionsschluss, Beginn im Folgejahr, offene Anträge und Jahreswechsel in derselben Datei', () => {
  const p = M.neuesProjekt(2026);
  const A = (o) => Object.assign(M.neuerAntrag(), { bereich: 'voll', vorgang: 'neu', herkunft: 'neu', vn: { name: 'M', vorname: 'A' } }, o);
  const pol = (a, datum) => { M.setzeStatus(a, 'policiert', datum, 'vdienst'); return a; };
  const pj = (a) => M.produktionsjahr(a, p);
  assert.equal(M.produktionsschluss(p, 2026), '2026-12-18');
  // im Oktober beantragt, Beginn 1.1.27, vor dem Produktionsschluss policiert → Produktion 2026
  assert.equal(pj(pol(A({ eingang: '2026-10-05', beginn: '2027-01-01' }), '2026-12-10')), 2026);
  // derselbe Antrag, aber erst nach dem 18.12. policiert → 2027
  assert.equal(pj(pol(A({ eingang: '2026-10-05', beginn: '2027-01-01' }), '2026-12-22')), 2027);
  // Beginn ab dem 2. Januar des Folgejahres → zählt nicht im alten Jahr, auch wenn früh policiert
  assert.equal(pj(pol(A({ eingang: '2026-09-10', beginn: '2027-02-01' }), '2026-09-25')), 2027);
  // nach dem Produktionsschluss eingereicht → Folgejahr
  assert.equal(pj(A({ eingang: '2026-12-21', beginn: '2027-01-01' })), 2027); assert.equal(pj(A({ eingang: '2026-12-18' })), 2026);
  // abgerechnet zählt das Buchungsdatum; die Policierung davor ist maßgeblich
  const ab = pol(A({ eingang: '2026-11-20' }), '2026-12-15'); M.setzeStatus(ab, 'abgerechnet', '2027-01-08', 'abgleich'); assert.equal(pj(ab), 2026);
  assert.equal(M.produktionsjahr(A({ eingang: '2026-11-20' }), p, { buendel: [{ bdat: '2026-12-30' }] }), 2027);
  // eigener Produktionsschluss
  p.einstellungen.produktionsschluss = { 2026: '2026-12-20' }; assert.equal(pj(A({ eingang: '2026-12-20' })), 2026); assert.equal(pj(A({ eingang: '2026-12-21' })), 2027); delete p.einstellungen.produktionsschluss;
  // Auswertung: Monat der Einreichung, aus dem Vorjahr herübergezogen im Januar
  assert.deepEqual(M.zaehlt(A({ eingang: '2026-03-05' }), p), { jahr: 2026, monat: 2 });
  // Jahreswechsel: Abrechnung wandert ins Archiv, Vorjahreswerte bleiben, offene Anträge ziehen mit, abgerechnete bleiben im alten Jahr
  const offen = A({ eingang: '2026-11-25', vn: { name: 'Offen', vorname: 'O' } }), spaet = A({ eingang: '2026-12-22', vn: { name: 'Spaet', vorname: 'S' } }), fertig = A({ eingang: '2026-05-05', vn: { name: 'Fertig', vorname: 'F' } });
  M.setzeStatus(fertig, 'abgerechnet', '2026-06-10', 'abgleich'); p.antraege.push(offen, spaet, fertig);
  p.abrechnung = AB.abrechnung.packe([{ bdat: '2026-06-10', prod: 400, prov: 2200, tg: 'Vollversicherung', vm: '900999', vnr: '1', pnr: '1', tarif: 'AM13', part: 'Abschluss', mbd: 400 }]); p.importe = [{ nr: 1 }]; p.importZaehler = 1;
  p.bonus = Object.assign(AB.bonus.leer(), { stufe: '3', neueVoll: 5 }); M.setzeZiel(p, 'voll', 5000);
  assert.deepEqual([pj(offen), pj(spaet), pj(fertig)], [2026, 2027, 2026]);
  assert.equal(AB.kennzahlen.rechne(p, null, []).jahr.antraege, 2, '2026 zählt den offenen und den abgerechneten, nicht den nach dem Produktionsschluss');
  assert.equal(M.jahreswechsel(p, 2027), true);
  assert.deepEqual([p.jahr, p.abrechnung, p.importe.length, p.bonus.stufe, p.bonus.neueVoll, M.archivJahre(p), p.vorjahr.jahr, p.vorjahr.gesamt, p.antraege.length], [2027, null, 0, '3', null, [2026], 2026, 400, 3]);
  assert.deepEqual([pj(offen), pj(spaet), pj(fertig)], [2027, 2027, 2026], 'der offene Antrag zieht ins neue Jahr mit');
  const k27 = AB.kennzahlen.rechne(p, null, []); assert.equal(k27.jahr.antraege, 2); assert.equal(k27.monate[0].antraege, 2, 'herübergezogene Anträge stehen im Januar');
  assert.equal(p.ziele[2026].voll, 5000); assert.equal(M.zieleStand(p, [], '2027-02-10').zeilen.find((x) => x.id === 'voll').ziel, null);
  // zurück ins archivierte Jahr: alles wieder da
  assert.equal(M.jahreswechsel(p, 2026), true);
  assert.deepEqual([p.jahr, AB.abrechnung.entpacke(p.abrechnung).length, p.importe.length, p.bonus.neueVoll, M.archivJahre(p)], [2026, 1, 1, 5, [2027]]);
  assert.equal(M.jahreswechsel(p, 2026), false);
});
