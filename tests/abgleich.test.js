const test = require('node:test'), assert = require('node:assert/strict');
const AB = require('./lade.js');
const { erzeuge, zeile, KOPF } = require('../tools/testdaten.js');
const U = AB.util, S = AB.abrechnung, M = AB.model, A = AB.abgleich;
const HEUTE = '2026-04-15';

async function stand(bis) {
  const d = erzeuge(), p = M.migriere(JSON.parse(d.dateien['beispielprojekt.antragsbuch.json'].toString()));
  let alt = null, letzter;
  for (const f of ['01', '01-02', '01-03']) {
    p.importZaehler++;
    letzter = await AB.importer.lies(new Uint8Array(d.dateien['abrechnung_2026_' + f + '.csv']), f + '.csv', { alt, importNr: p.importZaehler, jahr: 2026, vermittlernummer: '900999' });
    alt = letzter.gepackt;
    if (f === bis) break;
  }
  const zeilen = S.entpacke(alt);
  return { p, zeilen, letzter, erg: A.rechne(p, zeilen, HEUTE) };
}
const ids = (l) => l.map((r) => r.antrag.id).sort();

test('Import erkennt die Abrechnung und meldet Kodierung, Summe und Vergleich', async () => {
  const { letzter } = await stand('01-03');
  assert.equal(letzter.art, 'abrechnung');
  assert.equal(letzter.info.kodierung, 'Windows-1252');
  assert.equal(letzter.vergleich.neu, 67);
  assert.deepEqual(letzter.warnungen, []);
  assert.ok(letzter.tarife.some((t) => t.name === 'BE MAX' && t.gruppe === 'Vollversicherung'));
});

test('Alle fünf Listen werden korrekt befüllt (Stand Jan–Mrz)', async () => {
  const { erg } = await stand('01-03');
  assert.deepEqual(ids(erg.gleich), ['a-1', 'a-11', 'a-12', 'a-13', 'a-14', 'a-15', 'a-7', 'a-8']);
  assert.deepEqual(ids(erg.abweichung), ['a-2', 'a-3']);
  assert.deepEqual(ids(erg.offen), ['a-4', 'a-5']);
  assert.deepEqual(ids(erg.storno), ['a-6', 'a-7']);
  assert.deepEqual(erg.neu.map((b) => b.vnr).sort(), ['120120', '130130', '140140', '150150', '300300']);
  // nicht geprüft: Umstellung ohne Provision und GKV; zu jung für OFFEN: a-16, a-17
  for (const id of ['a-9', 'a-10', 'a-16', 'a-17']) assert.equal(erg.proAntrag[id].liste, '');
});

test('GLEICH: führende Null, mehrere Personen/Tarife, Buchungsmonat und Ist-Provision', async () => {
  const { erg } = await stand('01-03');
  const r = erg.proAntrag['a-1'];
  assert.equal(r.buendel.length, 2, 'ein Bündel je Person');
  assert.equal(r.istB, 420.5); assert.equal(r.istP, 2312.75); assert.equal(r.monat, '2026-01');
  assert.equal(r.diffB, 0); assert.equal(r.diffP, 0);
  assert.deepEqual(ids(erg.haftung), ['a-1'], 'laufende Stornohaftung');
  assert.equal(erg.proAntrag['a-15'].istB, 20, 'identische Doppelzeilen zählen beide');
});

test('ABWEICHUNG zeigt Soll, Ist und Differenz – Beitrag bzw. Provision', async () => {
  const { erg, p, zeilen } = await stand('01-03');
  const b = erg.proAntrag['a-2'];
  assert.equal(b.sollB, 35); assert.equal(b.istB, 32.1); assert.equal(b.diffB, -2.9); assert.equal(b.abwB, true);
  const pr = erg.proAntrag['a-3'];
  assert.equal(pr.abwB, false); assert.equal(pr.abwP, true); assert.equal(pr.sollP, 120); assert.equal(pr.istP, 100); assert.equal(pr.diffP, -20);
  // Toleranz
  p.einstellungen.toleranzBeitrag = 3;  p.einstellungen.pruefeProvision = false;
  assert.deepEqual(ids(A.rechne(p, zeilen, HEUTE).abweichung), []);
  p.einstellungen.toleranzBeitrag = 0.05; p.einstellungen.pruefeProvision = true;
  // Abweichung akzeptieren
  p.antraege.find((a) => a.id === 'a-3').abweichungOk = pr.fingerabdruck;
  assert.deepEqual(ids(A.rechne(p, zeilen, HEUTE).abweichung), ['a-2']);
});

test('Zwei Anträge auf demselben Vertrag bekommen je ihre Buchung', async () => {
  const { erg } = await stand('01-03');
  assert.equal(erg.proAntrag['a-13'].monat, '2026-01'); assert.equal(erg.proAntrag['a-13'].istB, 100);
  assert.equal(erg.proAntrag['a-14'].monat, '2026-03'); assert.equal(erg.proAntrag['a-14'].istB, 25);
});

test('Sonderfälle: Minderbeitrag, Leben, Unfall laufend', async () => {
  const { erg } = await stand('01-03');
  assert.equal(erg.proAntrag['a-8'].istB, -20); assert.equal(erg.proAntrag['a-8'].liste, 'gleich');
  assert.equal(erg.proAntrag['a-8'].stornos.length, 0, 'erwarteter Minderbeitrag ist kein Storno');
  assert.equal(erg.proAntrag['a-12'].istP, 600);
  const u = erg.proAntrag['a-11'];
  assert.equal(u.buendel.length, 3); assert.equal(u.sollPGesamt, 18); assert.equal(u.istP, 18); assert.equal(u.liste, 'gleich');
});

