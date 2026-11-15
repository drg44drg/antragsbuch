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
