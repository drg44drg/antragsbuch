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
  assert.deepEqual(v.kandidaten[0].gruende, ['Beitrag stimmt', 'Name stimmt', 'Beginn stimmt', 'Tarif stimmt']);
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
  const kopf = zurueck[0].zeilen.findIndex((z) => z[0] === 'Eingang'), z1 = zurueck[0].zeilen[kopf + 1];
  assert.equal(z1[0], '2026-01-05', 'Datum als echtes Excel-Datum'); assert.equal(z1[1], 'Muster'); assert.equal(typeof z1[9], 'number');
  assert.equal(zurueck[0].zeilen.length, kopf + 1 + t.zeilen.length);
  assert.equal(zurueck[1].zeilen[1].length, pr.spalten.length);
  const roh = Buffer.from(bytes).toString('latin1');
  assert.match(roh, /FF6250D6/); assert.match(roh, /\[Red\]/); assert.match(roh, /state="frozen"/);
});