test('STORNO: volle Rückbuchung setzt Status, Teil-Rückbuchung nicht; Grund und Haftung', async () => {
  const { erg, p } = await stand('01-03');
  const voll = erg.proAntrag['a-6'], teil = erg.proAntrag['a-7'];
  assert.equal(voll.vollStorno, true); assert.equal(voll.stB, -48); assert.equal(voll.stGrund, 'Kündigung');
  assert.equal(teil.vollStorno, false); assert.equal(teil.stB, -12.5); assert.equal(teil.shEnde, '2031-01-01');
  assert.equal(A.wendeStatusAn(p, erg), 11);
  const st = (id) => p.antraege.find((a) => a.id === id);
  assert.equal(st('a-6').status, 'storno'); assert.equal(st('a-6').statusDatum, '2026-03-10');
  assert.equal(st('a-7').status, 'abgerechnet'); assert.equal(st('a-1').status, 'abgerechnet'); assert.equal(st('a-1').statusDatum, '2026-01-15');
  assert.equal(st('a-4').status, 'eingereicht'); assert.equal(st('a-9').status, 'eingereicht'); assert.equal(st('a-10').status, 'eingereicht');
  assert.deepEqual(st('a-6').historie.map((h) => h.quelle), ['manuell', 'abgleich']);
});

test('Status: manuell überschreibbar; Automatik nimmt zurück, wenn die Buchung entfällt', async () => {
  const { erg, p, zeilen } = await stand('01-03');
  A.wendeStatusAn(p, erg);
  const a6 = p.antraege.find((a) => a.id === 'a-6'), a1 = p.antraege.find((a) => a.id === 'a-1');
  M.setzeStatus(a6, 'reklamiert', '2026-04-01', 'manuell');
  let e2 = A.rechne(p, zeilen, HEUTE);
  assert.equal(e2.status.length, 0, 'manueller Status bleibt');
  assert.equal(a6.statusManuell, true);
  // Buchung zu a-1 fällt weg → zurück auf den Status vor dem Abgleich
  e2 = A.rechne(p, zeilen.filter((z) => U.normVnr(z.vnr) !== '12345'), HEUTE);
  assert.deepEqual(e2.status.filter((s) => s.id === 'a-1'), [{ id: 'a-1', status: 'eingereicht', datum: '2026-01-05' }]);
  A.wendeStatusAn(p, e2);
  assert.equal(a1.status, 'eingereicht');
});

test('Stufe 2: Vorschlag über Name/Beitrag/Beginn/Tarif, Bestätigung trägt Vertragsnummer ein und bleibt erhalten', async () => {
  const { erg, p, zeilen } = await stand('01-03');
  assert.equal(erg.vorschlaege.length, 1);
  const v = erg.vorschlaege[0];
  assert.equal(v.reihe.antrag.id, 'a-5'); assert.equal(v.kandidaten[0].vnr, '300300'); assert.ok(v.kandidaten[0].punkte >= 90);
  assert.deepEqual(v.kandidaten[0].gruende, ['Beitrag stimmt', 'Provision stimmt', 'Name stimmt', 'Beginn stimmt', 'Tarif stimmt']);
  assert.deepEqual(ids(erg.ohneNr), ['a-5'], 'Bestandsgeschäft ohne Vertragsnummer wird angemahnt, Neugeschäft erst nach Policierung');
  A.bestaetige(p, 'a-5', v.kandidaten[0]);
  const a5 = p.antraege.find((a) => a.id === 'a-5');
  assert.equal(a5.vertragsnummer, '300300');
  const e2 = A.rechne(p, zeilen, HEUTE);
  assert.equal(e2.proAntrag['a-5'].liste, 'gleich'); assert.equal(e2.proAntrag['a-5'].manuell, true);
  assert.ok(!e2.neu.some((b) => b.vnr === '300300'));
  // Zuordnung bleibt auch erhalten, wenn die Nummer später geändert/gelöscht wird (neuer Import = gleiche Schlüssel)
  a5.vertragsnummer = '';
  assert.equal(A.rechne(p, zeilen, HEUTE).proAntrag['a-5'].liste, 'gleich');
});

test('NEU OHNE ANTRAG: Markierung „neu", abhaken, als Antrag übernehmen', async () => {
  const { erg, p, zeilen } = await stand('01-03');
  assert.deepEqual(erg.neu.filter((b) => b.neu).map((b) => b.vnr).sort(), ['140140', '150150'], 'nur März-Buchungen sind neu');
  const dyn = erg.neu.find((b) => b.vnr === '120120');
  p.ignoriert[dyn.key] = { am: HEUTE };
  let e2 = A.rechne(p, zeilen, HEUTE);
  assert.equal(e2.neu.find((b) => b.vnr === '120120').ignoriert, true);
  const verg = e2.neu.find((b) => b.vnr === '140140');
  const a = A.antragAusBuendel(p, [verg]);
  assert.equal(a.vn.name, 'DEMO'); assert.equal(a.vn.vorname, 'FRITZ'); assert.equal(a.bereich, 'zusatz'); assert.equal(a.vorgang, 'neu');
  assert.equal(a.vertragsnummer, '140140'); assert.equal(M.beitrag(a), 28.9);
  e2 = A.rechne(p, zeilen, HEUTE);
  assert.equal(e2.proAntrag[a.id].liste, 'gleich');
  assert.ok(!e2.neu.some((b) => b.vnr === '140140'));
});

test('Provisionsart-Filter: Hierarchie und Legacy sind standardmäßig ausgeblendet', async () => {
  const { p, zeilen, erg } = await stand('01-03');
  assert.ok(zeilen.some((z) => z.part === 'Hierarchie'));
  assert.ok(erg.neu.every((b) => b.arten.every((a) => a !== 'Hierarchie' && a !== 'Legacy')));
  p.einstellungen.provisionsarten.push('Hierarchie', 'Legacy');
  assert.ok(A.rechne(p, zeilen, HEUTE).neu.length > 150);
});

test('OFFEN hängt von der Frist ab; Stand Januar hat weniger Treffer', async () => {
  const { erg, p, zeilen } = await stand('01');
  assert.deepEqual(ids(erg.gleich), ['a-1', 'a-11', 'a-13', 'a-6', 'a-7']);
  assert.ok(ids(erg.offen).includes('a-2'));
  p.einstellungen.offenTage = 200;
  assert.deepEqual(A.rechne(p, zeilen, HEUTE).offen, []);
});

test('Kennzahlen und Hinweise', async () => {
  const { erg, p, zeilen } = await stand('01-03');
  A.wendeStatusAn(p, erg);
  const k = AB.kennzahlen.rechne(p, A.rechne(p, zeilen, HEUTE), zeilen, HEUTE);
  assert.equal(k.jahr.antraege, 17);
  assert.equal(k.monate[0].antraege + k.monate[1].antraege + k.monate[2].antraege, 17);
  assert.equal(k.jahr.stornoAnz, 1); assert.equal(k.jahr.storno, 48);
  assert.equal(k.jahr.abgerechnetAnz, 10);
  assert.equal(k.jahr.bereiche.gkv.stueck, 2);
  assert.equal(U.runde(k.jahr.netto), U.runde(k.jahr.brutto + k.jahr.minder - 48));
  assert.ok(k.hinweise.some((h) => /1 Antrag ohne Vertragsnummer/.test(h.text)));
  assert.ok(k.hinweise.some((h) => /2 seit 60 Tagen offen/.test(h.text)));
  assert.equal(k.jahr.voraussichtlich, U.runde(k.jahr.policiert + k.jahr.abgerechnet)); assert.ok(k.jahr.abgerechnet <= k.jahr.brutto);
  const csv = AB.kennzahlen.exportAntraege(p, erg);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.equal(csv.trim().split('\r\n').length, 1 + p.antraege.reduce((s, a) => s + a.positionen.length, 0));
  for (const l of ['gleich', 'abweichung', 'offen', 'neu', 'storno']) assert.match(AB.kennzahlen.exportAbgleich(erg, l), /;/);
});

test('Veränderungsdienst: Spalten raten, Treffer über Nummer und Name, Status „Policiert"', async () => {
  const d = erzeuge(), p = M.migriere(JSON.parse(d.dateien['beispielprojekt.antragsbuch.json'].toString()));
  const t = await AB.importer.lies(new Uint8Array(d.dateien['veraenderungsdienst.csv']), 'vd.csv');
  assert.equal(t.art, 'tabelle');
  const zl = t.blaetter[0].zeilen, k = AB.vdienst.kopfzeile(zl), map = AB.vdienst.rate(zl[k]);
  assert.deepEqual(map, { vnr: 1, name: 2, beitrag: 6, beitragAlt: 5, beitragNeu: 7 });
  const s = AB.vdienst.lies(zl, k, map);
  assert.equal(s[0].vnr, '0777001'); assert.equal(s[0].beitrag, 410);
  const z = AB.vdienst.ordneZu(s, p.antraege, 0.05);
  assert.deepEqual(z.treffer.map((x) => [x.antrag.id, x.art, x.sicher]), [['a-17', 'name', true], ['a-3', 'vnr', true]]);
  assert.equal(z.ohne.length, 1);
  assert.equal(AB.vdienst.uebernimm(z.treffer), 2);
  const a17 = p.antraege.find((a) => a.id === 'a-17');
  assert.equal(a17.vertragsnummer, '0777001'); assert.equal(a17.status, 'policiert'); assert.equal(a17.historie[1].quelle, 'vdienst');
});

test('Team: Monatsscheiben, Position, Pseudonymisierung, Management-Würfel', async () => {
  const d = erzeuge();
  const t = (await AB.importer.lies(new Uint8Array(d.dateien['monatsscheiben.xlsx']), 'm.xlsx')).team;
  assert.equal(t.zeilen.length, 8); assert.equal(t.zeilen[0].gesamt, true); assert.equal(t.stand, '2026-03-31'); assert.equal(t.jahr, 2026);
  const pos = AB.team.position(t, '900999');
  assert.equal(pos.ich.name, 'BEISPIEL-ADP'); assert.equal(pos.letzterMonat, 2); assert.equal(pos.ytd.n, 7);
  assert.ok(pos.ytd.rang >= 1 && pos.ytd.rang <= 7);
  const ps = AB.team.pseudonymisiere(t);
  assert.ok(ps.zeilen.every((z) => z.name === '' && /^p/.test(z.nr)));
  assert.ok(!JSON.stringify(ps).includes('TESTER'));
  assert.equal(AB.team.position(ps, '900999').ytd.rang, pos.ytd.rang, 'eigene Zeile wird über das Pseudonym gefunden');
  const { zeilen } = await stand('01-03');
  const w = AB.team.wuerfel(zeilen, 2026);
  assert.ok(w.adps.includes('900101') && w.adps.includes('900999'));
  const alle = AB.team.auswertung(w, { arten: new Set(['Hierarchie']) });
  const sum = zeilen.filter((z) => z.part === 'Hierarchie').reduce((s, z) => s + z.mbd, 0);
  assert.ok(Math.abs(alle.gesamt.netto - sum) < 0.01);
  const einer = AB.team.auswertung(w, { arten: new Set(['Hierarchie']), adps: new Set(['900101']) });
  assert.ok(Math.abs(einer.gesamt.netto - alle.proAdp['900101'].netto) < 0.01);
  assert.equal(AB.team.kategorie({ mb: 50, mbd: 50 }), 'neu'); assert.equal(AB.team.kategorie({ mb: 80, mbd: 10 }), 'mehr');
  assert.equal(AB.team.kategorie({ mb: 0, mbd: -50 }), 'storno'); assert.equal(AB.team.kategorie({ mb: 40, mbd: -5 }), 'minder');
  assert.equal(AB.team.schreiber({ beteil: '900385 (Geschrieben), 900341 (Ohne Mitwirkung, als Bestandsinhaber)' }), '900385');
});

test('50.000+ Zeilen: Einlesen, Vergleich und Abgleich bleiben schnell', async () => {
  const zl = [KOPF.join(';')];
  for (let i = 0; i < 52000; i++) zl.push(zeile({ vnr: String(100000 + (i % 30000)), name: 'MUSTER, ANNA', tarif: 'T' + (i % 40), mbd: (i % 97) + 0.5,
    bdat: '2026-0' + (1 + i % 9) + '-15', art: i % 20 ? 'Hierarchie' : 'Abschluss', beteil: '9001' + (10 + i % 30) + ' (Geschrieben, als Bestandsinhaber)' }).join(';'));
  const bytes = new Uint8Array(Buffer.from(zl.join('\r\n'), 'latin1'));
  const p = M.neuesProjekt(2026);
  for (let i = 0; i < 300; i++) { const a = M.neuerAntrag(); a.vn = { name: 'Muster', vorname: 'Anna' }; a.vertragsnummer = String(100000 + i * 20); a.eingang = '2026-01-02'; a.positionen[0].tarif = 'T'; a.positionen[0].beitrag = 10; p.antraege.push(a); }
  let t0 = Date.now();
  const r1 = await AB.importer.lies(bytes, 'gross.csv', { importNr: 1 });
  const r2 = await AB.importer.lies(bytes, 'gross.csv', { alt: r1.gepackt, importNr: 2 });
  const tImport = Date.now() - t0;
  assert.equal(r1.anzahl, 52000); assert.equal(r2.vergleich.neu, 0);
  const zeilen = S.entpacke(r2.gepackt);
  p.einstellungen.provisionsarten = S.PROVISIONSARTEN.slice();
  t0 = Date.now();
  const erg = A.rechne(p, zeilen, HEUTE); AB.team.wuerfel(zeilen, 2026);
  const tAbgleich = Date.now() - t0;
  assert.ok(erg.gleich.length + erg.abweichung.length > 250);
  assert.ok(tImport < 6000, 'Import 2× ' + tImport + ' ms');
  assert.ok(tAbgleich < 3000, 'Abgleich ' + tAbgleich + ' ms');
});

test('Korrektur im Folgemonat (z. B. nach Reklamation) wird nachgezogen: Abweichung → Gleich', async () => {
  const { p, zeilen, erg } = await stand('01-03');
  assert.deepEqual(ids(erg.abweichung), ['a-2', 'a-3']);
  const kopie = (vnr, mehr) => Object.assign({}, zeilen.find((z) => U.normVnr(z.vnr) === vnr), mehr);
  // a-3: 20 € Provision fehlten → Nachzahlung im April (Manuell, ohne Beitragsdifferenz)
  const nach = kopie('250250', { mbd: 0, prov: 20, bdat: '2026-04-09', part: 'Manuell', imp: 4 });
  // a-2: 2,90 € Beitrag fehlten → Korrekturbuchung im April
  const korr = kopie('200200', { mbd: 2.9, prov: 13.05, bdat: '2026-04-09', imp: 4 });
  p.importZaehler = 4;
  const e2 = A.rechne(p, zeilen.concat([nach, korr]), HEUTE);
  assert.deepEqual(ids(e2.abweichung), []);
  assert.equal(e2.proAntrag['a-3'].istP, 120); assert.equal(e2.proAntrag['a-3'].nachbuchung, true);
  assert.equal(e2.proAntrag['a-2'].istB, 35); assert.equal(e2.proAntrag['a-2'].buendel.length, 2);
  assert.ok(!e2.neu.some((b) => b.monat === '2026-04'), 'Korrekturen landen nicht unter „Neu ohne Antrag"');
  // eine nicht passende Buchung bleibt unter „Neu ohne Antrag"
  const fremd = kopie('250250', { mbd: 0, prov: 7, bdat: '2026-04-09', part: 'Manuell', imp: 4 });
  const e3 = A.rechne(p, zeilen.concat([fremd]), HEUTE);
  assert.deepEqual(ids(e3.abweichung), ['a-2', 'a-3']);
  assert.ok(e3.neu.some((b) => b.vnr === '250250'));
});

test('Werktage und Bearbeitungsampel', () => {
  assert.equal(U.werktage('2026-10-02', '2026-10-09'), 5);          // Fr → Fr der Folgewoche
  assert.equal(U.werktage('2026-12-23', '2026-12-28'), 2);          // 24.12. zählt, 25./26. Feiertag, Wochenende
  assert.equal(U.werktage('2026-04-02', '2026-04-07'), 1);          // Karfreitag und Ostermontag 2026
  assert.equal(U.werktage('2026-05-13', '2026-05-15'), 1);          // Christi Himmelfahrt 14.05.2026
  assert.equal(U.werktage('2026-01-05', '2026-01-05'), 0);
  const e = M.standardEinstellungen();
  const a = M.neuerAntrag(); a.eingang = '2026-10-05'; a.vertragsnummer = '1';
  assert.equal(M.ampel(a, e, '2026-10-08').stufe, 'gruen');
  assert.equal(M.ampel(a, e, '2026-10-12').stufe, 'gelb');           // 5 Werktage
  assert.equal(M.ampel(a, e, '2026-10-19').stufe, 'rot');            // 10 Werktage
  e.sla.voll = { gelb: 2, rot: 3 };
  assert.equal(M.ampel(a, e, '2026-10-08').stufe, 'rot');
  a.nachbearbeitung = { status: 'offen', text: 'Gesundheitsfragen', datum: '2026-10-06' };
  const nb = M.ampel(a, M.standardEinstellungen(), '2026-10-06');
  assert.equal(nb.stufe, 'rot'); assert.match(nb.grund, /Nachbearbeitung offen: Gesundheitsfragen/);
  a.nachbearbeitung.status = 'erledigt';
  // policiert Anfang Oktober → Abrechnung erst um den 6. des Folgemonats erwartet
  M.setzeStatus(a, 'policiert', '2026-10-07', 'vdienst');
  assert.equal(M.ampel(a, e, '2026-10-30').stufe, 'gruen');
  assert.equal(M.ampel(a, e, '2026-11-10').stufe, 'gelb');
  assert.equal(M.ampel(a, e, '2026-11-10', true).stufe, 'gruen');
  assert.equal(M.ampel(a, e, '2026-12-20').stufe, 'rot');
  a.vertragsnummer = '';
  assert.match(M.ampel(a, e, '2026-10-30').grund, /Vertragsnummer fehlt/);
  M.setzeStatus(a, 'abgerechnet', '2026-11-06', 'abgleich');
  assert.equal(M.ampel(a, e, '2026-12-20').stufe, '');
});

test('Excel-Export: formatierte Arbeitsmappe ist lesbar und enthält Farben und Zahlenformate', async () => {
  const { p, erg } = await stand('01-03');
  const t = AB.kennzahlen.tabelleAntraege(p, erg), pr = AB.kennzahlen.tabellePrio(p, erg, p.antraege.slice(0, 5), HEUTE);
  const bytes = AB.xlsxout.schreibe([Object.assign({ name: 'Anträge', titel: 'Anträge 2026' }, t), Object.assign({ name: 'Prioritätenliste' }, pr)]);
  assert.deepEqual([...bytes.subarray(0, 2)], [0x50, 0x4B]);
  const zurueck = await AB.xlsx.lies(bytes);
  assert.deepEqual(zurueck.map((b) => b.name), ['Anträge', 'Prioritätenliste']);
  const kopf = zurueck[0].zeilen.findIndex((z) => z[1] === 'Eingang'), z1 = zurueck[0].zeilen[kopf + 1];
  assert.equal(z1[1], '2026-01-05', 'Datum als echtes Excel-Datum'); assert.equal(z1[2], 'Muster'); assert.equal(typeof z1[10], 'number');
  assert.equal(zurueck[0].zeilen.length, kopf + 1 + t.zeilen.length);
  assert.equal(zurueck[1].zeilen[1].length, pr.spalten.length);
  const roh = Buffer.from(bytes).toString('latin1');
  assert.match(roh, /FF6250D6/); assert.match(roh, /\[Red\]/); assert.match(roh, /state="frozen"/);
});

test('Reklamation: Status, automatische Erledigung durch Korrekturbuchung', async () => {
  const { p, zeilen, erg } = await stand('01-03');
  A.wendeStatusAn(p, erg);
  const a3 = p.antraege.find((a) => a.id === 'a-3'), a4 = p.antraege.find((a) => a.id === 'a-4');
  a3.reklamation = { datum: HEUTE, ergebnis: '' };                       // Abweichung reklamiert: Status bleibt „Abgerechnet"
  a4.reklamation = { datum: HEUTE, ergebnis: '' }; M.setzeStatus(a4, 'reklamiert', HEUTE, 'reklamation'); a4.vertragsnummer = '444444';
  assert.equal(a4.statusManuell, false);
  let e2 = A.rechne(p, zeilen, HEUTE);
  assert.equal(A.schliesseReklamationen(p, e2), 0);
  assert.ok(AB.kennzahlen.rechne(p, e2, zeilen, HEUTE).hinweise.some((h) => /2 Reklamationen offen/.test(h.text)));
  // Korrekturen kommen mit der nächsten Abrechnung
  const basis = zeilen.find((z) => U.normVnr(z.vnr) === '250250');
  const nach = Object.assign({}, basis, { mbd: 0, prov: 20, bdat: '2026-04-09', part: 'Manuell' });
  const neu = Object.assign({}, basis, { vnr: '444444', vnName: 'PLATZHALTER, ANNA', tg: 'Zusatzversicherung (Art Leben)', tarif: 'ZP9', mb: 22.4, mbd: 22.4, prov: 100.8, bdat: '2026-04-09', part: 'Abschluss', gvnr: '' });
  e2 = A.rechne(p, zeilen.concat([nach, neu]), HEUTE);
  assert.equal(A.wendeStatusAn(p, e2), 1);
  assert.equal(a4.status, 'abgerechnet', 'reklamierter Antrag wird nach der Buchung abgerechnet');
  e2 = A.rechne(p, zeilen.concat([nach, neu]), HEUTE);
  assert.equal(A.schliesseReklamationen(p, e2), 2);
  assert.equal(a3.reklamation.ergebnis, 'erfolgreich'); assert.equal(a3.reklamation.erledigtAm, '2026-04-09'); assert.equal(a3.reklamation.automatisch, true);
  assert.equal(A.schliesseReklamationen(p, e2), 0, 'nur einmal');
});

test('Tarif-Einordnung aus dem Tarifverzeichnis: Beschreibung, Kategorie, Beihilfe, Tarifwelt', () => {
  const T = AB.tarif, V = 'Vollversicherung', ZL = 'Zusatzversicherung (Art Leben)';
  assert.ok(T.verzeichnis().size > 750);
  let e = T.einordnen('A107a', V);
  assert.deepEqual([e.beschreibung, e.kategorie, e.beihilfe, e.welt, e.sicher], ['Ambulanter Tarif', 'Ambulant', false, 'a', true]);
  e = T.einordnen('A20a', V);
  assert.deepEqual([e.beschreibung, e.kategorie, e.beihilfe], ['Ambulanter Tarif - Beihilfeberechtigte', 'Ambulant', true]);
  assert.equal(T.sparte('A20a', V), 'Beihilfe · Ambulant'); assert.equal(T.sparte('A107a', V), 'Ambulant');
  assert.equal(T.einordnen('S30a', V).beihilfe, true); assert.equal(T.einordnen('S101a', V).beihilfe, false);
  assert.equal(T.einordnen('Ba', V).beihilfe, true); assert.equal(T.einordnen('BEa', V).kategorie, 'Beitragsentlastung');
  assert.equal(T.einordnen('TA6', V).kategorie, 'Krankentagegeld'); assert.equal(T.einordnen('PPN', V).kategorie, 'Pflegepflicht');
  assert.equal(T.einordnen('VT', V).kategorie, 'Gesetzlicher Zuschlag'); assert.equal(T.einordnen('ST', V).kategorie, 'Sozialtarif · Standardtarif'); assert.equal(T.einordnen('BT', V).kategorie, 'Sozialtarif · Basistarif'); assert.equal(T.einordnen('NLT', V).kategorie, 'Sozialtarif · Notlagentarif');
  assert.equal(T.einordnen('ZG50', ZL).kategorie, 'Zahn'); assert.equal(T.einordnen('ZG50', ZL).zielgruppe, 'GKV-Mitglieder'); assert.equal(T.einordnen('ZG50', ZL).zusatz, true);
  assert.equal(T.einordnen('SG1F', 'Firmentarife').zielgruppe, 'Firmen (bKV)'); assert.equal(T.einordnen('UT', 'Unfallversicherung').kategorie, 'Unfall');
  assert.equal(T.einordnen('A103n', V).welt, 'n'); assert.equal(T.einordnen('S101u', V).welt, 'u'); assert.equal(T.einordnen('TA6', V).welt, '');
  assert.match(T.text('A107a', V), /^Ambulanter Tarif · Alte Tarifwelt/);
  // unbekannter Tarif: geschätzt, als unsicher markiert
  e = T.einordnen('SBUx', 'Lebensversicherung (Standard)');
  assert.deepEqual([e.beschreibung, e.kategorie, e.sicher], ['', 'Berufsunfähigkeit', false]);
  assert.match(T.text('SBUx', 'Lebensversicherung (Standard)'), /geschätzt/);
  assert.equal(T.einordnen('XYZ', V).kategorie, ''); assert.equal(T.sparte('XYZ', V), 'Sonstige');
  // ohne Endung oder mit Betrag erfasst: Tariffamilie
  e = T.einordnen('A107', V); assert.deepEqual([e.kategorie, e.beihilfe, e.welt], ['Ambulant', false, '']); assert.match(e.hinweis, /Tariffamilie/);
  assert.equal(T.einordnen('TA6/160', V).kategorie, 'Krankentagegeld'); assert.equal(T.einordnen('BE375', V).kategorie, 'Beitragsentlastung');
  assert.equal(T.einordnen('A30', V).beihilfe, true);
});

test('Team: Summenzeile wird auch erkannt, wenn sie nicht exakt der Summe entspricht', () => {
  const T = AB.team, z = (nr, name, w) => ({ nr, name, werte: w.concat([null, null, null, null, null, null, null, null]), hr: null, vj: null, gesamt: false });
  // wie in der echten Datei: Summe der Einzelzeilen liegt rund 4 % unter der Summenzeile
  const team = { zeilen: [z('900500', 'FD Testgebiet', [10300, 14600, 16900, 9660]), z('900101', 'A,B', [3669, 2000, 1406, 2471]), z('900102', 'C,D', [1469, 1198, 1397, 532]),
    z('900103', 'E,F', [1455, 1913, 1194, 7]), z('900104', 'G,H', [800, 2293, 1605, 18]), z('900105', 'I,J', [2500, 6600, 10600, 6200])] };
  assert.equal(T.erkenneGesamt(team), true); assert.equal(team.zeilen[0].gesamt, true);
  assert.equal(T.position(team, '900105').ytd.rang, 1); assert.equal(T.position(team, '900105').ytd.n, 5);
  // ohne Namen (pseudonymisiert) funktioniert es weiter über die Zahlen
  const ps = { zeilen: team.zeilen.map((x) => Object.assign({}, x, { name: '', gesamt: false })) };
  assert.equal(T.erkenneGesamt(ps), true); assert.equal(ps.zeilen[0].gesamt, true);
  // kein Fehlalarm: starker Einzel-ADP ist keine Summenzeile
  const ohne = { zeilen: [z('1', 'A,B', [9000, 9000, 9000, 9000]), z('2', 'C,D', [3000, 3000, 3000, 3000]), z('3', 'E,F', [2500, 2500, 2500, 2500]), z('4', 'G,H', [800, 900, 700, 600])] };
  assert.equal(T.erkenneGesamt(ohne), false); assert.ok(ohne.zeilen.every((x) => !x.gesamt));
  // Titel entscheidet, wenn er eindeutig ist
  const titel = { zeilen: [z('2', 'C,D', [3000, 3000, 3000, 3000]), z('9', 'Summe Gebiet', [4000, 4000, 4000, 4000]), z('3', 'E,F', [1000, 1000, 1000, 1000])] };
  assert.equal(T.erkenneGesamt(titel), true); assert.equal(titel.zeilen[1].gesamt, true);
});

test('Auswertung nach Kategorie und Beihilfe: Kennzahlen, Filter, Management-Würfel', async () => {
  const { p, zeilen, erg } = await stand('01-03');
  const neu = M.neuerAntrag(); neu.id = 'a-bh'; neu.eingang = '2026-03-05'; neu.vn = { name: 'Vorlage', vorname: 'Eva' };
  neu.positionen = [['A30a', 120], ['S30a', 45], ['PPB', 20]].map(([tarif, beitrag]) => Object.assign(M.neuePosition(), { tarif, beitrag }));
  p.antraege.push(neu);
  assert.equal(M.hatBeihilfe(neu), true); assert.equal(M.hatBeihilfe(p.antraege[0]), false);
  let k = AB.kennzahlen.rechne(p, erg, zeilen, HEUTE);
  assert.equal(k.jahr.beihilfeAnz, 1); assert.equal(k.jahr.beihilfe, 185);
  assert.deepEqual(k.jahr.kategorien['Beihilfe · Ambulant'], { stueck: 1, beitrag: 120 });
  assert.deepEqual(k.jahr.kategorien['Beihilfe · Pflegepflicht'], { stueck: 1, beitrag: 20 });
  assert.ok(k.jahr.kategorien['Ambulant'].stueck >= 3);
  k = AB.kennzahlen.rechne(p, erg, zeilen, HEUTE, { beihilfe: 'ja' });
  assert.equal(k.jahr.antraege, 1); assert.equal(k.jahr.brutto, 185);
  assert.equal(AB.kennzahlen.rechne(p, erg, zeilen, HEUTE, { beihilfe: 'nein' }).jahr.antraege, p.antraege.length - 1);
  // Management: Beihilfe-Buchungen im Würfel
  const bh = Object.assign({}, zeilen.find((z) => z.part === 'Hierarchie'), { tarif: 'A30a', mb: 120, mbd: 120, prov: 60, st: 0, stgrund: '' });
  const w = AB.team.wuerfel(zeilen.concat([bh]), 2026), arten = new Set(['Hierarchie']);
  const alle = AB.team.auswertung(w, { arten }), nur = AB.team.auswertung(w, { arten, beihilfe: 'ja' }), ohne = AB.team.auswertung(w, { arten, beihilfe: 'nein' });
  assert.equal(U.runde(nur.gesamt.netto), 120); assert.equal(U.runde(alle.gesamt.beihilfe), 120);
  assert.equal(U.runde(alle.gesamt.sparten['Beihilfe · Ambulant']), 120);
  assert.ok(Math.abs(alle.gesamt.netto - nur.gesamt.netto - ohne.gesamt.netto) < 0.01);
});

test('Altes Excel-Antragsbuch: Einträge lesen, über Beitrag und Provision der Abrechnung zuordnen', async () => {
  // Blatt wie im bisherigen Antragsbuch: Monatsblöcke in Spalte A, Beträge in Status-Spalten, ohne Name und Vertragsnummer
  const kopf = [null, 'Datum', 'Antragsteller', 'Abgerechnet Jahr', 'Policiert', 'Eingereicht', null, 'Abgerechnet Jahr', 'Policiert', 'Eingereicht', 'GKV', 'brutto', 'Sparte', 'Tarif', 'Provision Jahr'];
  const z = (a, o) => { const r = new Array(15).fill(null); r[0] = a; Object.entries(o || {}).forEach(([k, v]) => { r[+k] = v; }); return r; };
  const zeilenBlatt = [kopf, z('Januar'),
    z(null, { 3: 420.5, 12: 'Voll Neu', 13: 'A107', 14: 2312.75 }),           // = a-1 der Testabrechnung (Vertrag 012345)
    z(null, { 7: 48, 12: 'Zusatz', 13: 'ZP9', 14: 216 }),                      // Vertrag 400400
    z('Februar'), z(null, { 7: -20, 12: 'BKV Minderbeitrag', 13: 'Storno', 14: -110 }),
    z(null, { 8: 99.99, 12: 'BKV Neu', 13: 'ILF', 14: 300 }),                  // policiert, keine Buchung
    z(null, { 10: 2, 12: 'mhplus' }),
    z('März'), z(null, { 2: 'Demo, Fritz', 7: 28.9, 12: 'Zusatz', 13: 'ZP7', 14: 130.05 }),
    z('Dezember'), z('=SUM(A2:A9)', { 3: 420.5, 4: 0, 5: 0, 7: 56.9, 8: 99.99, 9: 0 })];
  const fund = AB.altbuch.finde([{ name: 'Abrechnung', zeilen: [['x']] }, { name: '2026', zeilen: zeilenBlatt }]);
  assert.equal(fund.jahr, 2026);
  const alt = AB.altbuch.lies(fund);
  assert.equal(alt.antraege.length, 6, 'Summenzeile wird nicht übernommen');
  const [a1, a2, a3, a4, a5, a6] = alt.antraege;
  assert.deepEqual([a1.eingang, a1.bereich, a1.vorgang, a1.status, M.beitrag(a1), a1.provisionManuell, a1.quelle], ['2026-01-01', 'voll', 'neu', 'abgerechnet', 420.5, 2312.75, 'altbuch']);
  assert.match(a1.vn.name, /^Ohne Name/);
  assert.deepEqual([a3.bereich, a3.vorgang, M.beitrag(a3), a3.eingang], ['bkv', 'minder', -20, '2026-02-01']);
  assert.equal(a4.status, 'policiert'); assert.equal(a5.bereich, 'gkv'); assert.equal(a5.positionen.length, 2);
  assert.deepEqual([a6.vn.name, a6.vn.vorname], ['Demo', 'Fritz']);
  // gegen die Testabrechnung laufen lassen
  const d = erzeuge(), p = M.neuesProjekt(2026);
  alt.antraege.forEach((a) => p.antraege.push(a));
  p.importZaehler = 1;
  const r = await AB.importer.lies(new Uint8Array(d.dateien['abrechnung_2026_01-03.csv']), 'a.csv', { importNr: 1 });
  assert.deepEqual(r.jahre, ['2026']);
  const zeilen = S.entpacke(r.gepackt);
  let erg = A.rechne(p, zeilen, HEUTE);
  const vor = Object.fromEntries(erg.vorschlaege.map((v) => [v.reihe.antrag.id, v]));
  assert.equal(vor[a1.id].kandidaten[0].vnr, '012345'); assert.equal(vor[a1.id].sicher, true);
  assert.deepEqual(vor[a1.id].kandidaten[0].gruende.slice(0, 2), ['Beitrag stimmt', 'Provision stimmt']);
  assert.equal(vor[a1.id].kandidaten[0].keys.length, 2, 'beide Personen des Vertrags zusammen');
  assert.equal(vor[a2.id].kandidaten[0].vnr, '400400'); assert.equal(vor[a6.id].kandidaten[0].vnr, '140140');
  assert.ok(ids(erg.offen).includes(a1.id), 'ohne Zuordnung steht der übernommene Eintrag unter Offen');
  const n = A.bestaetigeSichere(p, erg);
  assert.ok(n >= 3, n + ' sichere Zuordnungen');
  assert.equal(a1.vertragsnummer, '012345'); assert.equal(a2.vertragsnummer, '400400');
  erg = A.rechne(p, zeilen, HEUTE);
  assert.equal(erg.proAntrag[a1.id].liste, 'gleich'); assert.equal(erg.proAntrag[a1.id].istP, 2312.75);
  assert.ok(!erg.vorschlaege.some((v) => v.reihe.antrag.id === a1.id));
  // Datei-Erkennung über den Importer (Excel mit Antragsbuch-Blatt)
  const xl = AB.xlsxout.schreibe([{ name: '2026', spalten: kopf.map((t) => ({ t: t || '' })), zeilen: zeilenBlatt.slice(1).map((x) => x.map((v) => v == null ? '' : v)) }]);
  const imp = await AB.importer.lies(xl, 'Antragsbuch.xlsx', {});
  assert.equal(imp.art, 'altbuch'); assert.equal(imp.altbuch.antraege.length, 6); assert.equal(imp.blatt, '2026');
});

test('Neue Werte der echten Abrechnung: Kündigungsrücknahme, Pflege-, Auslands- und SDL-Tarifgruppe; eigene Auswertung', async () => {
  const kopf = KOPF, zl = [kopf,
    zeile({ vnr: '1', name: 'MUSTER, ANNA', tarif: 'PPN', tg: 'Pflegeversicherung', mbd: 30, f: 1.5, bdat: '2026-01-15', art: 'Kündigungsrücknahme' }),
    zeile({ vnr: '2', name: 'PROBE, CLARA', tarif: 'AR', tg: 'Auslandskrankenversicherung', mbd: 5, f: 4.5, bdat: '2026-02-12', beteil: '913095 (Geschrieben), 900999 (Mitwirkung)' }),
    zeile({ vnr: '3', name: 'TEST, DIETER', tarif: 'A30a', mbd: 120, bdat: '2026-02-12' })];
  const r = S.lies(zl.map((z) => z.map(String)));
  assert.equal(r.zeilen[0].part, 'Kündigungsrücknahme');
  assert.ok(S.PROVISIONSARTEN.includes('Kündigungsrücknahme') && M.standardEinstellungen().provisionsarten.includes('Kündigungsrücknahme'));
  assert.equal(M.bereichAusGruppe('Pflegeversicherung'), 'voll'); assert.equal(M.bereichAusGruppe('Auslandskrankenversicherung'), 'zusatz'); assert.equal(M.bereichAusGruppe('SDL (Standard)'), 'leben');
  const alt = M.migriere({ format: 'antragsbuch', schema: 1, jahr: 2026, antraege: [], einstellungen: { provisionsarten: ['Abschluss'] } });
  assert.deepEqual(alt.einstellungen.provisionsarten, ['Abschluss', 'Kündigungsrücknahme']);
  // eigene Auswertung: alles unter „ich", auch wenn ein Partner „geschrieben" hat
  const we = AB.team.wuerfel(r.zeilen, 2026, true), wm = AB.team.wuerfel(r.zeilen, 2026);
  assert.deepEqual(we.adps, ['ich']); assert.ok(wm.adps.includes('913095'));
  const a = AB.team.auswertung(we, {}).gesamt;
  assert.equal(U.runde(a.netto), 155); assert.equal(U.runde(a.beihilfe), 120);
  assert.equal(U.runde(a.spartenDetail['Beihilfe · Ambulant'].neu), 120); assert.equal(U.runde(a.provMonate[1]), U.runde(5 * 4.5 + 120 * 5.5));
});

test('Sammelmappe: Produktscheiben je ADP, Ziele, Sparten-Vergleich in fünf Stufen', async () => {
  const T = AB.team, mon = ['01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026', '08/2026', '09/2026', '10/2026', '11/2026', '12/2026'];
  const kopf = [null, null, 'Mrz../2026', '01-Mrz../2026', ''].concat(mon, ['', 'HR 2026', '2025']);
  const zeile = (name, a, b, c) => [null, name, c, a + b + c, '', a, b, c, '-', '-', '-', '-', '-', '-', '-', '-', '-', '', (a + b + c) * 4, 1000];
  const blatt = (name, voll, bkv, unfall) => ({ name, zeilen: [[], [null, 'Monatsscheiben Nettoproduktion in EUR'], [null, 'Stand: 31.03.2026'], [null, 'Filter: Vertrieb'], kopf,
    zeile('Kranken', voll + bkv, voll + bkv, voll + bkv), zeile('Vollversicherung', voll, voll, voll), zeile('Betriebliche Krankenversicherung', bkv, bkv, bkv), zeile('Unfall', unfall, unfall, unfall)] });
  const nrs = ['101', '102', '103', '104', '105', '106'];
  const blaetter = [blatt('FDBms', 2100, 600, 60)].concat(nrs.map((n, i) => blatt(n + 'ms', 100 * (i + 1), 600 - 100 * i, i === 2 ? 60 : 0)),
    [{ name: 'GV', zeilen: [[1]] }, { name: 'FDB Soll-Ist 2026', zeilen: [['FD – Soll'], ['ADP Nr.', 'Name', 'Ziel 2026 (Top-Down)'], [900103, 'TESTER, DREI', 5000], [900101, 'TESTER, EINS', 9000], [null, 'Summe', 14000]] }]);
  assert.equal(T.istSammelmappe(blaetter), true); assert.equal(T.istSammelmappe(blaetter.slice(0, 1)), false);
  const xl = AB.xlsxout.schreibe(blaetter.map((b) => ({ name: b.name, spalten: new Array(20).fill(0).map((_, i) => ({ t: String(b.zeilen[0][i] == null ? '' : b.zeilen[0][i]) })), zeilen: b.zeilen.slice(1).map((z) => z.map((v) => v == null ? '' : v)) })));
  const imp = await AB.importer.lies(xl, 'Sammelmappe.xlsx', {});
  assert.equal(imp.art, 'monatsscheiben');
  const team = imp.team;
  assert.equal(team.sammelmappe, true); assert.equal(team.jahr, 2026); assert.equal(team.stand, '2026-03-31');
  assert.equal(team.zeilen.length, 7); assert.equal(team.zeilen.filter((z) => z.gesamt).length, 1);
  const z3 = team.zeilen.find((z) => z.nr === '900103');
  assert.equal(z3.name, 'TESTER, DREI'); assert.deepEqual(z3.werte.slice(0, 4), [760, 760, 760, null]);     // Kranken 700 + Unfall 60
  assert.deepEqual(z3.sparten['Vollversicherung'].slice(0, 3), [300, 300, 300]);
  assert.deepEqual(team.ziele, { jahr: 2026, werte: { '900103': 5000, '900101': 9000 } });
  // Sparten-Vergleich: 900106 ist in Voll Spitze, in bKV ganz unten; 900103 hat als Einziger Unfall
  const v = Object.fromEntries(T.spartenVergleich(team, '900106', 2).map((s) => [s.id, s]));
  assert.deepEqual([v['Vollversicherung'].stufe, v['Vollversicherung'].rang, v['Vollversicherung'].wert], [5, 1, 1800]);
  assert.deepEqual([v['Betriebliche Krankenversicherung'].stufe, v['Betriebliche Krankenversicherung'].rang], [1, 6]);
  assert.equal(Object.fromEntries(T.spartenVergleich(team, '900103', 2).map((s) => [s.id, s.stufe]))['Unfall'], 5);
  assert.deepEqual(T.spartenVergleich(team, '900101', 2).map((s) => s.stufe).slice(1, 3), [1, 5]);                // Voll unten, bKV oben
  assert.deepEqual([4, 3, 2].map((n) => T.spartenVergleich(team, '90010' + n, 2).find((s) => s.id === 'Vollversicherung').stufe), [4, 3, 2]);
  const pos = T.position(team, '900103');
  assert.deepEqual(pos.ziel, { jahr: 2026, wert: 5000, vorjahr: 9120 }); assert.equal(pos.ytd.n, 6);
  // Teamdatei für ADP: ohne Namen und Nummern, Vergleich und Ziel bleiben nutzbar
  const ps = T.pseudonymisiere(team);
  assert.ok(!JSON.stringify(ps).includes('TESTER') && !JSON.stringify(ps).includes('900103'));
  assert.equal(T.spartenVergleich(ps, '900106', 2).find((s) => s.id === 'Vollversicherung').stufe, 5);
  assert.equal(T.position(ps, '900103').ziel.wert, 5000);
});
